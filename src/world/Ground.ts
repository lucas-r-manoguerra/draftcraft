import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import { Physics } from "../engine/Physics";

export const GROUND_EXTENT = 50;

const GROUND_COLOR = 0x71a86e;
const GRID_MAJOR_COLOR = 0x2f4f2f;
const GRID_MINOR_COLOR = 0x55805;
const GRID_DIVISIONS = 20;

/**
 * Flat ground plane (100x100m) with a matching static collider whose top face
 * sits at y=0, plus an optional metric grid helper (5m cells).
 */
export class Ground {
  readonly mesh: THREE.Mesh;

  constructor(physics: Physics, scene: THREE.Scene) {
    const collider = RAPIER.ColliderDesc.cuboid(GROUND_EXTENT, 0.5, GROUND_EXTENT).setFriction(0.8);
    physics.createFixedBody(collider, { x: 0, y: -0.5, z: 0 });

    const geometry = new THREE.PlaneGeometry(GROUND_EXTENT * 2, GROUND_EXTENT * 2);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({ color: GROUND_COLOR, roughness: 0.9 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);

    const grid = new THREE.GridHelper(GROUND_EXTENT * 2, GRID_DIVISIONS, GRID_MAJOR_COLOR, GRID_MINOR_COLOR);
    scene.add(grid);
  }
}
