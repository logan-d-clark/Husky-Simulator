# Spec: Pup cup, affection thresholds, sinister relief cue, delayed Bandit start

Status: awaiting approval
Date: 2026-08-10
Scope: **PR 1 of 2.** The items system (inventory, 4 items, drops, milestones,
tutorial popups, HUD row) is deliberately deferred to PR 2 — it is a subsystem
with deep AI coupling and deserves its own review.

---

## 1. Pup cup — the ultimate food

A fourth `FoodType`, spawning only on a maxed-affection lawn and rarer than bags.

| Knob                | Value | Note                                                   |
| ------------------- | ----- | ------------------------------------------------------ |
| `PUPCUP_MULTIPLIER` | 12    | value 120 vs. a bag's 40 — a massive boost             |
| `PUPCUP_LIKELIHOOD` | 0.05  | same as a bag — the 100-affection gate is the scarcity |
| `PUPCUP_THRESHOLD`  | 100   | maxed affection only                                   |
| `SMELL_PUPCUP`      | 14    | Bandit smells it from further than a bag (12)          |

**The threshold needs `>=`, not `>`.** `AffectionSystem.applyAction` caps affection
at exactly 100, so the existing `owner.affection > THRESHOLD` test can never fire
for a threshold of 100. Bowl and bag keep `>` (changing them would alter when
they spawn); pup cup uses `>=` with a comment explaining the asymmetry.

**Pup cups are additive, not a replacement for bags.** `rollDispense` resolves
one random draw down a chain of ascending bands, so folding a pup cup branch in
at the same 0.05 likelihood as a bag would consume the bag's entire band —
maxing a yard would silently _stop_ it producing bags. Instead the pup cup gets
its own independent roll ahead of the existing chain:

```
if (affection >= PUPCUP_THRESHOLD && rand() <= PUPCUP_LIKELIHOOD * p) -> pup cup
...otherwise the existing treat/bowl/bag chain, byte-for-byte unchanged
```

So a perfect yard yields pup cups _on top of_ everything it already produced,
and every yard below 100 behaves exactly as it does today.

New asset `pupcup.svg`, authored to match the existing flat-SVG food sprites.
The value-transposed `eatCue` from #28 means it automatically sounds the
richest pickup in the game.

---

## 2. Affection thresholds on the HUD meter

The Current Space card's "Likes you" bar currently shows raw affection with no
indication of what it buys. Add referent lines at each food threshold, labelled
with that food's own sprite:

```
Likes you  ▕████████████▏         ▏      ▏  ▏
                                  ▲      ▲  ▲
                                 bowl   bag pupcup
                                 (50)   (90) (100)
```

Ticks are drawn on the bar at `x = barLeft + (threshold / 100) * barWidth`; the
sprite icons sit below the bar (the card has clear space between the bar's
bottom at `y0+135` and the card floor at `y0+168`). Thresholds are read live
from config, so tuning `BOWL_THRESHOLD` in the dev panel moves the marker.

---

## 3. A more sinister Bandit relief cue

Today `banditRelief` is two sawtooth notes over 0.30s. It reads as a blip, not
as the "oh crap, he's heading for my best yard" event it marks.

Rewrite as a longer descending figure (~0.8s) with a tritone against the root —
the interval that reads as menace — voiced low on sawtooth. It stays **quieter
than Blizzard's cues** (that mixing rule is asserted by an existing test and is
still right: this is a warning, not a reward, and must not mask the player's own
feedback). It gains its weight from length, register and dissonance, not volume.

The existing "every cue under 0.6s" test gains a documented carve-out for this
one cue, since length is now the point.

---

## 4. Delayed Bandit start + the driveway gate

### The gate

The Grumbles' property is already fully fenced; the only opening is the
two-tile-wide driveway on its right edge. **Verified by flood fill**: blocking
the two edges `(19,4)↔(20,4)` and `(19,5)↔(20,5)` drops Bandit's reachable area
from 1042 tiles to 190, gives Blizzard 852, and produces **zero overlap** —
190 + 852 = 1042 exactly. The only owners inside the pen are 0 (the driveway)
and 1 (The Grumbles).

Implementation is deliberately boring: the gate **is a fence**. Setting
`fences.right = true` on those two tiles at game start, and clearing it when the
timer expires, makes `Grid.canMove`, both dogs' BFS, and the existing fence
rendering all behave correctly with no new logic in the movement path. The gate
tiles render with the vertical fence sprite in a distinct gate tint while shut.

### The timer

