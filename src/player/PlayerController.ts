import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import { Physics } from "../engine/Physics";
/** Input surface PlayerController depends on. Satisfied structurally by
 *  Input; kept narrow so the controller is testable without DOM. */
export interface PlayerInput {
  readMovement(): THREE.Vector2;
  consumeJump(): boolean;
}

const WALK_SPEED = 1.4;
const GRAVITY = 9.81;
/** Vertical launch speed giving a ~0.46m human-like jump (v^2 / 2g). */
const JUMP_SPEED = 3.0;
const MAX_FALL_SPEED = 12;
/**
 * Small downward velocity kept while grounded so the controller's ground
 * probe keeps contact detection active without accumulating unbounded fall.
 */
const GROUNDED_PROBE_SPEED = -0.5;
export const CAPSULE_RADIUS = 0.3;
/** Half height of the capsule's cylindrical section. Total capsule height is
 *  2 * (halfHeight + radius) = 1.8m, a real human. */
export const CAPSULE_HALF_HEIGHT = 0.6;
/** Eye offset from the body origin (capsule center, 0.9m above ground) so the
 *  camera orbits a real human eye height of 1.6m. */
const EYE_HEIGHT = 0.7;
/** Extra clearance above the floor for spawning. A kinematic collider born in
 *  exact contact with the ground can fail to resolve and tunnel through it;
 *  falling the last few centimeters guarantees the controller detects contact. */
const SPAWN_CLEARANCE = 0.5;
/** Spawn height of the body origin (capsule center). */
export const SPAWN_Y = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS + SPAWN_CLEARANCE;
/** If the body ever ends up below this height it is lost — respawn at spawn. */
export const KILL_FLOOR_Y = -20;

const PLAYER_COLOR = 0xe05d5d;

/**
 * Player driven by Rapier's kinematic character controller: a capsule moved by
 * hit-and-slide against the world. Movement direction comes from input combined
 * with the camera yaw; the body is teleported along the controller's computed
 * movement each fixed step. Jump is manual vertical-velocity integration
 * because rapier 0.19 exposes no setJump on the character controller.
 */
export class PlayerController {
  readonly mesh: THREE.Mesh;

  private readonly body: RAPIER.RigidBody;
  private readonly collider: RAPIER.Collider;
  private readonly controller: RAPIER.KinematicCharacterController;

  private readonly eye = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();

  private verticalVelocity = 0;
  private grounded = false;

  constructor(physics: Physics, scene: THREE.Scene) {
    this.body = physics.createKinematicBody({ x: 0, y: SPAWN_Y, z: 0 });
    this.collider = physics.createCapsuleCollider(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS, this.body);

    this.controller = physics.world.createCharacterController(0.02);
    this.controller.setUp({ x: 0, y: 1, z: 0 });
    this.controller.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(30));
    this.controller.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(15));
    this.controller.enableAutostep(0.2, 0.3, true);
    this.controller.enableSnapToGround(0.3);
    this.controller.setApplyImpulsesToDynamicBodies(false);

    const geometry = new THREE.CapsuleGeometry(CAPSULE_RADIUS, CAPSULE_HALF_HEIGHT * 2, 8, 12);
    const material = new THREE.MeshStandardMaterial({ color: PLAYER_COLOR });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    scene.add(this.mesh);
  }

  /** Current height of the body origin (capsule center). */
  get bodyY(): number {
    return this.body.translation().y;
  }

  /** Teleport the body back to the spawn point and zero vertical velocity. */
  respawn(): void {
    this.verticalVelocity = 0;
    this.grounded = false;
    this.body.setTranslation({ x: 0, y: SPAWN_Y, z: 0 }, true);
  }

  /** Teleport the body to an arbitrary position (debug/testing convenience). */
  teleport(x: number, y: number, z: number): void {
    this.body.setTranslation({ x, y, z }, true);
  }

  /** Eye-level point used as the camera orbit target. */
  get eyePosition(): THREE.Vector3 {
    const translation = this.body.translation();
    return this.eye.set(translation.x, translation.y + EYE_HEIGHT, translation.z);
  }

  update(dt: number, yaw: number, input: PlayerInput): void {
    // Safety net: a body below the world is lost — teleport back to spawn
    // instead of falling forever.
    if (this.body.translation().y < KILL_FLOOR_Y) {
      this.respawn();
    }

    const move = input.readMovement();

    this.forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    this.right.set(Math.cos(yaw), 0, -Math.sin(yaw));

    this.desired
      .set(0, 0, 0)
      .addScaledVector(this.forward, move.y)
      .addScaledVector(this.right, move.x)
      .multiplyScalar(WALK_SPEED * dt);

    if (input.consumeJump() && this.grounded) {
      this.verticalVelocity = JUMP_SPEED;
    }

    this.verticalVelocity -= GRAVITY * dt;
    this.verticalVelocity = Math.max(this.verticalVelocity, -MAX_FALL_SPEED);
    if (this.grounded && this.verticalVelocity < 0) {
      this.verticalVelocity = GROUNDED_PROBE_SPEED;
    }
    this.desired.y = this.verticalVelocity * dt;

    this.controller.computeColliderMovement(this.collider, this.desired);
    this.grounded = this.controller.computedGrounded();

    const movement = this.controller.computedMovement();
    const translation = this.body.translation();
    this.body.setTranslation(
      {
        x: translation.x + movement.x,
        y: translation.y + movement.y,
        z: translation.z + movement.z,
      },
      true,
    );
  }

  syncMesh(): void {
    const translation = this.body.translation();
    this.mesh.position.set(translation.x, translation.y, translation.z);
  }
}
