import { test, expect, beforeAll } from "bun:test";
import * as RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { Physics } from "../engine/Physics";
import { Ground } from "../world/Ground";
import { PIECE_CATALOG } from "../pieces/Catalog";
import { Piece } from "../pieces/Piece";
import {
  CAPSULE_HALF_HEIGHT,
  CAPSULE_RADIUS,
  PlayerController,
  SPAWN_Y,
  type PlayerInput,
} from "./PlayerController";

const IDLE_INPUT: PlayerInput = {
  readMovement: () => new THREE.Vector2(0, 0),
  consumeJump: () => false,
};

beforeAll(async () => {
  await RAPIER.init();
});

function buildWorld(): { physics: Physics; player: PlayerController; scene: THREE.Scene } {
  const physics = new Physics();
  const scene = new THREE.Scene();
  new Ground(physics, scene);
  return { physics, player: new PlayerController(physics, scene), scene };
}

/** Y of the capsule base (bottom of the feet). */
function feetY(player: PlayerController): number {
  return player.bodyY - (CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS);
}

test("spawns clear of the ground (regression: capsule tunneled through floor)", () => {
  const { player } = buildWorld();
  expect(feetY(player)).toBeGreaterThan(0);
});

test("never falls through the floor while idling for 3 seconds", () => {
  const { physics, player } = buildWorld();
  for (let i = 0; i < 180; i++) {
    player.update(1 / 60, 0, IDLE_INPUT);
    physics.step();
    player.syncMesh();
    expect(feetY(player)).toBeGreaterThanOrEqual(-0.01);
  }
  expect(feetY(player)).toBeLessThan(0.05);
});

test("kill floor respawns a lost body instead of falling forever", () => {
  const { physics, player } = buildWorld();
  player.teleport(0, -50, 0);
  player.update(1 / 60, 0, IDLE_INPUT);
  physics.step();
  expect(player.bodyY).toBeCloseTo(SPAWN_Y, 1);
});

test("pushing is disabled: the player does not shove a placed piece (piece-physics spec)", () => {
  const { physics, player, scene } = buildWorld();
  // A block resting on the ground directly in front of the player (z negative
  // is forward at yaw 0). Block def is 0.4 x 0.2 x 0.2 m, so its center sits
  // 0.1 m above the floor.
  const piece = new Piece(physics, scene, PIECE_CATALOG[1]!, { x: 0, y: 0.1, z: -1 });
  const WALK_INTO_PIECE: PlayerInput = {
    readMovement: () => new THREE.Vector2(0, 1),
    consumeJump: () => false,
  };

  // Walk straight into the piece for one second.
  for (let i = 0; i < 60; i++) {
    player.update(1 / 60, 0, WALK_INTO_PIECE);
    physics.step();
    player.syncMesh();
  }

  // The piece is dynamic but the character controller has
  // applyImpulsesToDynamicBodies(false): it must stay at rest, not be shoved.
  const velocity = piece.body.linvel();
  expect(Math.hypot(velocity.x, velocity.y, velocity.z)).toBeLessThan(0.05);

  piece.dispose();
});