Following the existing `chiSpeedMultiplier` idiom rather than inventing a second
pattern: one dev-tunable base with a per-difficulty multiplier.

|           | Multiplier | Delay at the 120s default |
| --------- | ---------- | ------------------------- |
| Puppy     | 1.5        | 180s                      |
| Husky     | 1.0        | 120s                      |
| Blizzlord | 0.5        | 60s                       |

`BANDIT_DELAY_SECONDS` (120) is the dev-panel knob;
`DifficultySettings.banditDelayMultiplier` scales it.

### While he is penned, his needs pause

The pen contains **no water and no food** — verified: zero water tiles, none
adjacent, and The Grumbles sit at affection 0, so `treatRateActive` is 0 and
nothing ever spawns there.

Left alone, Bandit would drain to empty, latch permanently into `water` mode
(no reachable water), sit with the HUD reading "Needs Water!" for the whole
delay, and emerge in deficit. That is exactly the terminal-mode limitation
flagged in #26 as unreachable — penning him makes it reachable.

So while the gate is shut, **Bandit's resource drain is suspended**: he is at
home, being fed and watered by his owners. He still patrols his yard, and can
still foul it (which is its own joke). He emerges fresh and dangerous, which is
the dramatic intent of the delay. One guard, no new machinery, and it keeps the
mode machine out of a terminal state.

---

## Acceptance criteria

1. Pup cups spawn only at 100 affection, are rarer than bags, and are worth far more.
2. The affection bar shows a labelled marker for each food threshold, tracking config.
3. Bandit's relief cue is materially longer and reads as ominous, without exceeding Blizzard's cue volume.
4. Bandit cannot leave the Grumbles yard, and Blizzard cannot enter it, until the delay expires.
5. The delay differs per difficulty and is tunable from the dev panel.
6. Bandit neither starves nor latches into an unsatisfiable mode while penned.
7. After the gate opens, the map is exactly as reachable as it is today.
8. `npm run build` and `npm test` green.

## Gherkin

```gherkin
Scenario: only a beloved family puts out a pup cup
  Given a house at less than maxed affection
  Then it can never dispense a pup cup
  And at exactly maxed affection it can

Scenario: a perfect yard still produces bags
  Given a maxed-affection house
  Then it can dispense pup cups
  And it still dispenses bags at the rate it did before

Scenario: the meter explains itself
  Given Blizzard is standing on a family's lawn
  Then the affection bar shows a marker at each food threshold

Scenario: the gate holds both dogs
  Given the round has just started
  Then Bandit cannot reach any tile outside the Grumbles property
  And Blizzard cannot reach any tile inside it

Scenario: the gate opens on time
  Given the Bandit delay for this difficulty has elapsed
  Then every tile on the map is reachable by both dogs again

Scenario: a harder difficulty releases him sooner
  Then Blizzlord's delay is shorter than Puppy's

Scenario: he is looked after at home
  Given Bandit is penned behind the shut gate
  When time passes
  Then his food and water do not fall
  And he never enters water-seeking mode
```

## Ambiguity log

| Question                        | Resolution                                                        | Source                               |
| ------------------------------- | ----------------------------------------------------------------- | ------------------------------------ |
| Deliver all 7 features at once? | No — two PRs; items are PR 2                                      | user, 2026-08-10                     |
| Where is the gate?              | The two-tile driveway on the right edge, verified by flood fill   | user correction, 2026-08-10          |
| New sprites                     | Authored in-style as SVG                                          | user, 2026-08-10                     |
| Pup cup rarity                  | As common as a bag; the 100-affection gate is the scarcity        | user, 2026-08-10                     |
| Pup cup value                   | 12× a treat                                                       | assumed                              |
| Does a pup cup displace a bag?  | No — independent roll, so maxed yards gain pup cups and keep bags | derived from the ordering constraint |
| Threshold comparison at 100     | `>=` for pup cup only; bowl/bag keep `>`                          | derived — affection caps at 100      |
| Bandit's needs while penned     | Suspended — he is at home being cared for                         | user, 2026-08-10                     |
| Gate visual                     | Existing fence sprite, distinct tint                              | assumed                              |

## Deferred to PR 2

Inventory system, number-key deployment, Rawhide (preempts every Bandit mode),
Sonic Dog Repeller (Bandit-only pathfinding exclusion), Doggy Diaper, Zoom Zoom
Chew (Blizzard autopilot), item drops scaled by held food, 1000-food milestone
grants, first-pickup tutorial popup with pause, and the Blizzard HUD inventory row.
