import * as THREE from "three";
import * as RAPIER from "@dimforge/rapier3d-compat";
import { Engine } from "./engine/Engine";
import { Physics } from "./engine/Physics";
import { GameLoop } from "./engine/GameLoop";
import { Ground } from "./world/Ground";
import { Input } from "./player/Input";
import { PlayerController } from "./player/PlayerController";
import { CameraController } from "./player/CameraController";
import { PlacementController } from "./pieces/PlacementController";

async function boot(): Promise<void> {
  await RAPIER.init();

  const canvas = document.getElementById("game-canvas");
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Missing <canvas id="game-canvas"> element');
  }
  const overlay = document.getElementById("overlay");

  const engine = new Engine(canvas);
  const physics = new Physics();
  const input = new Input(canvas, (locked) => {
    overlay?.classList.toggle("hidden", locked);
  });

  new Ground(physics, engine.scene);
  const player = new PlayerController(physics, engine.scene);
  const camera = new CameraController(engine.camera);
  const placement = new PlacementController(physics, engine.scene);

  const look = new THREE.Vector2();
  const loop = new GameLoop();

  loop.onFixedUpdate = (dt: number): void => {
    // Aim→ghost→place/rotate/remove must run before stepping so placements
    // settle in the same fixed step that created them. The aim ray starts at
    // the player eye (third person), not at the orbiting camera.
    placement.update(dt, input, engine.camera, player.eyePosition);
    player.update(dt, camera.yawValue, input);
    physics.step();
  };

  loop.onRender = (): void => {
    player.syncMesh();
    const wheel = input.consumeWheel();
    input.consumeLook(look);
    camera.update(look, wheel, player.eyePosition);
    engine.render();
  };

  loop.start();
}

boot().catch((error: unknown) => {
  console.error("Failed to start DraftCraft", error);
});
