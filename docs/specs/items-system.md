# Spec: Items — inventory, four items, drops, milestones, tutorial

Status: awaiting approval
Date: 2026-08-10
Scope: **PR 2 of 2.** PR 1 (#29) shipped the pup cup, HUD thresholds, the
sinister relief cue and the delayed Bandit start.

---

## 1. The inventory

Four item types, deployed with number keys **1–4**. Counts are unbounded and
shown in a new HUD row. Bandit can neither pick up nor use them.

| Key | Item               | Effect                                                                                          |
| --- | ------------------ | ----------------------------------------------------------------------------------------------- |
| 1   | Rawhide            | Dropped here. Pulls Bandit from anywhere on the map and pins him to that tile while he eats it. |
| 2   | Sonic Dog Repeller | Dropped here. Bandit cannot enter its radius until it expires; he routes around.                |
| 3   | Doggy Diaper       | Instantly empties poop and pee to zero, fouling nothing.                                        |
| 4   | Zoom Zoom Chew     | 30s of autopilot at double speed, hoovering up food.                                            |

### Tuning (all dev-panel knobs)

| Knob                    | Default |
| ----------------------- | ------- |
| `RAWHIDE_EAT_SECONDS`   | 60      |
| `REPELLER_RADIUS`       | 6 tiles |
| `REPELLER_SECONDS`      | 60      |
| `ZOOM_SECONDS`          | 30      |
| `ZOOM_SPEED_MULTIPLIER` | 2       |
| `ITEM_DROP_PER_TICK`    | 0.00025 |
| `ITEM_DROP_FOOD_SCALE`  | 800     |
| `ITEM_MILESTONE_FOOD`   | 1000    |

---

## 2. Rawhide — the one thing that preempts him

Bandit's mode machine has held one invariant since #26: **nothing preempts a
committed mode.** The rawhide deliberately breaks it, as a fourth and highest
priority mode. That is the point of the item — dropping it during the "oh crap"
relief run is exactly when you want it to work.

To keep that from costing the emptying guarantee, rawhide **suspends and
restores** rather than cancels: the controller records the mode it interrupted
(and its drain queue) and returns to it when the rawhide is gone. A Bandit
pulled off a half-drained yard goes back to finishing it.

```
relief (poop half drained) → rawhide → eats 60s → relief (same queue) → …
```

**It never latches.** If the rawhide is unreachable — penned behind the gate,
or walled off by a repeller — he simply ignores it and behaves normally,
re-checking each tick, so it takes effect the moment a path exists. Reachability
is decided by the same BFS that moves him, so targeting and movement cannot
disagree.

The eat countdown starts **when he arrives**, not when it is dropped, and only
ticks while he is standing on it.

---

## 3. Sonic Dog Repeller — a Bandit-only exclusion

A radius Bandit will not enter, for `REPELLER_SECONDS`. He keeps his current
goal and simply routes around it; Blizzard is unaffected.

`bfsFirstStep` gains an optional `blocked` predicate. Only Bandit's calls pass
one — this is why the repeller cannot live in `Grid.canMove` the way the gate
does: `canMove` is shared by both dogs, and the whole point here is asymmetry.

**It can never trap him.** A repeller only blocks Bandit while he is _outside_
its radius; if one lands on top of him, it stops applying to him until he has
walked clear. Without that rule a repeller dropped on his head would make every
neighbouring tile illegal and freeze him permanently.

If a repeller makes his target unreachable, the existing fall-through already
handles it: he drops to the treat chain and patrols.

---

## 4. Doggy Diaper

Sets poop and pee to 0 with no fouling of the tile underneath — it deliberately
does **not** route through `WorldActions`, because every path there deposits
into the tile. That is the entire point of the item.

---

## 5. Zoom Zoom Chew

For `ZOOM_SECONDS`, the player's input is ignored and Blizzard drives himself
with **the same omniscient algorithm Bandit uses** — `bestFoodAnywhere` +
`bfsFirstStep`, reused directly rather than reimplemented — at
`ZOOM_SPEED_MULTIPLIER` speed.

- **No movement cost while zooming** (user decision): covering twice the ground
  is free, so the chew is a clean reward rather than a gamble. Ambient heat still
  drains water, because heat applies whether he moves or not and the chew does
  not double it — the decision was about the cost of the extra distance.
- Being omniscient, it ignores Blizzlord's fog of war. That follows from the
  request naming the omniscient algorithm, and is what makes the item feel like
  a power-up on the hardest difficulty.
- Ends at 0 seconds **or** when the map has no food left, whichever comes first.
- He picks up items as well as food while zooming.

---

## 6. Drops and milestones

**Random drops.** Each sim tick, one roll:

```
chance = ITEM_DROP_PER_TICK × (1 + food / ITEM_DROP_FOOD_SCALE)
```

so the rate doubles for every 800 food held — more items as the endgame
approaches, as asked. Over a 20-minute round (12 000 ticks) that is ≈3 drops at
50 food held, ≈6 at 800, ≈12 at 2400; a realistic ramp lands **≈6–9**. The item
appears on a random walkable tile that has no food or item already.

**Milestones.** Crossing each `ITEM_MILESTONE_FOOD` (1000, 2000, 3000 …) grants
one random item immediately. Tracked by highest milestone _reached_, so food
dipping and recovering cannot re-grant. That adds up to ~3 more, for **≈8–12 per
game** — comfortably over the "at least 5" target with room above it.

**Bandit ignores them entirely** — he walks over item pickups without seeing
them. Huskies are smarter than chihuahuas.

---

## 7. First-pickup tutorial

The first time Blizzard picks up each type in a round, the game **pauses** and a
panel explains what the item does and which key deploys it. Dismissing resumes.
Implemented as a Phaser overlay scene pausing `Game` and `UI`, rather than a DOM
overlay — the canvas is `Scale.FIT`, so a DOM panel would need to track its
transform.

Four popups maximum per round; the "seen" set resets each round.

---

## 8. HUD row

A fifth row on Blizzard's card at `ROW(4)`, aligning with Bandit's goal line,
showing each item's sprite, its count, and its number key.

---

## Architecture notes

- `src/systems/ItemSystem.ts` — pure: drop chance, milestone crossing, random
  type selection, grant/consume, repeller predicates. All of it unit-tested.
- `src/entities/Item.ts` — the `ItemType` union and per-item copy for the HUD
  and the tutorial.
- `BanditTickInput` gains a `rawhide` field; `BanditGoal` gains `'rawhide'`;
  the controller gains suspend/restore.
- `bfsFirstStep(grid, from, isGoal, blocked?)` — optional, so Blizzard's calls
  are untouched.
- Four new SVGs in the existing style.
- Everything per-run is reset in `create()` — the trap that bit
  `banditController` in #28 and `gateSprites` in #29.

## Acceptance criteria

1. Number keys 1–4 deploy their item; nothing happens at a count of zero.
2. Rawhide pulls Bandit off any mode, pins him for `RAWHIDE_EAT_SECONDS` once he
   arrives, and returns him to the mode it interrupted.
3. An unreachable rawhide never latches him.
4. Bandit routes around a repeller and is never trapped by one, including when
   it lands on him.
5. Blizzard is unaffected by repellers.
6. The diaper zeroes both channels and fouls nothing.
7. Zoomies drives him at double speed with no drain, ends on time or when food
   runs out, and returns control.
8. Drop chance rises with held food; milestones grant on each 1000 crossed, once.
9. Bandit never picks up an item.
10. The first pickup of each type pauses the game with an explanation.
11. The HUD shows counts and keys for all four.
12. `npm run build` and `npm test` green.

## Gherkin

```gherkin
Scenario: the rawhide interrupts and then gives back
  Given Bandit is part-way through emptying on a yard
  When a rawhide is dropped and he reaches it
  Then he stops and eats for the full duration
  And afterwards he returns to emptying that same channel

Scenario: an unreachable rawhide is ignored
  Given a rawhide is dropped where Bandit cannot path to it
  Then he continues his normal behaviour
  And he goes for it as soon as a path exists

Scenario: a repeller dropped on Bandit does not trap him
  Given Bandit is standing inside a new repeller's radius
  Then he is free to move
  And once outside he will not re-enter it

Scenario: the repeller is his problem alone
  Given a repeller is active
  Then Blizzard may walk through its radius freely

Scenario: the diaper leaves no mess
  Given Blizzard is full of poop and pee on a clean tile
  When he uses a doggy diaper
  Then both are zero
  And that tile is exactly as clean as before

Scenario: zoomies ends early when the map is bare
  Given the zoomies are active and time remains
  When the last food is eaten
  Then control returns immediately

Scenario: a milestone pays out once
  Given Blizzard crosses 1000 food
  Then he is granted one item
  And dropping below and crossing 1000 again grants nothing

Scenario: the rival cannot use tools
  Given an item is lying on the map
  When Bandit walks over it
  Then it is still there
```

## Ambiguity log

| Question                       | Resolution                                              | Source           |
| ------------------------------ | ------------------------------------------------------- | ---------------- |
| Drain during zoomies           | Suspended — a clean reward                              | user, 2026-08-10 |
| Item tuning and drop rate      | Defaults as tabled above                                | user, 2026-08-10 |
| Rawhide vs. committed modes    | Preempts everything                                     | user, 2026-08-10 |
| Item art                       | Authored SVGs in-style                                  | user, 2026-08-10 |
| Rawhide when unreachable       | Ignored, re-checked each tick — never latches           | assumed          |
| Repeller landing on Bandit     | Stops applying to him until he is clear                 | assumed          |
| Zoomies vs. fog of war         | Ignores it — the request names the omniscient algorithm | derived          |
| Does zoomies collect items too | Yes                                                     | assumed          |
| Tutorial implementation        | Phaser overlay scene, not DOM                           | assumed          |
