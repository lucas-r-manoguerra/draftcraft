# Proposal: Pieces System — Real-Dimension Building

## Intent

DraftCraft (1 u = 1 m) is a walking sim; no building exists. Deliver the first build loop: select → aim with ghost → face-snapped placement → rotate → remove. Dims are real-world: brick 24×11.5×5.2 cm, block 40×20×20 cm, beam 2.4 m×10×10 cm, plank 2.4 m×20×2.5 cm.

Exploration #835 verified Rapier 0.19.3 has castRayAndGetNormal, castShape (stopAtPenetration), InteractionGroups, auto-sleep — all unused.

## Scope

**In**: catalog (4 pieces, integer-mm dims 240/115/52, 400/200/200, 2400/100/100, 2400/200/25; meters = mm÷1000, no float literals) · PlacementController (Rapier raycast ~5 m, face snap + cm rounding, ghost overlap rejection, 90° rotation, removal) · Physics dynamic factory + raycast/castShape helpers + collision groups + auto-sleep · edge-triggered input (`consume*` pattern) · tests (buildWorld + fixed-step).

**Out**: camera collision (follow-up) · pushing pieces (keeps `applyImpulsesToDynamicBodies(false)`) · save/persistence · textures.

## Capabilities

> openspec/specs/ empty — all NEW.

### New
- `piece-catalog`: definitions, metric-dimension invariants, selection
- `piece-physics`: dynamic bodies, raycast/overlap queries, interaction groups, auto-sleep
- `piece-placement`: targeting, face snap, ghost preview + overlap rejection, rotation, removal

### Modified
None (no existing specs).

## Approach

| Decision | Choice / Rationale |
|----------|--------------------|
| Raycast | Rapier castRayAndGetNormal (colliders are authority; normal enables face alignment) |
| Snap | Face-aligned (extent + normal); cm grid can't hold 0.115 m — cm rounding only for free placement |
| Body | Dynamic + auto-sleep; kinematic fallback if jitter |
| Groups | Player=1 / pieces=2; pieces stack together + ground; rays exclude player |

## Affected Areas

`src/pieces/Catalog.ts` (New) · `src/pieces/PlacementController.ts` (New) · `src/engine/Physics.ts` (Modified: dynamic + ray helpers) · `src/player/Input.ts` (Modified: place/rotate/remove) · `src/main.ts` (Modified: wire controller) · `src/pieces/*.test.ts` (New).

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Jitter on 5.2 cm brick | Med | auto-sleep; kinematic fallback |
| Float drift (0.115 m) | Low | integer-mm invariant (11.5 cm not integer-cm) |
| Camera clips pieces | Med | follow-up (out of scope) |
| Flaky physics tests | Low | fixed-step deterministic pattern |

## Rollback Plan

Git at `main` `d7b3e6e` (clean). Implement on `feature/pieces-system`:

- Not merged: `git checkout main && git branch -D feature/pieces-system`
- Merged: `git revert <merge-commit>`; no data migration
- Abandoned: remove `openspec/changes/pieces-system/`, `git rm -r src/pieces`, restore touched files from `main`

## Dependencies

None new (APIs verified in node_modules; `RAPIER.init()` already called).

## Success Criteria

- [ ] 4 pieces with integer-mm invariant asserted
- [ ] Brick-on-brick flush via face snap; overlap rejected
- [ ] Ghost invalid on overlap; placement blocked
- [ ] R cycles 4 orientations; removal frees collider + mesh
- [ ] `bun test` green (3 existing + new suite)
