# Tasks: Pieces System — Real-Dimension Building

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~780 (3 PR slices) |
| Team review budget | 800 (each slice ≤400) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Catalog + snap pure layer | PR 1 | `bun test src/pieces/Catalog.test.ts src/pieces/snap.test.ts` | N/A — pure math, no Rapier/DOM boundary | git rm src/pieces/{Catalog,snap}.ts + tests |
| 2 | Physics wrappers + Piece | PR 2 | `bun test src/engine/Physics.test.ts` | N/A — deterministic headless Rapier (buildWorld), no engine needed | Revert Physics.ts/PlayerController.ts; git rm Piece.ts + Physics.test.ts |
| 3 | Controller + input + wiring | PR 3 | `bun test src/pieces/PlacementController.test.ts` | `bun run dev`: Q/R/LMB/RMB build loop | Revert Input.ts/main.ts; git rm PlacementController.ts + test |

Threat matrix N/A (design) — no RED-test rows; `contextmenu` covered in 5.x.
Work-unit commits: each task = one reviewable commit, tests + code together (work-unit-commits).

## Phase 1: Catalog + mm invariant (pure unit)

- [x] 1.1 RED `src/pieces/Catalog.test.ts`: exactly 4 pieces (240/115/52, 400/200/200, 2400/100/100, 2400/200/25 mm); meters = mm/1000 exact (0.115, no float literal); selection single-step (hold advances once). Covers piece-catalog specs.
- [x] 1.2 GREEN `src/pieces/Catalog.ts`: `PieceDef {id, name, dimsMm, meters}`, `PIECE_CATALOG`, edge-triggered `select()`. Done: 1.1 green.

## Phase 2: Snap math (pure unit)

- [x] 2.1 RED `src/pieces/snap.test.ts`: supportExtent identity + 90° rotation-invariant; snapToFace flush top face; roundToCm preserves 0.115, cm only on ground. Covers piece-placement face-snap + free-placement scenarios.
- [x] 2.2 GREEN `src/pieces/snap.ts`: `supportExtent`, `snapToFace`, `roundToCm` per design contracts. Done: 2.1 green.

## Phase 3: Physics wrappers + Piece (Rapier integration)

- [ ] 3.1 RED `src/engine/Physics.test.ts`: piece sleeps (velocity→0 after fixed steps); stack no interpenetration; ray through player hits piece (excludes player); overlap detected + clear pose; raycast beyond 5 m no hit. Covers piece-physics specs (buildWorld pattern).
- [ ] 3.2 GREEN: `src/engine/Physics.ts` — `createDynamicBody` (canSleep, groups), `castRayAndGetNormal`, `castShapeOverlap` (STOP_AT_PENETRATION), `registerPieceCollider`/`isPieceCollider`, group consts (player 1, pieces 2); `src/player/PlayerController.ts` capsule `setCollisionGroups`; `src/pieces/Piece.ts` — dynamic body + cuboid + mesh, `dispose()`. Done: 3.1 green.

## Phase 4: PlacementController + ghost (integration)

- [ ] 4.1 RED `src/pieces/PlacementController.test.ts`: aim ground → ghost at hit point cm-rounded; beyond 5 m → no target; brick flush on face (no cm rounding); overlap → ghost invalid + placement blocked; valid → piece created at ghost pose; 4 rotations = identity; remove frees collider + mesh; remove with no target → nothing. Covers piece-placement specs.
- [ ] 4.2 GREEN `src/pieces/PlacementController.ts`: `update(dt, BuildInput, camera)` — ray 5 m → snapToFace/roundToCm → ghost pose → overlap check → place/rotate/remove via `consume*`; ghost valid/invalid mesh. Done: 4.1 green.

## Phase 5: Input bindings + wiring

- [ ] 5.1 `src/player/Input.ts`: `consumePlace/Rotate/Remove/Select` edge-triggered (`!repeat`), mousedown LMB (locked)/RMB, `contextmenu` preventDefault, Q/R keys.
- [ ] 5.2 `src/main.ts`: instantiate `PlacementController`; call `update(dt, input, camera)` in `onFixedUpdate` before `physics.step()`; sync ghost in render.
- [ ] 5.3 Manual `bun run dev`: Q cycles piece, LMB places, R ×4 = identity, RMB removes, overlap ghost red + blocked.

## Phase 6: Full verification

- [ ] 6.1 `bun test` — 3 existing + 4 new suites green.
- [ ] 6.2 `bun run typecheck && bun run build` green.
