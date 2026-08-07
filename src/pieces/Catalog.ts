/**
 * Static piece catalog: the four building pieces this milestone supports.
 *
 * Dimensions are stored in integer millimeters and meter values are always
 * derived as `mm / 1000` — never written as floating-point literals — so
 * 115 mm yields exactly 0.115 m with no drift and no cm-grid approximation.
 */

export interface PieceDef {
  id: string;
  name: string;
  dimsMm: [number, number, number];
  meters: [number, number, number];
}

/** Derives meter dimensions from integer millimeters (mm / 1000). */
function meters(mm: [number, number, number]): [number, number, number] {
  const [x, y, z] = mm;
  return [x / 1000, y / 1000, z / 1000];
}

export const PIECE_CATALOG: PieceDef[] = [
  { id: "brick", name: "Brick", dimsMm: [240, 115, 52], meters: meters([240, 115, 52]) },
  { id: "block", name: "Block", dimsMm: [400, 200, 200], meters: meters([400, 200, 200]) },
  { id: "beam", name: "Beam", dimsMm: [2400, 100, 100], meters: meters([2400, 100, 100]) },
  { id: "plank", name: "Plank", dimsMm: [2400, 200, 25], meters: meters([2400, 200, 25]) },
];

/**
 * Stateful selection over the catalog.
 *
 * `select(pressed)` is edge-triggered: it advances the selection exactly once
 * per rising edge of the input. Holding the input across frames never repeats,
 * mirroring the `consume*` pattern used elsewhere in the project.
 */
export class PieceCatalog {
  private index = 0;
  private wasPressed = false;

  get selected(): PieceDef {
    return PIECE_CATALOG[this.index] ?? PIECE_CATALOG[0]!;
  }

  select(pressed: boolean): void {
    if (pressed && !this.wasPressed) {
      this.index = (this.index + 1) % PIECE_CATALOG.length;
    }
    this.wasPressed = pressed;
  }
}
