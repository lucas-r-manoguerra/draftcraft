export const FIXED_TIMESTEP = 1 / 60;

/** Maximum wall-clock frame delta processed per frame, prevents spiral of death. */
const MAX_FRAME_DELTA = 0.1;

/**
 * Fixed-timestep game loop. Physics (and anything physics-coupled) runs at a
 * fixed 1/60 steps accumulated from wall-clock time; rendering runs once per
 * requestAnimationFrame.
 */
export class GameLoop {
  private accumulator = 0;
  private lastTime = 0;
  private rafHandle = 0;
  private running = false;

  onFixedUpdate: (dt: number) => void = () => undefined;
  onRender: () => void = () => undefined;

  start(): void {
    if (this.running) return;
    this.running = true;
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.rafHandle = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafHandle);
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;

    const frameDelta = Math.min((now - this.lastTime) / 1000, MAX_FRAME_DELTA);
    this.lastTime = now;
    this.accumulator += frameDelta;

    while (this.accumulator >= FIXED_TIMESTEP) {
      this.onFixedUpdate(FIXED_TIMESTEP);
      this.accumulator -= FIXED_TIMESTEP;
    }

    this.onRender();
    this.rafHandle = requestAnimationFrame(this.frame);
  };
}
