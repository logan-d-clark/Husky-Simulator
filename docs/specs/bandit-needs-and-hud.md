<!-- spec-version: 10.18.2 -->

# Spec: Bandit Needs & HUD Block

**Format:** dev-team specs v10.18.2

## Intent Description

Make the rival chihuahua **Bandit** a believable foil for the player, shipped as
**two thematic PRs**:

1. **Bandit AI behaviour.** Today Bandit tops up water in a single tick and
   wanders off, so he rarely leaves the water-rich right side; he never poops or
   pees (his need never crosses the auto-dump ceiling while he's on a street);
   and he beelines to water past easy treats. Change him to: **commit to a full
   water refill** when he drinks (leaving the water alone for longer), **actually
   relieve himself** at a sensible need level, **target the yard whose owner the
   player has made like them most** when he relieves (so camping in one family's
   yard to farm treats backfires — Bandit comes and fouls it), **grab treats
   opportunistically** on his way to water, all at **the same water/poop/pee
   rates as Blizzard** (the fix is behavioural commitment, not special rates).
   Finally, make **omniscient targeting the default AI mode** — it plays much
   better — while keeping the dev toggle.

2. **Bandit HUD block.** Add a second stats block, styled exactly like
   Blizzard's, labelled **Bandit**, showing Bandit's live food / water / poop /
   pee, positioned between Blizzard and Current Space so the HUD reads
   **Blizzard › Bandit › Current Space**.

## Architecture Specification

**Components affected**

| PR  | Component                  | Change                                                                                                                                                                                                                                                                                     |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `src/config/gameConfig.ts` | Add numeric, live-tunable `BANDIT_GRAB_RADIUS` (opportunistic-eat detour, tiles) and `BANDIT_RELIEVE_THRESHOLD` (poop/pee level that sends him to a yard).                                                                                                                                 |
| 1   | `src/config/banditMode.ts` | `banditSettings.omniscient` default flips to `true`; `resetBanditSettings()` resets to `true`.                                                                                                                                                                                             |
| 1   | `src/systems/AISystem.ts`  | Extend the decision: a relieve target (highest-affection reachable family yard) when need is high; an opportunistic near-food grab while thirst-seeking; keep Phaser-free & unit-tested. New pure helpers; `nextBanditMove` gains a `relieveTargets` context arg.                          |
| 1   | `src/scenes/GameScene.ts`  | Bandit commitment state: stay-and-drink until water is full; stay-and-relieve on the target yard until emptied. Build `relieveTargets` from `OwnerRegistry.all()` + `yardCentroid` + `owner.affection`. Relieving uses the existing `WorldActions.poop/pee` (drops the owner's affection). |
| 2   | `src/scenes/GameScene.ts`  | `getHudState()` also exposes Bandit's `water`/`poop`/`pee` (food already exposed as `chiFood`).                                                                                                                                                                                            |
| 2   | `src/scenes/UIScene.ts`    | New "Bandit" inset card at x≈358 (the empty gap between Blizzard's card and Current Space), mirroring Blizzard's food/water/poop/pee rows/bars; Current Space unchanged.                                                                                                                   |

**Constraints**

- `AISystem.ts` stays framework-agnostic (no Phaser) and unit-tested; the
  stateful commitment (staying put to drink/relieve) lives in `GameScene`, the
  targeting math lives in `AISystem`.
- **Rates are shared with Blizzard** — no Bandit-specific water/poop/pee rate.
  `ResourceSystem.drink` (WATER_VALUE/tick) and `WorldActions.poop/pee`
  (POOP_RATE/PEE_RATE per tick) are reused as-is; only _when/where/how long_ he
  does them changes.
- Runtime config is read live (`config.X` / `banditSettings` at call time).
- The relieve/affection foil reuses the existing per-owner `affection` and
  `AffectionSystem.applyAction` — no new affection model.
- HUD order is fixed: **Blizzard › Bandit › Current Space**. Current Space keeps
  its two-sub-column layout (the "compact dog blocks, keep Current Space wide"
  choice); the Bandit card fills the currently-empty 358–694 px gap.
- Omniscient default applies to all difficulties; still dev-toggleable and
  reset-to-default (now on).

## Acceptance Criteria

**PR 1 — Bandit AI behaviour**

- **AC1 — Full water refill.** When Bandit reaches water while thirsty, he stays
  and drinks until his water is full before moving on, gaining water at the same
  per-tick rate Blizzard does. He no longer leaves after a single-tick top-up.
- **AC2 — Opportunistic eating en route.** While heading to water, if a treat is
  within `BANDIT_GRAB_RADIUS` of him he diverts to grab it before continuing to
  the water, rather than beelining past it.
- **AC3 — Bandit actually relieves.** When Bandit's poop or pee reaches
  `BANDIT_RELIEVE_THRESHOLD`, he goes to a grass yard and poops/pees there,
  lowering his poop/pee (at Blizzard's per-tick rate) and the yard owner's
  affection — observable within a normal game, not only at the 100-cap.
- **AC4 — Affection-targeted relieving.** When he needs to relieve, Bandit heads
  for the yard of the owner with the **highest** affection among reachable family
  yards (whenever one is reachable), so a player who has buttered up one family
  and camps there gets fouled.
- **AC5 — Omniscient by default.** A newly started game has Bandit in omniscient
  mode; the dev toggle still switches modes live and "Reset to Defaults" returns
  it to omniscient (on).
- **AC6 — Shared rates.** Bandit's water, poop, and pee change at the same rates
  as Blizzard's — the behavioural changes above are commitment/targeting, not
  faster or slower resource rates.

**PR 2 — Bandit HUD block**

- **AC7 — Bandit stats block.** A HUD block labelled "Bandit", styled like
  Blizzard's, shows Bandit's food / water / poop / pee (text + bars matching
  Blizzard's), positioned between Blizzard and Current Space (Blizzard › Bandit ›
  Current Space).
- **AC8 — Live & non-regressing.** The Bandit block reflects Bandit's actual
  inventory each frame, and Current Space keeps its two-sub-column layout and
  readability (nothing overlaps or is pushed off-panel).

## Ambiguity Log

| Decision                                | Classification               | Resolved By | Rationale / Answer                                                                                                                                                                                               |
| --------------------------------------- | ---------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ship as 2 PRs vs 1                      | `requires-stakeholder-input` | human       | Answered up front: 2 PRs — Bandit AI, then HUD.                                                                                                                                                                  |
| HUD three-block sizing                  | `requires-stakeholder-input` | human       | Answered up front: compact dog blocks, keep Current Space wide (Bandit fills the empty 358–694 gap; Current Space unchanged).                                                                                    |
| "Take as long as Blizzard to replenish" | `inferable`                  | inference   | Interpreted as: use Blizzard's shared rates (no special-casing) and commit to a _full_ refill / real relieving over multiple ticks — the perceived "one-tick refill" is really leaving early, not a faster rate. |
| Relieve trigger level                   | `inferable`                  | inference   | New `BANDIT_RELIEVE_THRESHOLD` (default 30) so relieving happens within a game rather than at the 100 auto-dump ceiling; dev-tunable. Emptied down to the WorldActions floor (~1) while committed.               |
| Opportunistic-eat detour size           | `inferable`                  | inference   | New `BANDIT_GRAB_RADIUS` (default 2 tiles); dev-tunable. Only diverts for a treat genuinely near his path.                                                                                                       |
| Which affection value Bandit targets    | `inferable`                  | inference   | The existing per-owner `affection` (the "Likes you" meter the player raises by tricking); Bandit targets the max among family yards, reusing OwnerRegistry + yardCentroid.                                       |
| Public/street tiles as relieve targets  | `inferable`                  | inference   | Excluded — only family yards (grass tiles with a real owner) are relieve targets; `yardCentroid` returns null for the public owner.                                                                              |
| Omniscient default scope                | `inferable`                  | inference   | Applies to all difficulties, still dev-toggleable; reset-to-default now yields omniscient on.                                                                                                                    |
| HUD data plumbing                       | `inferable`                  | inference   | Extend `getHudState()` to expose Bandit water/poop/pee (food already there); mirror Blizzard's row/bar layout at an x-offset into the empty gap.                                                                 |

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior/goal maps to an acceptance criterion
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
- [x] Every gap/ambiguity finding is logged — inferable with rationale or resolved by human

**Verdict: PASS**
