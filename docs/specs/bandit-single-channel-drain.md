# Spec: Bandit drains one waste channel at a time

Status: awaiting approval
Date: 2026-08-09
Follows: [bandit-three-modes.md](bandit-three-modes.md)

## Intent

Bandit currently drains poop **and** pee on the same tick, so he clears both
bars in the time Blizzard clears one. Serialize him onto a single channel so
the opportunity cost of relieving — ticks spent standing still while your
opponent is out collecting food — is the same for both dogs.

### Measured basis for the parity claim

- Blizzard's `GameScene.action` is a **single** value (`'drink' | 'poop' | 'pee'
| 'trick' | null`, `GameScene.ts:44`), and `onTick` applies at most one of
  `WorldActions.poop` / `.pee` per tick (`GameScene.ts:306-307`). One channel,
  `POOP_RATE`/`PEE_RATE` = 1 unit per tick.
- `BanditController.relieveOnce` calls **both** `WorldActions.poop` and
  `.pee` every tick — 2 units/tick against Blizzard's 1.
- At `SIM_HZ = 10`, a full 100-unit bar is ~100 ticks ≈ **10s** of standing
  still. Today Bandit clears both bars in that same 10s; Blizzard needs ~20s.

## Behaviour

### One channel at a time

A relief episode carries an ordered **drain queue** of the channels that are
100% full. He drains only `queue[0]`, one unit per tick, until it is empty,
then moves to the next. When the queue empties, back to `treat`.

- Both full on entry → **poop first, then pee**.
- The queue is recomputed whenever the active channel empties, so a channel
  that fills mid-episode (heat pushes pee up while he stands still poop-ing)
  is picked up rather than stranded.

### Only full channels drain (spec-compliance fix)

Entering relief with pee at 100% and poop at 40 drains **pee only**, then
returns to treat seeking with poop still at 40. Poop gets its own trip when it
reaches 100%.

This is what [bandit-three-modes.md](bandit-three-modes.md) already specified
("drain only the triggering channel if only one was"), but the shipped code
drains both — `relieveOnce` drops both channels and the exit test requires both
to be empty. So this is a latent spec-compliance defect, not a new decision.

### HUD label bug

`banditGoalLabel` reads `inv.poop > 1 ? 'Need to Poop!' : 'Need to Pee!'` — it
reports _"is he holding any drainable poop"_, not _what he is doing_. So a trip
triggered by a full pee bar reads "Need to Poop!" whenever he happens to be
carrying poop. Root cause: the label is derived from inventory rather than from
the episode's actual state.

Fix: derive it from the **active drain channel**, which now exists as real
state. The label follows the channel he is actually draining, and flips
mid-episode when he switches.

### Tile targeting follows the active channel

A candidate tile must have room for **the channel he is draining** — a tile
with pee room is useless to a Bandit draining poop onto maxed dirt. `canFoulTile`
and `buildRelieveTargets` become channel-aware, so his targeting and his fouling
cannot disagree.

## Architecture notes

- `BanditController` gains `drainQueue: WasteChannel[]` and exposes
  `activeChannel(): WasteChannel | null`. `isEmpty` is replaced by "queue empty".
- New `WasteChannel = 'poop' | 'pee'` in `AISystem`.
- `canFoulTile(inv, tile, channel?)` narrows to one channel when given one;
  the existing either-channel behaviour stays as the default so non-relief
  callers are unaffected.
- `buildRelieveTargets(map, reg, inv, channel)` passes the active channel through.
- `banditGoalLabel(goal, channel)` replaces the inventory-sniffing signature.

## Acceptance criteria

1. Bandit never drops poop and pee on the same tick.
2. Draining both full bars takes Bandit the same number of ticks it would take
   Blizzard (≈2× a single bar).
3. A trip triggered by one full channel drains only that channel.
4. The HUD label names the channel he is actually draining, and a pee-triggered
   trip reads "Need to Pee!" even while he still carries poop.
5. He only targets tiles with room for the channel he is draining.
6. `npm run build` and `npm test` green.

## Gherkin

```gherkin
Scenario: one channel per tick
  Given Bandit is fouling a yard with both bars full
  When one tick passes
  Then exactly one of his poop or pee has decreased

Scenario: parity with Blizzard
  Given Bandit's poop and pee are both full
  When he empties both completely
  Then the ticks he spent equal what Blizzard would spend draining both

Scenario: a pee-triggered trip leaves the poop alone
  Given Bandit's pee is full and his poop is at 40
  When he finishes his relief trip
  Then his pee is empty
  And his poop is still 40

Scenario: the label names what he is doing
  Given Bandit's pee is full and his poop is at 40
  When he enters relief
  Then his HUD reads "Need to Pee!"

Scenario: the label follows the switch
  Given Bandit is draining poop with pee also full
  When his poop empties
  Then he begins draining pee
  And his HUD reads "Need to Pee!"

Scenario: he ignores a tile that cannot take his channel
  Given Bandit is draining poop
  And a tile has pee room but its dirt is maxed
  Then that tile is not a relieve target for him
```

## Ambiguity log

| Question                                             | Resolution                                                     | Source                             |
| ---------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------- |
| One full channel, other partly loaded — drain which? | Only the full one                                              | user, 2026-08-09                   |
| Order when both are full                             | Poop first, then pee                                           | assumed (matches label precedence) |
| Channel filling mid-episode                          | Picked up when the queue is recomputed                         | assumed                            |
| Is ~20s of standing still too long?                  | It is the point — that is the opportunity cost being equalized | user intent, stated                |
