import * as RAPIER from "@dimforge/rapier3d-compat";

export const WORLD_GRAVITY: RAPIER.Vector = { x: 0, y: -9.81, z: 0 };
export const PHYSICS_TIMESTEP = 1 / 60;

/** Collision group of the player capsule (1u = one bit in the mask). */
export const PLAYER_GROUP = 1;
/** Collision group of placed pieces. */
export const PIECES_GROUP = 2;

/**
 * Packs 16-bit membership/filter bit masks into Rapier 0.19's
 * `InteractionGroups` number (16 left-most bits = memberships, 16 right-most
 * bits = filter). Rapier 0.19 has no `InteractionGroups(a, b)` constructor —
 * the type is a plain packed number — so this helper keeps call sites readable.
 */
export function interactionGroups(memberships: number, filter: number): RAPIER.InteractionGroups {
  return (memberships << 16) | filter;
}

/** Default query groups: pieces only. A ray/overlap with these groups skips the
 *  player capsule while still hitting pieces and the ground. */
const PIECE_QUERY_GROUPS: RAPIER.InteractionGroups = interactionGroups(PIECES_GROUP, PIECES_GROUP);

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

  /**
   * Creates a dynamic body at `position` with the given collider attached and
   * auto-sleep enabled, so resting pieces stop simulating (velocity → 0). The
   * collider collides with pieces and with the player (solver keeps the
   * contact) but the player still cannot push it: the character controller
   * keeps `applyImpulsesToDynamicBodies(false)`.
   */
  createDynamicBody(
    collider: RAPIER.ColliderDesc,
    position: RAPIER.Vector = { x: 0, y: 0, z: 0 },
  ): RAPIER.RigidBody {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z)
        .setCanSleep(true),
    );
    this.world.createCollider(
      collider.setCollisionGroups(interactionGroups(PIECES_GROUP, PLAYER_GROUP | PIECES_GROUP)),
      body,
    );
    return body;
  }

  /**
   * Raycast helper over `castRayAndGetNormal` returning the hit point, face
   * normal and collider of the first hit within `maxDist`. `dir` must be
   * normalized so the point (`origin + dir · toi`) lands on the surface.
   * Default query groups (pieces only) exclude the player capsule.
   */
  castRayAndGetNormal(
    origin: RAPIER.Vector,
    dir: RAPIER.Vector,
    maxDist: number,
    groups: RAPIER.InteractionGroups = PIECE_QUERY_GROUPS,
  ): { hit: boolean; point: RAPIER.Vector; normal: RAPIER.Vector; collider?: RAPIER.Collider } {
    const hit = this.world.castRayAndGetNormal(new RAPIER.Ray(origin, dir), maxDist, true, undefined, groups);
    if (hit === null) {
      return { hit: false, point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 0 } };
    }
    return {
      hit: true,
      point: {
        x: origin.x + dir.x * hit.timeOfImpact,
        y: origin.y + dir.y * hit.timeOfImpact,
        z: origin.z + dir.z * hit.timeOfImpact,
      },
      normal: hit.normal,
      collider: hit.collider,
    };
  }

  /**
   * Reports whether the given shape pose overlaps any collider in the query
   * groups. Placement uses this to reject ghost poses intersecting existing
   * pieces or the ground. Implemented on `intersectionWithShape` (a plain
   * overlap query) because `castShape` returns no hits at all on
   * rapier3d-compat 0.19.3 — a build quirk verified empirically.
   */
  castShapeOverlap(
    shape: RAPIER.Shape,
    pos: RAPIER.Vector,
    rot: RAPIER.Quaternion,
    groups: RAPIER.InteractionGroups = PIECE_QUERY_GROUPS,
  ): boolean {
    return this.world.intersectionWithShape(pos, rot, shape, undefined, groups) !== null;
  }

  registerPieceCollider(collider: RAPIER.Collider): void {
    this.pieceColliders.add(collider);
  }

  /** Removes a piece collider from the registry (called by `Piece.dispose`). */
  unregisterPieceCollider(collider: RAPIER.Collider): void {
    this.pieceColliders.delete(collider);
  }

  isPieceCollider(collider: RAPIER.Collider): boolean {
    return this.pieceColliders.has(collider);
  }

  dispose(): void {
    this.world.free();
  }

  /** Colliders of placed pieces, used to tell piece hits from ground hits. */
  private readonly pieceColliders = new Set<RAPIER.Collider>();
}
