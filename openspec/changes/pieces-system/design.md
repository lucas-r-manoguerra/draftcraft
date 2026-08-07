# Design: Pieces System — Real-Dimension Building

## Technical Approach

A static catalog (integer-mm) feeds a `PlacementController`: raycast from camera → ghost preview → face snap via rotation-invariant support offset → overlap validation → place/rotate/remove via edge-triggered input. `Physics` gains thin helpers and collision groups (player=1, pieces=2). Snap math lives in `snap.ts` without Rapier; physics reuses `buildWorld` + fixed-step tests. Covers the three specs.

## Architecture Decisions

| # | Decision | Options (tradeoff) | Choice |
|---|----------|--------------------|--------|
| 1 | Raycast source | three.js knows meshes, not colliders; Rapier returns point + normal + collider handle (tagging, removal) | Rapier `castRayAndGetNormal` |
| 2 | Face-target criterion | Normal-angle can't split ground vs piece tops; hit-height fragile at y=0. Identity is exact | `isPieceCollider(hit.collider)`: ground ⇒ cm rounding; piece ⇒ flush snap |
| 3 | Snap model | cm grid can't hold 0.115 m (proposal); voxel grid fits poorly. Support function `Σ\|dot(rotAxis_i,n)\|·half_i` is rotation-invariant | Face snap; cm rounding ONLY on ground target |
| 4 | Piece body | Kinematic can't settle on stacks; dynamic + auto-sleep rests and sleeps (velocity→0). Jitter mitigated by sleep; kinematic fallback per proposal | Dynamic + `setCanSleep(true)` |
| 5 | Player↔piece collision | Walk-through breaks climbing blocks; impulses let player push (out of scope). Collide without impulses: climbs via autostep, never pushes | Player (1, 1\|2), pieces (2, 1\|2); rays use (2,2) ⇒ exclude player |
| 6 | Dimension units | Float meters cannot hold 0.115 m exactly; mm÷1000 derives exactly | Integer mm; meters = `mm/1000`, no float literals |
| 7 | Rotation | Y-only quaternion: vertical axis preserved, 4 presses = identity | `quat.multiply(quat-Y(π/2))` per press |
| 8 | Bindings | Click requests pointer-lock, so LMB placement only while locked | LMB (locked) place · RMB remove · R rotate · Q select; `consume*` + `!repeat`; `contextmenu` preventDefault |

## Data Flow

Placement (fixed step):

```
Input LMB ─▶ PlacementController.update
  ├─▶ ray = camera.position + forward, 5 m
  ├─▶ Physics.castRayAndGetNormal(origin, dir, 5, groups(2,2))
  │     ├─ hit piece → snapToFace ──┐
  │     └─ hit ground → + roundToCm ─┴─▶ ghost pose
  ├─▶ Physics.castShapeOverlap(shape, pose, (2,2)) → ghost invalid(red)/valid(green)
  ├─▶ consumePlace && valid → Piece.create(physics, scene, pose) → registerPieceCollider
  └─▶ consumeRotate → rot·π/2 · consumeSelect → next catalog entry
```

Removal:

```
RMB/contextmenu → consumeRemove ─▶ aim ray ─▶ hit && isPieceCollider
  ─▶ find piece by collider handle ─▶ Piece.dispose()
  → removeRigidBody (frees collider) + scene.remove(mesh) + dispose geometry/material
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/pieces/Catalog.ts` | Create | 4 pieces, integer-mm dims, `meters(mm)`, edge-triggered `select()` |
| `src/pieces/snap.ts` | Create | `supportExtent`, `snapToFace`, `roundToCm` — pure, no Rapier |
| `src/pieces/Piece.ts` | Create | Dynamic body + cuboid collider + mesh; `dispose()` |
| `src/pieces/PlacementController.ts` | Create | Aim→ghost→validate→place→rotate→remove; `dispose()` |
| `src/engine/Physics.ts` | Modify | `createDynamicBody`, `castRayAndGetNormal`, `castShapeOverlap` (STOP_AT_PENETRATION), piece registry, group consts |
| `src/player/Input.ts` | Modify | `consumePlace/Rotate/Remove/Select`, mousedown, `contextmenu` preventDefault |
| `src/main.ts` | Modify | Wire controller into `onFixedUpdate` |
| `src/pieces/{Catalog,snap,PlacementController}.test.ts` | Create | New suites |

## Interfaces / Contracts

```ts
// engine/Physics.ts — thin wrappers, existing style
createDynamicBody(collider: RAPIER.ColliderDesc, pos: RAPIER.Vector): RAPIER.RigidBody;
// dynamic + setCanSleep(true); collider groups (PIECES, PLAYER | PIECES)
castRayAndGetNormal(origin: V, dir: V, maxDist: number,
  groups?: RAPIER.InteractionGroups): { hit: boolean; point: V; normal: V; collider?: RAPIER.Collider };
// groups default (PIECES, PIECES) → excludes player
castShapeOverlap(shape: RAPIER.Shape, pos: V, rot: RAPIER.Quaternion,
  groups?: RAPIER.InteractionGroups): boolean; // castShape(…, STOP_AT_PENETRATION)
registerPieceCollider(c: RAPIER.Collider): void;
isPieceCollider(c: RAPIER.Collider): boolean;

// pieces/snap.ts — pure
supportExtent(half: V3, rot: Quat, n: V3): number;   // Σ |dot(rotAxis_i, n)|·half_i
snapToFace(hitPoint: V3, normal: V3, half: V3, rot: Quat): V3; // hitPoint + n·supportExtent
roundToCm(v: V3): V3;                                 // round(v/0.01)·0.01

// pieces/PlacementController.ts
update(dt: number, input: BuildInput, camera: THREE.PerspectiveCamera): void;
interface BuildInput { consumePlace(): boolean; consumeRotate(): boolean;
  consumeRemove(): boolean; consumeSelect(): boolean; }
```

Player capsule: `setCollisionGroups(InteractionGroups(PLAYER, PLAYER | PIECES))` — solver keeps player↔piece contact; ray groups (2,2) exclude the player.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit (no Rapier) | `snap.test.ts`: supportExtent (identity/90°), flush top-face, cm rounding keeps 0.115; `Catalog.test.ts`: 4 pieces, mm invariant, meters = mm/1000, single-step selection | Pure math on plain objects |
| Integration (Rapier) | `PlacementController.test.ts`: piece sleeps (velocity→0), stack no interpenetration, ray excludes player, overlap blocks, removal frees, 4 rotations = identity | `buildWorld()` + `physics.step()`, `beforeAll(RAPIER.init())` — mirrors PlayerController.test.ts |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. Only DOM events change; `contextmenu` preventDefault is a browser event.

## Migration / Rollout

No migration required. Implement on `feature/pieces-system` from `main d7b3e6e`; rollback per proposal.

## Open Questions

- [ ] Confirm proposed bindings (Q select, R rotate, LMB place while pointer-locked, RMB remove) — non-blocking, overridable at task time.
