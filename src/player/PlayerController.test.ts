import { test, expect, beforeAll } from "bun:test";
import * as RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { Physics } from "../engine/Physics";
import { Ground } from "../world/Ground";
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

function buildWorld(): { physics: Physics; player: PlayerController } {
  const physics = new Physics();
  const scene = new THREE.Scene();
  new Ground(physics, scene);
  return { physics, player: new PlayerController(physics, scene) };
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
