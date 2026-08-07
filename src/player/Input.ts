import * as THREE from "three";

/**
 * Centralizes every input the game cares about: WASD+Space keyboard, mouse
 * deltas (only meaningful while the pointer is locked), scroll-wheel zoom,
 * pointer-lock lifecycle and build actions (place/remove/rotate/select).
 * Keeps no game or camera knowledge.
 */
export class Input {
  private readonly keys = new Set<string>();
  private readonly lookDelta = new THREE.Vector2();
  private readonly movement = new THREE.Vector2();
  private wheelDelta = 0;
  private jumpQueued = false;
  private placeQueued = false;
  private removeQueued = false;
  private rotateQueued = false;
  private selectQueued = false;
  private locked = false;
  private readonly canvas: HTMLCanvasElement;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly onLockChange?: (locked: boolean) => void,
  ) {
    this.canvas = canvas;
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    canvas.addEventListener("click", this.handleClick);
    document.addEventListener("pointerlockchange", this.handlePointerLockChange);
    document.addEventListener("mousemove", this.handleMouseMove);
    document.addEventListener("mousedown", this.handleMouseDown);
    canvas.addEventListener("contextmenu", this.handleContextMenu);
    document.addEventListener("wheel", this.handleWheel, { passive: false });
  }

  get isLocked(): boolean {
    return this.locked;
  }

  requestPointerLock(): void {
    this.canvas.requestPointerLock();
  }

  /**
   * Normalized WASD direction. x: +1 = right (D), y: +1 = forward (W).
   */
  readMovement(): THREE.Vector2 {
    this.movement.set(0, 0);
    if (this.keys.has("KeyW")) this.movement.y += 1;
    if (this.keys.has("KeyS")) this.movement.y -= 1;
    if (this.keys.has("KeyA")) this.movement.x -= 1;
    if (this.keys.has("KeyD")) this.movement.x += 1;
    if (this.movement.lengthSq() > 0) this.movement.normalize();
    return this.movement;
  }

  /** Edge-triggered jump intent: true once per Space press until consumed. */
  consumeJump(): boolean {
    const queued = this.jumpQueued;
    this.jumpQueued = false;
    return queued;
  }

  /** Edge-triggered place intent: true once per LMB press while locked. */
  consumePlace(): boolean {
    const queued = this.placeQueued;
    this.placeQueued = false;
    return queued;
  }

  /** Edge-triggered remove intent: true once per RMB press. */
  consumeRemove(): boolean {
    const queued = this.removeQueued;
    this.removeQueued = false;
    return queued;
  }

  /** Edge-triggered rotate intent: true once per R press. */
  consumeRotate(): boolean {
    const queued = this.rotateQueued;
    this.rotateQueued = false;
    return queued;
  }

  /** Edge-triggered catalog select intent: true once per Q press. */
  consumeSelect(): boolean {
    const queued = this.selectQueued;
    this.selectQueued = false;
    return queued;
  }

  consumeLook(out: THREE.Vector2): THREE.Vector2 {
    out.set(this.lookDelta.x, this.lookDelta.y);
    this.lookDelta.set(0, 0);
    return out;
  }

  consumeWheel(): number {
    const delta = this.wheelDelta;
    this.wheelDelta = 0;
    return delta;
  }

  dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.canvas.removeEventListener("click", this.handleClick);
    document.removeEventListener("pointerlockchange", this.handlePointerLockChange);
    document.removeEventListener("mousemove", this.handleMouseMove);
    document.removeEventListener("mousedown", this.handleMouseDown);
    this.canvas.removeEventListener("contextmenu", this.handleContextMenu);
    document.removeEventListener("wheel", this.handleWheel);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Space") {
      if (!event.repeat) this.jumpQueued = true;
      event.preventDefault();
      return;
    }
    if (event.code === "KeyR" && !event.repeat) {
      this.rotateQueued = true;
    }
    if (event.code === "KeyQ" && !event.repeat) {
      this.selectQueued = true;
    }
    if (event.code.startsWith("Key")) {
      this.keys.add(event.code);
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (event.code === "Space") return;
    this.keys.delete(event.code);
  };

  private readonly handleClick = (): void => {
    if (!this.locked) {
      this.canvas.requestPointerLock();
    }
  };

  private readonly handlePointerLockChange = (): void => {
    this.locked = document.pointerLockElement === this.canvas;
    this.onLockChange?.(this.locked);
  };

  private readonly handleMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement !== this.canvas) return;
    this.lookDelta.x += event.movementX;
    this.lookDelta.y += event.movementY;
  };

  /**
   * Build buttons. LMB only while locked: an unlocked LMB is the pointer-lock
   * request (see `handleClick`), so placement never fires from that click.
   * RMB removes regardless of lock; the browser context menu is suppressed by
   * `handleContextMenu` so the removal click has no side effects.
   */
  private readonly handleMouseDown = (event: MouseEvent): void => {
    if (event.button === 0 && this.locked) {
      this.placeQueued = true;
    } else if (event.button === 2) {
      this.removeQueued = true;
    }
  };

  private readonly handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.wheelDelta += event.deltaY;
  };
}
