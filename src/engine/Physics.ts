import * as RAPIER from "@dimforge/rapier3d-compat";

export const WORLD_GRAVITY: RAPIER.Vector = { x: 0, y: -9.81, z: 0 };
export const PHYSICS_TIMESTEP = 1 / 60;

/**
 * Thin wrapper around a Rapier physics world: owns the world, exposes a fixed
 * stepping call and small factories for the body types the game needs.
 */
export class Physics {
  readonly world: RAPIER.World;

  constructor(gravity: RAPIER.Vector = WORLD_GRAVITY) {
    this.world = new RAPIER.World(gravity);
    this.world.timestep = PHYSICS_TIMESTEP;
  }

  step(): void {
    this.world.step();
  }

  createFixedBody(
    collider: RAPIER.ColliderDesc,
    position: RAPIER.Vector = { x: 0, y: 0, z: 0 },
  ): RAPIER.RigidBody {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z),
    );
    this.world.createCollider(collider, body);
    return body;
  }

  createKinematicBody(position: RAPIER.Vector): RAPIER.RigidBody {
    return this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x, position.y, position.z),
    );
  }

  createCapsuleCollider(halfHeight: number, radius: number, parent: RAPIER.RigidBody): RAPIER.Collider {
    return this.world.createCollider(RAPIER.ColliderDesc.capsule(halfHeight, radius), parent);
  }

  dispose(): void {
    this.world.free();
  }
}
