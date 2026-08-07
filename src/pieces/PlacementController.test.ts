import { test, expect, beforeAll } from "bun:test";
import * as RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { Physics } from "../engine/Physics";
import { Ground } from "../world/Ground";
import { PlacementController, type BuildInput } from "./PlacementController";
import { PIECE_CATALOG } from "./Catalog";

beforeAll(async () => {
  await RAPIER.init();
});

/**
 * Brick half extents derived from the catalog (240 × 115 × 52 mm), never
 * hardcoded floats: the controller sizes the ghost from `PieceDef.meters`.
 */
const BRICK = PIECE_CATALOG[0]!;
const BRICK_HALF_Y = BRICK.meters[1] / 2;
const BRICK_HALF_X = BRICK.meters[0] / 2;
/** Ground aim snaps the brick resting on its 115 mm face, cm-rounded. */
const BRICK_REST_Y = Math.round(BRICK_HALF_Y / 0.01) * 0.01;

/**
 * Edge-triggered build input for tests: a press flags the action once and the
 * next `consume*` call clears it, mirroring the game Input contract.
 */
class FakeBuildInput implements BuildInput {
  private place = false;
  private rotate = false;
  private remove = false;
  private select = false;

  press(action: "place" | "rotate" | "remove" | "select"): void {
    this[action] = true;
  }

  consumePlace(): boolean {
    const pressed = this.place;
    this.place = false;
    return pressed;
  }

  consumeRotate(): boolean {
    const pressed = this.rotate;
    this.rotate = false;
    return pressed;
  }

  consumeRemove(): boolean {
    const pressed = this.remove;
    this.remove = false;
    return pressed;
  }

  consumeSelect(): boolean {
    const pressed = this.select;
    this.select = false;
    return pressed;
  }
}

function buildWorld(): { physics: Physics; scene: THREE.Scene } {
  const physics = new Physics();
  const scene = new THREE.Scene();
  new Ground(physics, scene);
  return { physics, scene };
}

/** Camera positioned above `target`, looking straight at it. */
function aimCamera(px: number, py: number, pz: number, tx: number, ty: number, tz: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(px, py, pz);
  camera.lookAt(tx, ty, tz);
  camera.updateMatrixWorld();
  return camera;
}

test("aim at the ground targets the cm-rounded resting pose of the selected piece", () => {
  const { physics, scene } = buildWorld();
  // Populate the broad phase (see note in Physics.test.ts: queries before the
  // first step return no hits on rapier3d-compat 0.19.3).
  physics.step();
  const input = new FakeBuildInput();
  const placement = new PlacementController(physics, scene);

  // Camera 2m above the ground point (0.374, 0, -0.207) looking straight down.
  const camera = aimCamera(0.374, 2, -0.207, 0.374, 0, -0.207);
  placement.update(1 / 60, input, camera);

  expect(placement.hasTarget).toBe(true);
  const pos = placement.ghostPosition;
  // The hit point is rounded to whole centimeters...
  expect(pos.x).toBeCloseTo(0.37, 5);
  expect(pos.z).toBeCloseTo(-0.21, 5);
  // ...and the piece rests on the ground (brick half height on the cm grid).
  expect(pos.y).toBeCloseTo(BRICK_REST_Y, 5);
  expect(placement.ghostValid).toBe(true);
});

test("aim beyond 5 m reports no target and the ghost is not valid", () => {
  const { physics, scene } = buildWorld();
  physics.step();
  const input = new FakeBuildInput();
  const placement = new PlacementController(physics, scene);

  // Camera 6m above the ground: the 5m aim ray cannot reach it.
  const camera = aimCamera(0, 6, 0, 0, 0, 0);
  placement.update(1 / 60, input, camera);

  expect(placement.hasTarget).toBe(false);
  expect(placement.ghostValid).toBe(false);
});

