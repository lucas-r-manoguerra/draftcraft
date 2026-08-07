import { test, expect, beforeAll } from "bun:test";
import * as RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import {
  interactionGroups,
  Physics,
  PIECES_GROUP,
  PLAYER_GROUP,
} from "./Physics";
import { Ground } from "../world/Ground";
import { PlayerController } from "../player/PlayerController";
import { Piece } from "../pieces/Piece";
import { PIECE_CATALOG } from "../pieces/Catalog";

beforeAll(async () => {
  await RAPIER.init();
});

/** Brick half extents (0.24 × 0.115 × 0.052 m) from the catalog. */
const BRICK_HALF = { x: 0.12, y: 0.026, z: 0.026 };
const IDENTITY_ROT = { x: 0, y: 0, z: 0, w: 1 };

function buildWorld(): { physics: Physics; scene: THREE.Scene } {
  const physics = new Physics();
  const scene = new THREE.Scene();
  new Ground(physics, scene);
  return { physics, scene };
}

test("piece rests on the ground and sleeps: velocity reaches zero after fixed steps", () => {
  const { physics } = buildWorld();
  const body = physics.createDynamicBody(
    RAPIER.ColliderDesc.cuboid(BRICK_HALF.x, BRICK_HALF.y, BRICK_HALF.z),
    { x: 0, y: BRICK_HALF.y, z: 0 },
  );

  for (let i = 0; i < 900; i++) {
    physics.step();
  }

  const velocity = body.linvel();
  const y = body.translation().y;
  expect(body.isSleeping()).toBe(true);
  expect(Math.abs(velocity.y)).toBeLessThan(0.001);
  // resting on the ground: neither tunneled nor floating above it
  expect(y).toBeGreaterThan(0);
  expect(Math.abs(y - BRICK_HALF.y)).toBeLessThan(0.02);
});

test("stack: upper piece rests flush on the lower piece without interpenetration", () => {
  const { physics } = buildWorld();
  const lower = physics.createDynamicBody(
    RAPIER.ColliderDesc.cuboid(BRICK_HALF.x, BRICK_HALF.y, BRICK_HALF.z),
    { x: 0, y: BRICK_HALF.y, z: 0 },
  );
  const upper = physics.createDynamicBody(
    RAPIER.ColliderDesc.cuboid(BRICK_HALF.x, BRICK_HALF.y, BRICK_HALF.z),
    { x: 0, y: 3 * BRICK_HALF.y, z: 0 },
  );

  for (let i = 0; i < 900; i++) {
    physics.step();
  }

  const lowerTop = lower.translation().y + BRICK_HALF.y;
  const upperBottom = upper.translation().y - BRICK_HALF.y;
  // the upper brick rests on the lower face: no interpenetration (bottom not
  // below the top) and no gap (it did not bounce away or float)
  expect(upperBottom).toBeGreaterThan(lowerTop - 0.01);
  expect(upperBottom).toBeLessThan(lowerTop + 0.02);
});

test("ray cast through the player capsule hits the piece behind it (player excluded)", () => {
  const { physics, scene } = buildWorld();
  const player = new PlayerController(physics, scene);
  const piece = physics.createDynamicBody(
    RAPIER.ColliderDesc.cuboid(BRICK_HALF.x, BRICK_HALF.y, BRICK_HALF.z),
    { x: 0, y: BRICK_HALF.y, z: -3 },
  );
  physics.registerPieceCollider(piece.collider(0));
  // One step populates the broad phase; on rapier3d-compat 0.19.3 every query
  // issued before the first step returns no hits.
  physics.step();

  // Eye-level origin beyond the player's front, aimed back through the capsule
  // and down to the piece resting on the ground at z = -3.
  const eye = player.eyePosition;
  const target = { x: 0, y: BRICK_HALF.y, z: -3 };
  const origin = { x: 0, y: eye.y, z: 3 };
  const length = Math.hypot(target.y - origin.y, target.z - origin.z);
  const dir = {
    x: 0,
    y: (target.y - origin.y) / length,
    z: (target.z - origin.z) / length,
  };

  // Default query groups (pieces only) must skip the capsule and hit the piece.
  const result = physics.castRayAndGetNormal(origin, dir, length + 1);
  expect(result.hit).toBe(true);
  expect(result.collider).toBeDefined();
  expect(physics.isPieceCollider(result.collider!)).toBe(true);
  expect(result.point.z).toBeLessThan(-2.9);

  // Control: an all-groups ray hits the capsule first, proving the exclusion
  // above comes from the groups, not from geometry.
  const allGroups = physics.castRayAndGetNormal(
    origin,
    dir,
    length + 1,
    interactionGroups(PLAYER_GROUP | PIECES_GROUP, PLAYER_GROUP | PIECES_GROUP),
  );
  expect(allGroups.hit).toBe(true);
  // The capsule is reached well before the piece (which sits at z = -3).
  expect(allGroups.point.z).toBeGreaterThan(-1);
  expect(physics.isPieceCollider(allGroups.collider!)).toBe(false);
});

