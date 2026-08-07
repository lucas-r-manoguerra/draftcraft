/**
 * Pure snap math for piece placement — no Rapier, no three.js.
 *
 * A piece is modeled by its half-extents and a flat quaternion. The support
 * extent along a face normal is the rotation-invariant sum
 * `Σ |dot(rotAxis_i, n)| · half_i`, so placing a piece at
 * `hitPoint + n · supportExtent` rests its face exactly flush on the target.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Flat quaternion representation (keeps this module dependency-free). */
export interface QuatSimple {
  x: number;
  y: number;
  z: number;
  w: number;
}

const CM = 0.01;

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/** Rotates a vector by a quaternion: v' = v + 2·w·(q×v) + 2·q×(q×v). */
function rotate(q: QuatSimple, v: Vec3): Vec3 {
  const cx = q.y * v.z - q.z * v.y;
  const cy = q.z * v.x - q.x * v.z;
  const cz = q.x * v.y - q.y * v.x;
  const tx = 2 * cx;
  const ty = 2 * cy;
  const tz = 2 * cz;
  const wx = q.y * tz - q.z * ty;
  const wy = q.z * tx - q.x * tz;
  const wz = q.x * ty - q.y * tx;
  return {
    x: v.x + q.w * tx + wx,
    y: v.y + q.w * ty + wy,
    z: v.z + q.w * tz + wz,
  };
}

/**
 * Signed distance from the piece center to the supporting plane along `n`,
 * i.e. how far the center must sit from the face so the piece touches flush.
 * Rotation-invariant: rotating the piece around any axis keeps the offset for
 * a face contact equal to the half extent along that face's axis.
 */
export function supportExtent(half: Vec3, rot: QuatSimple, n: Vec3): number {
  const rx = rotate(rot, { x: 1, y: 0, z: 0 });
  const ry = rotate(rot, { x: 0, y: 1, z: 0 });
  const rz = rotate(rot, { x: 0, y: 0, z: 1 });
  return (
    Math.abs(dot(rx, n)) * half.x +
    Math.abs(dot(ry, n)) * half.y +
    Math.abs(dot(rz, n)) * half.z
  );
}

/**
 * Pose for a piece resting flush on the hit face: the face point pushed out
 * along the normal by the support extent. Never rounds to a grid, so the
 * exact 0.115 m brick height survives face snapping.
 */
export function snapToFace(hitPoint: Vec3, normal: Vec3, half: Vec3, rot: QuatSimple): Vec3 {
  const offset = supportExtent(half, rot, normal);
  return {
    x: hitPoint.x + normal.x * offset,
    y: hitPoint.y + normal.y * offset,
    z: hitPoint.z + normal.z * offset,
  };
}

/**
 * Rounds a position to whole centimeters (0.01 m). Only for free placement —
 * the cm grid cannot represent 0.115 m, so face snapping never uses it.
 */
export function roundToCm(v: Vec3): Vec3 {
  return {
    x: Math.round(v.x / CM) * CM,
    y: Math.round(v.y / CM) * CM,
    z: Math.round(v.z / CM) * CM,
  };
}
