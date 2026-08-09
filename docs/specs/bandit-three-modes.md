# Spec: Bandit's three-mode AI + HUD mode indicator

Status: approved 2026-08-08; implemented on `feat/bandit-three-modes`
Date: 2026-08-08

## Intent

Bandit currently dribbles waste across the neighbourhood — a drop here, a drop
there — instead of committing to one lawn and emptying out. He also detours for
treats while dying of thirst. Replace his implicit latches with three explicit,
mutually exclusive modes and show the player which one he's in.

### Root cause of the reported bug

`rankRelieveTargets` re-ranks candidate yards by **live** affection on every
tick, and each foul *lowers* that owner's affection (`AffectionSystem.applyAction`).
So after one poop+pee the yard he's on is no longer the most-liked, the ranking
flips to a different owner, and he walks off with 95% of his load still held.
Two secondary causes compound it: relief triggers at `BANDIT_RELIEVE_THRESHOLD = 30`
(not full), and the episode ends only when *both* channels reach ~0, so he
oscillates near the threshold.

Fix: commit to one **owner** for the whole relief episode, not re-derive it each tick.

## Behaviour

### Modes

| Mode | Enter when | Exit when |
| --- | --- | --- |
| `treat` (default) | — | — |
| `relief` | `poop >= POOP_MAX` **or** `pee >= PEE_MAX` | every channel that was full is drained to empty |
| `water` | `water <= WATER_CAP * 0.1` | `water >= WATER_CAP` |

Modes are mutually exclusive and **committed**: once entered, Bandit stays in
that mode until its exit condition fires. Nothing preempts a mode in progress.

**Precedence** (checked only from `treat`): relief wins over water. If both
trigger on the same tick he empties out first, then drinks.

### `treat` mode
Unchanged — today's value/distance food seeking (smell-gated in advanced mode,
map-wide when omniscient), falling back to the street patrol.

### `relief` mode
1. On entry, pick the **highest-affection reachable yard** with a foulable tile
   and commit to that owner id.
2. Path to the nearest foulable tile *of that yard*; foul it; when it fills,
   move to the next foulable tile in the same yard.
3. Drain **both** poop and pee to empty if both were full on entry; drain only
   the triggering channel if only one was.
4. If the committed yard saturates before he's empty, re-pick the next
   highest-affection reachable yard with room and commit to that one.
5. When empty, return to `treat`.

### `water` mode
Beeline to the nearest water by BFS — **no opportunistic treat grabs en route**
(`nearestFoodWithin` / `BANDIT_GRAB_RADIUS` drop out of the water path). Drink
each tick until `water >= WATER_CAP`, then return to `treat`.

### HUD
A fifth line in Bandit's stat card showing his current mode:

| Mode | Label |
| --- | --- |
| `treat` | `Looking for Treats` |
| `water` | `Needs Water!` |
| `relief`, draining poop | `Need to Poop!` |
| `relief`, draining pee | `Need to Pee!` |

When both channels are full, the label follows whichever he is draining now
(poop first, then pee).

## Architecture notes

- **`BanditController`** owns the mode. Its two booleans (`emptying`,
  `refilling`) collapse into one `goal: 'treat' | 'relief' | 'water'` field plus
  a `yardOwnerId: number | null` commitment — mutual exclusion becomes structural,
  which deletes the defensive `!this.refilling && ...` mirror logic in
  `shouldHold`/`tick`.
- **`RelieveTarget`** gains `ownerId`, so yard commitment is a filter on the
  target list. This also removes GameScene's awkward tile→ownerId re-lookup
  (`GameScene.ts:221`).
- **`firstReachableRelieveTarget`** takes an optional committed owner id: it
  searches that owner's tiles first and only falls back to the affection ranking
  when the yard has no room left.
- Name clash: `BanditMode` in `AISystem` already means `'chase' | 'patrol'`
  (movement speed). The new type is `BanditGoal`.
- Mode→label is a pure function in `AISystem` so it unit-tests without Phaser;
  `getHudState()` exposes `chiGoalLabel`, `UIScene` renders it at `ROW(4)`.
- Config: `BANDIT_RELIEVE_THRESHOLD` 30 → 100 (== `POOP_MAX`/`PEE_MAX`, so
  "100% full" holds at defaults and the dev-panel knob survives). `isThirsty`'s
  `0.3` → `0.1`. `BANDIT_GRAB_RADIUS` becomes unused and is deleted along with
  `nearestFoodWithin`.

## Acceptance criteria

1. Bandit does not leave a yard mid-relief because its affection dropped.
2. Relief starts only at a full channel, and ends only at an empty one.
3. In water mode he takes the shortest path to water with no food detour, and
   drinks to `WATER_CAP` before doing anything else.
4. The HUD shows exactly one of the four labels, matching his live mode.
5. `npm run build` and `npm test` are green.

## Gherkin

```gherkin
Scenario: he empties one lawn instead of dribbling across the block
  Given Bandit's poop is full
  And the most-liked yard has room
  When he reaches that yard and fouls it
  And that owner's affection drops below another owner's
  Then he keeps fouling the same yard until his poop is empty

Scenario: a saturated yard hands off to the next-best one
  Given Bandit is emptying on his committed yard
  When every tile of that yard is at max dirt and destruction
  And he is not yet empty
  Then he commits to the next highest-affection reachable yard with room

Scenario: both channels full empties both in one trip
  Given Bandit's poop and pee are both full
  When he enters relief mode
  Then he does not return to treat seeking until both are empty

Scenario: thirst beelines
  Given Bandit's water is at or below 10% of WATER_CAP
  And a treat sits one tile off his route to the water
  When he moves
  Then he steps toward the water, not the treat

Scenario: he drinks to full before leaving
  Given Bandit is in water mode beside water
  When he drinks
  Then he keeps drinking until his water reaches WATER_CAP
  And only then returns to treat seeking

Scenario: relief outranks thirst
  Given Bandit's poop is full and his water is at 5% of WATER_CAP
  When he picks a mode from treat seeking
  Then he enters relief mode

Scenario: the HUD names his mode
  Given Bandit is in relief mode draining pee
  Then his stat card reads "Need to Pee!"
```

## Ambiguity log

| Question | Resolution | Source |
| --- | --- | --- |
| Relief vs. water when both trigger | Relief first | user, 2026-08-08 |
| Both channels full on entry | Empty both in one trip | user, 2026-08-08 |
| Committed yard saturates mid-episode | Move to next-best yard with room | user, 2026-08-08 |
| Keep the tunable relief threshold? | Yes — retune to 100 rather than delete the knob | assumed |
| Bandit's survival margin at 10% water | Bandit has no death condition, so a thin margin is safe | verified in `updateBandit` |