test("castShapeOverlap detects an intersecting pose and accepts clear poses", () => {
  const { physics } = buildWorld();
  const shape = new RAPIER.Cuboid(BRICK_HALF.x, BRICK_HALF.y, BRICK_HALF.z);
  physics.createDynamicBody(
    RAPIER.ColliderDesc.cuboid(BRICK_HALF.x, BRICK_HALF.y, BRICK_HALF.z),
    { x: 0, y: BRICK_HALF.y, z: 0 },
  );
  // Populate the broad phase (see note in the capsule raycast test).
  physics.step();

  // Same pose as the piece: full intersection.
  expect(physics.castShapeOverlap(shape, { x: 0, y: BRICK_HALF.y, z: 0 }, IDENTITY_ROT)).toBe(true);
  // Just above the piece: no contact with it or with the ground.
  expect(physics.castShapeOverlap(shape, { x: 0, y: BRICK_HALF.y + 0.2, z: 0 }, IDENTITY_ROT)).toBe(false);
  // Far away in the air: clear.
  expect(physics.castShapeOverlap(shape, { x: 5, y: 2, z: 5 }, IDENTITY_ROT)).toBe(false);
});

test("raycast beyond the maximum distance reports no hit", () => {
  const { physics } = buildWorld();
  const piece = physics.createDynamicBody(
    RAPIER.ColliderDesc.cuboid(BRICK_HALF.x, BRICK_HALF.y, BRICK_HALF.z),
    { x: 0, y: BRICK_HALF.y, z: 0 },
  );
  // Ray hits must be classifiable as piece hits, as a placed Piece would be.
  physics.registerPieceCollider(piece.collider(0));
  // Populate the broad phase (see note in the capsule raycast test).
  physics.step();

  const origin = { x: 0, y: BRICK_HALF.y, z: 6 };
  // Piece is 6 m away: outside the 5 m placement range.
  const short = physics.castRayAndGetNormal(origin, { x: 0, y: 0, z: -1 }, 5);
  expect(short.hit).toBe(false);

  // Same ray with enough range reaches the piece.
  const long = physics.castRayAndGetNormal(origin, { x: 0, y: 0, z: -1 }, 7);
  expect(long.hit).toBe(true);
  expect(long.point.z).toBeLessThan(0.1);
  expect(physics.isPieceCollider(long.collider!)).toBe(true);
});

test("Piece.dispose removes its collider and mesh from the world", () => {
  const { physics, scene } = buildWorld();
  const piece = new Piece(physics, scene, PIECE_CATALOG[0]!, { x: 2, y: BRICK_HALF.y, z: 2 });
  expect(physics.isPieceCollider(piece.collider)).toBe(true);
  // Populate the broad phase (see note in the capsule raycast test).
  physics.step();

  // While alive, a ray aimed at the piece reports a piece hit.
  const before = physics.castRayAndGetNormal({ x: 2, y: BRICK_HALF.y, z: 5 }, { x: 0, y: 0, z: -1 }, 6);
  expect(before.hit).toBe(true);
  expect(physics.isPieceCollider(before.collider!)).toBe(true);

  piece.dispose();

  expect(physics.isPieceCollider(piece.collider)).toBe(false);
  expect(scene.getObjectById(piece.mesh.id)).toBeUndefined();
  // Refresh the broad phase so the removed collider's stale entry is gone.
  physics.step();
  // The collider is really gone: the same ray now reports no hit.
  const after = physics.castRayAndGetNormal({ x: 2, y: BRICK_HALF.y, z: 5 }, { x: 0, y: 0, z: -1 }, 6);
  expect(after.hit).toBe(false);
});