test("brick snaps flush to a piece face with no cm rounding", () => {
  const { physics, scene } = buildWorld();
  physics.step();
  const input = new FakeBuildInput();
  const placement = new PlacementController(physics, scene);

  // Place the first brick on the ground at the origin.
  const aim = aimCamera(0, 2, 0, 0, 0, 0);
  placement.update(1 / 60, input, aim);
  input.press("place");
  placement.update(1 / 60, input, aim);
  expect(placement.placedCount).toBe(1);
  // Make the new collider visible to queries (broad phase refresh).
  physics.step();
  const placedY = placement.placedPieces[0]!.body.translation().y;

  // Aim at the top face of the placed brick.
  const topAim = aimCamera(0, 2, 0, 0, placedY + 2 * BRICK_HALF_Y, 0);
  placement.update(1 / 60, input, topAim);

  expect(placement.hasTarget).toBe(true);
  const pos = placement.ghostPosition;
  // The ghost center rests exactly one brick half-height above the hit face.
  // The 0.0575m offset is NOT a cm multiple: any cm rounding would shift y by
  // at least 2mm, which exceeds the 5-digit tolerance. x/z use a 1mm tolerance
  // because `camera.lookAt` leaves a ~1e-4 direction float error that drifts
  // the hit point laterally by <0.2mm over the 2m ray — still far below any
  // cm-rounding artifact (>=2mm).
  expect(pos.x).toBeCloseTo(0, 3);
  expect(pos.y).toBeCloseTo(placedY + 2 * BRICK_HALF_Y, 5);
  expect(pos.z).toBeCloseTo(0, 3);
  // Flush contact is not an overlap, so the ghost stays valid and placeable.
  expect(placement.ghostValid).toBe(true);
});

test("ghost overlapping a placed piece is invalid and blocks placement", () => {
  const { physics, scene } = buildWorld();
  physics.step();
  const input = new FakeBuildInput();
  const placement = new PlacementController(physics, scene);

  // Place a brick at the origin, then refresh the broad phase.
  const aim = aimCamera(0, 2, 0, 0, 0, 0);
  placement.update(1 / 60, input, aim);
  input.press("place");
  placement.update(1 / 60, input, aim);
  physics.step();

  // Aim at the ground beside the brick: an offset of 1.5 brick half-widths
  // (0.18m < 2 × 0.12m) keeps the ghost footprint clipping the placed piece.
  const near = aimCamera(1.5 * BRICK_HALF_X, 2, 0, 1.5 * BRICK_HALF_X, 0, 0);
  placement.update(1 / 60, input, near);
  expect(placement.hasTarget).toBe(true);
  expect(placement.ghostValid).toBe(false);

  // Confirming placement while the ghost is invalid creates nothing.
  input.press("place");
  placement.update(1 / 60, input, near);
  expect(placement.placedCount).toBe(1);
});

test("valid placement creates a piece at the ghost pose", () => {
  const { physics, scene } = buildWorld();
  physics.step();
  const input = new FakeBuildInput();
  const placement = new PlacementController(physics, scene);

  // Aim at clear ground well away from anything and confirm the ghost.
  const aim = aimCamera(0.5, 2, 0, 0.5, 0, 0);
  placement.update(1 / 60, input, aim);
  expect(placement.ghostValid).toBe(true);
  const ghostPos = placement.ghostPosition;

  input.press("place");
  placement.update(1 / 60, input, aim);

  expect(placement.placedCount).toBe(1);
  const placed = placement.placedPieces[0]!;
  // The body, the mesh and the rotation all sit at the ghost pose.
  const body = placed.body.translation();
  expect(body.x).toBeCloseTo(ghostPos.x, 5);
  expect(body.y).toBeCloseTo(ghostPos.y, 5);
  expect(body.z).toBeCloseTo(ghostPos.z, 5);
  expect(placed.mesh.position.x).toBeCloseTo(ghostPos.x, 5);
  expect(placed.mesh.position.y).toBeCloseTo(ghostPos.y, 5);
  expect(placed.mesh.position.z).toBeCloseTo(ghostPos.z, 5);
  expect(placed.body.rotation().w).toBeCloseTo(1, 5);
  expect(physics.isPieceCollider(placed.collider)).toBe(true);
});

