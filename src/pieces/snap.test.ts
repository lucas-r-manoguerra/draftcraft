import { describe, expect, test } from "bun:test";
import { roundToCm, snapToFace, supportExtent, type QuatSimple, type Vec3 } from "./snap";

const IDENTITY: QuatSimple = { x: 0, y: 0, z: 0, w: 1 };
const Y_90: QuatSimple = { x: 0, y: Math.sin(Math.PI / 4), z: 0, w: Math.cos(Math.PI / 4) };

/** Brick 240×115×52 mm — half extents in meters (115 mm is not an integer-cm dimension). */
const BRICK_HALF: Vec3 = { x: 0.12, y: 0.0575, z: 0.026 };
const UP: Vec3 = { x: 0, y: 1, z: 0 };
const SIDE_X: Vec3 = { x: 1, y: 0, z: 0 };

describe("supportExtent", () => {
  test("identity: offset equals the half extent along the face normal", () => {
    expect(supportExtent(BRICK_HALF, IDENTITY, UP)).toBeCloseTo(0.0575, 12);
    expect(supportExtent(BRICK_HALF, IDENTITY, SIDE_X)).toBeCloseTo(0.12, 12);
  });

  test("90° rotation around Y is invariant for top-face contact", () => {
    const identity = supportExtent(BRICK_HALF, IDENTITY, UP);
    expect(supportExtent(BRICK_HALF, Y_90, UP)).toBeCloseTo(identity, 12);
  });

  test("side contact follows the rotated axis (z half faces +x after 90°)", () => {
    expect(supportExtent(BRICK_HALF, Y_90, SIDE_X)).toBeCloseTo(0.026, 12);
  });
});

describe("snapToFace", () => {
  test("places a new brick flush on a top face without cm rounding", () => {
    // Existing brick resting on the ground: its top face sits at y = 0.0575.
    const hitPoint: Vec3 = { x: 0, y: 0.0575, z: 0 };
    const result = snapToFace(hitPoint, UP, BRICK_HALF, IDENTITY);
    // Bottom of the new brick rests exactly on the face.
    expect(result.y - BRICK_HALF.y).toBeCloseTo(hitPoint.y, 12);
    // The exact 115 mm height is preserved — 0.115 m, never a cm-rounded 0.12.
    expect(result.y).toBeCloseTo(0.115, 12);
    expect(result.y).not.toBe(0.12);
    expect(result.x).toBeCloseTo(0, 12);
    expect(result.z).toBeCloseTo(0, 12);
  });

  test("top-face flush offset is invariant under 90° rotation", () => {
    const hitPoint: Vec3 = { x: 1, y: 0.0575, z: 2 };
    const flat = snapToFace(hitPoint, UP, BRICK_HALF, IDENTITY);
    const rotated = snapToFace(hitPoint, UP, BRICK_HALF, Y_90);
    expect(rotated.y).toBeCloseTo(flat.y, 12);
  });
});

describe("roundToCm", () => {
  test("rounds free-placement coordinates to whole centimeters", () => {
    const rounded = roundToCm({ x: 1.234, y: 0.567, z: 0.111 });
    expect(rounded.x).toBeCloseTo(1.23, 12);
    expect(rounded.y).toBeCloseTo(0.57, 12);
    expect(rounded.z).toBeCloseTo(0.11, 12);
  });

  test("cm grid cannot hold 0.115 m (why face snap never uses it)", () => {
    expect(roundToCm({ x: 0.115, y: 0, z: 0 }).x).toBeCloseTo(0.12, 12);
  });
});
