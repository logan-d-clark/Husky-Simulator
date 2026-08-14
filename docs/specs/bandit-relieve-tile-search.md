<!-- spec-version: 10.18.2 -->

# Spec: Bandit Relieve-Tile Search Within a Yard

**Format:** dev-team specs v10.18.2

## Intent Description

Bandit currently targets a single fixed tile per yard — the yard's centroid
(`buildRelieveTargets` emits one `{ tile: yardCentroid, affection }` per family
yard). Once that one tile fills with his mess he can't make progress on it, and
he falls back to movement and re-targets the same centroid, so he never actually
relieves on a yard whose centroid is full (the ping-pong edge case flagged when
the relieving feature shipped).

Change the targeting so Bandit searches for **any available (non-full) tile in
the highest-affection yard**. As tiles fill, he moves to other still-available
tiles in that same yard. Only when **every** tile in the highest-affection yard
is full does he move on to the second-highest-affection yard, and so on. In a
normal game it is very unlikely he ever fills every tile of even a small yard, so
he should almost always find an available tile in the yard he is targeting.

Additionally, once Bandit **starts** relieving (crosses the go-relieve
threshold), he commits to **fully emptying** — he keeps relieving until his poop
_and_ pee are both spent (down to the floor), even after his remaining need
drops below the threshold. If a tile fills before he is empty (e.g. he holds 40
pee but the tile can only take 20 more), he drops what fits, then moves to
another available tile to finish the rest.

## Architecture Specification

**Components affected**

| Component                                | Change                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/systems/AISystem.ts`                | Add a pure `canFoulTile(inv, tile): boolean` — a family-yard grass tile Bandit can still make progress on (has capacity for the waste he's holding). It is the single source of truth for "foulable here".                                                                                                                                   |
| `src/systems/BanditController.ts`        | Its private `canMakeProgress` becomes a thin call to `canFoulTile` (dedupe). Add an **empty-out episode** latch: `emptying` turns on when `needsRelieve` fires and off only when poop **and** pee are both at the floor, so he keeps fouling (across tiles) until fully spent, below the threshold. Exposed to GameScene via `isEmptying()`. |
| `src/systems/AISystem.ts` (relieve gate) | `nextBanditMove` pursues relieve targets when `needsRelieve(inv)                                                                                                                                                                                                                                                                             |     | emptying` (a new default-`false` param), so he keeps heading to available tiles while emptying even below the threshold. |
| `src/systems/OwnerRegistry.ts`           | `buildRelieveTargets(map, registry, inv)` now emits **one target per available family-yard grass tile** (`canFoulTile` true), tagged with its owner's affection — instead of one centroid per yard. Public/street tiles are still excluded (owner id 0 / non-family).                                                                        |
| `src/scenes/GameScene.ts`                | Pass Bandit's inventory to `buildRelieveTargets`, and only build the targets when he actually needs to relieve (`needsRelieve`), so the map isn't scanned every tick.                                                                                                                                                                        |

**Unchanged (relied upon):** `rankRelieveTargets` (affection desc → nearest →
stable) and `nextBanditMove`'s "walk the ranked list, take the first reachable"
loop already produce exactly the desired behaviour once the target set is the
available tiles: the nearest available tile of the highest-affection yard, then
the next yard when a yard contributes no available tiles.

**Constraints**

- `AISystem` and `BanditController` stay Phaser-free and unit-tested.
- `canFoulTile` mirrors `WorldActions.poop/pee`'s guards exactly (grass, `poop>1
&& dirt+POOP_RATE<=POOP_MAX` or `pee>1 && destruction+PEE_RATE<=PEE_MAX`), so
  a tile is "available" iff a foul there would actually drain something.
- No new config, no rate changes; targeting only.

## Acceptance Criteria

- **AC1** When Bandit needs to relieve, he heads for an available (non-full)
  grass tile of the highest-affection reachable family yard — not restricted to
  the centroid.
- **AC2** As tiles he fouls fill up, he targets other still-available tiles in
  the **same** yard rather than getting stuck or leaving prematurely.
- **AC3** Only when every tile in the highest-affection yard is full does he move
  to the next-highest-affection yard (and so on down).
- **AC4** Public/street tiles are never relieve targets; all other behaviour
  (thirst, opportunistic eating, food targeting, patrol, full refill, omniscient
  default) is unchanged.
- **AC5** The "foulable tile" test is shared between the targeting
  (`buildRelieveTargets`) and the controller (`BanditController`), so they cannot
  disagree — no re-introduced deadlock or ping-pong.
- **AC6** Once Bandit starts relieving, he fully empties: he keeps relieving —
  spilling onto additional available tiles when one fills — until both poop and
  pee are at the floor, even after his remaining need drops below the threshold.
  He does not leave a yard partially relieved because his remainder fell under
  the go-relieve threshold.

## Ambiguity Log

| Decision                                             | Classification  | Resolved By  | Rationale / Answer                                                                                                                          |
| ---------------------------------------------------- | --------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| User's model of current logic (targets the centroid) | n/a — confirmed | human + code | Correct; confirmed against `buildRelieveTargets`/`yardCentroid`.                                                                            |
| "Available tile" definition                          | `inferable`     | inference    | grass + family owner + capacity for the waste he's holding (`canFoulTile`, mirroring WorldActions guards).                                  |
| Which available tile within the yard                 | `inferable`     | inference    | Nearest to Bandit, via the existing `rankRelieveTargets` affection→nearest tiebreak (minimises travel).                                     |
| Fall-through order across yards                      | `inferable`     | inference    | Affection descending — emerges from tagging each available tile with its owner's affection and the existing rank.                           |
| Performance of scanning available tiles              | `inferable`     | inference    | Build the target set only when `needsRelieve` is true; one map scan replaces the previous per-owner `yardCentroid` scans (a net reduction). |
| Scope                                                | `inferable`     | inference    | Single focused change, one PR.                                                                                                              |

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior/goal maps to an acceptance criterion
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
- [x] Every gap/ambiguity finding is logged — inferable with rationale or resolved by human

**Verdict: PASS**
