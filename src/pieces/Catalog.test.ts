import { describe, expect, test } from "bun:test";
import { PIECE_CATALOG, PieceCatalog } from "./Catalog";

/** The four pieces this milestone defines, in integer millimeters. */
const EXPECTED_DIMS: Record<string, [number, number, number]> = {
  brick: [240, 115, 52],
  block: [400, 200, 200],
  beam: [2400, 100, 100],
  plank: [2400, 200, 25],
};

describe("PIECE_CATALOG", () => {
  test("contains exactly the four defined pieces with integer-mm dims", () => {
    expect(PIECE_CATALOG).toHaveLength(4);
    const ids = PIECE_CATALOG.map((piece) => piece.id).sort();
    expect(ids).toEqual(["beam", "block", "brick", "plank"]);
    for (const piece of PIECE_CATALOG) {
      expect(piece.dimsMm).toEqual(EXPECTED_DIMS[piece.id]!);
      for (const dim of piece.dimsMm) {
        expect(Number.isInteger(dim)).toBe(true);
      }
    }
  });

  test("derives meters as dimsMm / 1000 with no float-literal drift", () => {
    for (const piece of PIECE_CATALOG) {
      const [mx, my, mz] = piece.meters;
      const [dx, dy, dz] = piece.dimsMm;
      expect(mx).toBe(dx / 1000);
      expect(my).toBe(dy / 1000);
      expect(mz).toBe(dz / 1000);
    }
    // 115 mm must be exactly 0.115 m — never a cm-rounded approximation.
    const brick = PIECE_CATALOG.find((piece) => piece.id === "brick")!;
    expect(brick.meters[1]).toBe(0.115);
    expect(brick.meters[1]).not.toBe(0.12);
  });
});

describe("PieceCatalog selection", () => {
  test("starts on the brick and advances one piece per press", () => {
    const catalog = new PieceCatalog();
    expect(catalog.selected.id).toBe("brick");
    catalog.select(true);
    // Placement uses the selected piece's dimensions.
    expect(catalog.selected.id).toBe("block");
    expect(catalog.selected.dimsMm).toEqual([400, 200, 200]);
  });

  test("holding the input advances exactly once across many frames", () => {
    const catalog = new PieceCatalog();
    // Several frames pass while the selection input stays held.
    for (let i = 0; i < 10; i++) catalog.select(true);
    expect(catalog.selected.id).toBe("block");
  });

  test("cycles through all four pieces and wraps around", () => {
    const catalog = new PieceCatalog();
    const press = () => {
      catalog.select(true);
      catalog.select(false); // release between presses
    };
    press(); // brick -> block
    press(); // block -> beam
    press(); // beam -> plank
    press(); // plank -> brick
    expect(catalog.selected.id).toBe("brick");
  });

  test("re-pressing after release advances again (edge re-trigger)", () => {
    const catalog = new PieceCatalog();
    catalog.select(true);
    catalog.select(false); // released
    catalog.select(true); // new press: a fresh edge
    expect(catalog.selected.id).toBe("beam");
  });
});