test("rotate is edge-triggered: one press rotates the ghost exactly once", () => {
  const { physics, scene } = buildWorld();
  physics.step();
  const input = new FakeBuildInput();
  const placement = new PlacementController(physics, scene);
  const camera = aimCamera(0.5, 2, 0, 0.5, 0, 0);

  input.press("rotate");
  placement.update(1 / 60, input, camera);
  // Held across the next frame: the queued press is already consumed.
  placement.update(1 / 60, input, camera);

  const q = placement.ghostRotation;
  // Exactly one quarter turn about Y: q = (0, sin(pi/4), 0, cos(pi/4)).
  expect(q.x).toBeCloseTo(0, 5);
  expect(q.z).toBeCloseTo(0, 5);
  expect(Math.abs(q.y)).toBeCloseTo(Math.SQRT1_2, 5);
  expect(q.w).toBeCloseTo(Math.SQRT1_2, 5);
});

test("four rotate presses return the ghost to its original orientation", () => {
  const { physics, scene } = buildWorld();
  physics.step();
  const input = new FakeBuildInput();
  const placement = new PlacementController(physics, scene);
  const camera = aimCamera(0.5, 2, 0, 0.5, 0, 0);

  for (let i = 0; i < 4; i++) {
    input.press("rotate");
    placement.update(1 / 60, input, camera);
  }

  // Compare the ROTATION, not the quaternion coefficients: q and -q encode
  // the same rotation, so 4 quarter turns may legitimately land on either
  // sign of the identity quaternion (THREE produces (0,0,0,-1)).
  const probe = new THREE.Vector3(1, 0, 0).applyQuaternion(placement.ghostRotation);
  expect(probe.x).toBeCloseTo(1, 5);
  expect(probe.y).toBeCloseTo(0, 5);
  expect(probe.z).toBeCloseTo(0, 5);
});

test("removal frees the collider and the mesh of the targeted piece", () => {
  const { physics, scene } = buildWorld();
  physics.step();
  const input = new FakeBuildInput();
  const placement = new PlacementController(physics, scene);

  // Place a brick at (0.5, 0.03, 0) and refresh the broad phase.
  const aim = aimCamera(0.5, 2, 0, 0.5, 0, 0);
  placement.update(1 / 60, input, aim);
  input.press("place");
  placement.update(1 / 60, input, aim);
  physics.step();
  const piece = placement.placedPieces[0]!;
  const meshId = piece.mesh.id;

  // Aim straight down at the brick's center: the ray hits its top face.
  const topAim = aimCamera(0.5, 2, 0, 0.5, 0, 0);
  placement.update(1 / 60, input, topAim);
  expect(placement.hasTarget).toBe(true);
  input.press("remove");
  placement.update(1 / 60, input, topAim);

  expect(placement.placedCount).toBe(0);
  expect(physics.isPieceCollider(piece.collider)).toBe(false);
  expect(scene.getObjectById(meshId)).toBeUndefined();
});

test("removal with no piece target leaves placed pieces untouched", () => {
  const { physics, scene } = buildWorld();
  physics.step();
  const input = new FakeBuildInput();
  const placement = new PlacementController(physics, scene);

  // Place a brick, then aim at bare ground 2m away and try to remove.
  const aim = aimCamera(0, 2, 0, 0, 0, 0);
  placement.update(1 / 60, input, aim);
  input.press("place");
  placement.update(1 / 60, input, aim);
  physics.step();

  const away = aimCamera(-2, 2, 0, -2, 0, 0);
  placement.update(1 / 60, input, away);
  input.press("remove");
  placement.update(1 / 60, input, away);

  expect(placement.placedCount).toBe(1);
  expect(physics.isPieceCollider(placement.placedPieces[0]!.collider)).toBe(true);
});

test("select cycles the catalog and resizes the ghost to the new piece", () => {
  const { physics, scene } = buildWorld();
  physics.step();
  const input = new FakeBuildInput();
  const placement = new PlacementController(physics, scene);
  expect(placement.selectedPiece.id).toBe("brick");

  const aim = aimCamera(0.5, 2, 0, 0.5, 0, 0);
  placement.update(1 / 60, input, aim);
  input.press("select");
  placement.update(1 / 60, input, aim);
  expect(placement.selectedPiece.id).toBe("block");

  // Re-aim with the block selected: it rests higher (200mm -> half 0.1m).
  placement.update(1 / 60, input, aim);
  const pos = placement.ghostPosition;
  expect(pos.x).toBeCloseTo(0.5, 5);
  expect(pos.y).toBeCloseTo(0.1, 5);
  expect(pos.z).toBeCloseTo(0, 5);
  expect(placement.ghostValid).toBe(true);
});
