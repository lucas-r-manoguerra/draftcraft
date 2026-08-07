import * as THREE from "three";

const DEFAULT_DISTANCE = 4;
const MIN_DISTANCE = 1.5;
const MAX_DISTANCE = 8;
const MIN_PITCH = -0.3;
const MAX_PITCH = 1.0;
const MOUSE_SENSITIVITY = 0.002;
const WHEEL_SENSITIVITY = 0.001;

/**
 * Third-person orbital camera. Accumulates yaw/pitch from mouse deltas and
 * distance from the scroll wheel, then places the camera on a sphere around
 * the target (player eye position). No camera collision yet.
 */
export class CameraController {
  private yaw = 0;
  private pitch = 0.35;
  private distance = DEFAULT_DISTANCE;
  private readonly position = new THREE.Vector3();
  private readonly target = new THREE.Vector3();

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  get yawValue(): number {
    return this.yaw;
  }

  update(look: THREE.Vector2, wheelDelta: number, target: THREE.Vector3): void {
    this.yaw -= look.x * MOUSE_SENSITIVITY;
    this.pitch = THREE.MathUtils.clamp(this.pitch - look.y * MOUSE_SENSITIVITY, MIN_PITCH, MAX_PITCH);
    this.distance = THREE.MathUtils.clamp(
      this.distance * (1 + wheelDelta * WHEEL_SENSITIVITY),
      MIN_DISTANCE,
      MAX_DISTANCE,
    );

    this.target.copy(target);
    const cosPitch = Math.cos(this.pitch);
    this.position.set(
      this.target.x + this.distance * cosPitch * Math.sin(this.yaw),
      this.target.y + this.distance * Math.sin(this.pitch),
      this.target.z + this.distance * cosPitch * Math.cos(this.yaw),
    );
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.target);
  }
}
