import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import { Physics } from "../engine/Physics";
import { Piece } from "./Piece";
import { PieceCatalog, type PieceDef } from "./Catalog";
import { roundToCm, snapToFace, type QuatSimple } from "./snap";

const AIM_DISTANCE = 5;
const ROTATE_QUARTER_TURN = Math.PI / 2;
const GHOST_VALID_COLOR = 0x00cc66;
const GHOST_INVALID_COLOR = 0xcc3344;
const GHOST_OPACITY = 0.5;

/** Build input surface consumed by the controller (see design). */
export interface BuildInput {
  consumePlace(): boolean;
  consumeRotate(): boolean;
  consumeRemove(): boolean;
  consumeSelect(): boolean;
}

/** Y-axis quarter-turn used by `consumeRotate`; 4 presses = identity. */
const QUARTER_TURN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ROTATE_QUARTER_TURN);

function toQuatSimple(q: THREE.Quaternion): QuatSimple {
  return { x: q.x, y: q.y, z: q.z, w: q.w };
}

/**
 * Aim → ghost → validate → place/rotate/remove pipeline for building pieces.
 *
 * Each fixed step casts a 5 m ray from the camera; a piece hit snaps the ghost
 * flush to the face, a ground hit additionally rounds to whole centimeters.
 * The ghost turns red while its pose overlaps any piece (or the ground) and
 * green otherwise. Placing spawns a `Piece` only when the ghost is valid and
 * `consumePlace` fires; `consumeRemove` disposes the piece under the crosshair.
 */
export class PlacementController {
  private readonly catalog = new PieceCatalog();
  private readonly placed: Piece[] = [];
  private readonly ghostMesh: THREE.Mesh;
  private readonly ghostMaterial: THREE.MeshStandardMaterial;
  private readonly ghostRotationValue = new THREE.Quaternion();
  private readonly ghostPositionValue = new THREE.Vector3();
  private readonly rayDir = new THREE.Vector3();
  private hasTargetValue = false;
  private ghostValidValue = false;
  private lastHit: { point: RAPIER.Vector; normal: RAPIER.Vector; collider?: RAPIER.Collider } | undefined;

  constructor(
    private readonly physics: Physics,
    private readonly scene: THREE.Scene,
  ) {
    this.ghostMaterial = new THREE.MeshStandardMaterial({
      color: GHOST_VALID_COLOR,
      transparent: true,
      opacity: GHOST_OPACITY,
      depthWrite: false,
    });
    this.ghostMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.ghostMaterial);
    this.ghostMesh.visible = false;
    this.ghostMesh.renderOrder = 1;
    scene.add(this.ghostMesh);
    this.resizeGhost();
  }

  get hasTarget(): boolean {
    return this.hasTargetValue;
  }

  get ghostValid(): boolean {
    return this.ghostValidValue;
  }

  get ghostPosition(): THREE.Vector3 {
    return this.ghostPositionValue;
  }

  get ghostRotation(): THREE.Quaternion {
    return this.ghostRotationValue;
  }

  get placedCount(): number {
    return this.placed.length;
  }

  get placedPieces(): readonly Piece[] {
    return this.placed;
  }

  get selectedPiece(): PieceDef {
    return this.catalog.selected;
  }

  update(_dt: number, input: BuildInput, camera: THREE.PerspectiveCamera): void {
    if (input.consumeSelect()) {
      this.catalog.select(true);
      this.resizeGhost();
    }
    if (input.consumeRotate()) {
      this.ghostRotationValue.multiply(QUARTER_TURN);
    }

    this.aim(camera);

    if (input.consumeRemove()) {
      this.removeTarget();
    }
    if (input.consumePlace() && this.hasTargetValue && this.ghostValidValue) {
      this.placeGhost();
    }
  }

  /** Removes the ghost mesh and its GPU resources from the scene. */
  dispose(): void {
    this.scene.remove(this.ghostMesh);
    this.ghostMesh.geometry.dispose();
    this.ghostMaterial.dispose();
  }

  private resizeGhost(): void {
    const [dx, dy, dz] = this.catalog.selected.meters;
    this.ghostMesh.scale.set(dx, dy, dz);
  }

  private aim(camera: THREE.PerspectiveCamera): void {
    const origin: RAPIER.Vector = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    };
    camera.getWorldDirection(this.rayDir);

    const result = this.physics.castRayAndGetNormal(origin, this.rayDir, AIM_DISTANCE);
    if (!result.hit) {
      this.hasTargetValue = false;
      this.ghostValidValue = false;
      this.lastHit = undefined;
      this.ghostMesh.visible = false;
      return;
    }

    this.hasTargetValue = true;
    this.lastHit = {
      point: result.point,
      normal: result.normal,
      collider: result.collider,
    };

    const [dx, dy, dz] = this.catalog.selected.meters;
    const half = { x: dx / 2, y: dy / 2, z: dz / 2 };
    const snapped = snapToFace(result.point, result.normal, half, toQuatSimple(this.ghostRotationValue));
    // Design decision 2: piece hit keeps the exact flush pose (0.115 m cannot
    // live on the cm grid); ground hit rounds to whole centimeters. A hit with
    // no collider cannot be classified, so fall back to the ground behavior.
    const isPieceHit = result.collider !== undefined && this.physics.isPieceCollider(result.collider);
    const pose = isPieceHit ? snapped : roundToCm(snapped);

    this.ghostPositionValue.set(pose.x, pose.y, pose.z);
    this.ghostMesh.position.copy(this.ghostPositionValue);
    this.ghostMesh.quaternion.copy(this.ghostRotationValue);

    const overlap = this.physics.castShapeOverlap(
      new RAPIER.Cuboid(half.x, half.y, half.z),
      pose,
      toQuatSimple(this.ghostRotationValue),
    );
    this.ghostValidValue = !overlap;
    this.ghostMaterial.color.setHex(this.ghostValidValue ? GHOST_VALID_COLOR : GHOST_INVALID_COLOR);
    this.ghostMesh.visible = true;
  }

  private placeGhost(): void {
    const def = this.catalog.selected;
    const piece = new Piece(this.physics, this.scene, def, {
      x: this.ghostPositionValue.x,
      y: this.ghostPositionValue.y,
      z: this.ghostPositionValue.z,
    });
    const q = this.ghostRotationValue;
    piece.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    piece.mesh.position.copy(this.ghostPositionValue);
    piece.mesh.quaternion.copy(this.ghostRotationValue);
    this.placed.push(piece);
  }

  private removeTarget(): void {
    const hit = this.lastHit;
    if (!hit?.collider || !this.physics.isPieceCollider(hit.collider)) return;
    const index = this.placed.findIndex((piece) => piece.collider === hit.collider);
    if (index === -1) return;
    const [removed] = this.placed.splice(index, 1);
    if (removed) removed.dispose();
  }
}
