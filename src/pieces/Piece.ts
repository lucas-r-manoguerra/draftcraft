import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import { Physics } from "../engine/Physics";
import type { PieceDef } from "./Catalog";

const PIECE_COLOR = 0xd8c3a5;

/**
 * A placed piece: a dynamic Rapier body with a cuboid collider and a matching
 * three.js box mesh, sized from the catalog's metric dimensions. The collider
 * is registered as a piece collider so raycast hits can be told apart from
 * ground hits; `dispose()` removes body, collider and mesh from the world.
 */
export class Piece {
  readonly body: RAPIER.RigidBody;
  readonly collider: RAPIER.Collider;
  readonly mesh: THREE.Mesh;

  private readonly physics: Physics;
  private readonly scene: THREE.Scene;

  constructor(physics: Physics, scene: THREE.Scene, def: PieceDef, position: RAPIER.Vector) {
    this.physics = physics;
    this.scene = scene;

    const [dx, dy, dz] = def.meters;
    this.body = physics.createDynamicBody(
      RAPIER.ColliderDesc.cuboid(dx / 2, dy / 2, dz / 2),
      position,
    );
    this.collider = this.body.collider(0);
    physics.registerPieceCollider(this.collider);

    const geometry = new THREE.BoxGeometry(dx, dy, dz);
    const material = new THREE.MeshStandardMaterial({ color: PIECE_COLOR });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    scene.add(this.mesh);
  }

  /** Frees the collider (via the rigid body), the mesh and its GPU resources. */
  dispose(): void {
    this.physics.unregisterPieceCollider(this.collider);
    this.physics.world.removeRigidBody(this.body);
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    const material = this.mesh.material;
    if (Array.isArray(material)) {
      material.forEach((entry) => entry.dispose());
    } else {
      material.dispose();
    }
  }
}
