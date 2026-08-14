# Spec: Procedural audio, trick/foul rebalance, and the dribble fix

Status: awaiting approval
Date: 2026-08-09

Four independent workstreams in one round. The balance and bug fixes are small
and self-contained; the audio system is a new subsystem and the bulk of the work.

---

## 1. Audio

No audio assets exist in the repo, and none will be added: every sound is
**synthesized at runtime via Web Audio**. Zero binary assets, zero dependencies,
no bundler config, and every sound stays tunable from the dev panel — matching
how the art is hand-authored SVG rather than imported.

### Architecture

| Module                     | Role                                                                     | Tested |
| -------------------------- | ------------------------------------------------------------------------ | ------ |
| `src/audio/cues.ts`        | Pure data: each cue as a list of tone steps (freq, duration, wave, gain) | yes    |
| `src/audio/music.ts`       | Pure generative sequencer: `barNotes(bar, rng)`                          | yes    |
| `src/audio/warnings.ts`    | Pure edge-detector: which warnings fire this tick                        | yes    |
| `src/audio/AudioEngine.ts` | Thin Web Audio adapter — the only browser-coupled file                   | no     |

All logic lives in the three pure modules; the adapter just turns tone steps
into oscillator nodes. Vitest runs in `node`, which has no Web Audio, so this
split is what makes the feature testable at all.

### Background music

A slow (~92 BPM) major-pentatonic melody over a **I–V–vi–IV** progression in a
warm key, soft triangle lead over a rounded square bass — summer-porch, not
arcade.

"Catchy but not repetitive" is handled structurally: the **chord progression is
fixed** (so it stays coherent and hummable) while the **melody is generated per
bar** from the current chord's pentatonic with a seeded RNG and varying rhythm.
Bars never repeat exactly, but always belong to the same tune. Plays at low gain
under everything else.

### Action cues — Blizzard

Bright and ascending; he is the player.

| Trigger       | Sound                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------- |
| Picks up food | Short rising two-note blip, **pitched up by food value** so a bag reads richer than a treat |
| Drinks        | Quick descending "gulp"                                                                     |
| Pees          | Soft descending tone                                                                        |
| Poops         | Low double-thud                                                                             |
| Does a trick  | Cheerful three-note rising arpeggio — the reward action                                     |

### Mode cues — Bandit

Darker timbre, lower, and quieter — he is the rival, and these are ambient
intelligence rather than feedback on your own input. Fires **on the transition**,
once per mode change, never per tick.

| Transition          | Sound                                                  |
| ------------------- | ------------------------------------------------------ |
| → treat seeking     | Neutral two-note                                       |
| → relief (poop/pee) | Low descending motif — he is coming for your best yard |
| → water             | Mid burble                                             |

### Warning cues

Edge-triggered when a stat crosses into danger, **not** repeated every tick.
Each re-arms only after the stat recovers past the threshold by a 10% margin, so
hovering on the boundary cannot machine-gun the sound.

| Warning      | Config key       | Default | Note                                                                                                   |
| ------------ | ---------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| Food low     | `WARN_FOOD_LOW`  | 20      | Replaces `UIScene`'s hardcoded `LOW_FOOD = 20`, so the HUD reddening and the sound share one threshold |
| Water low    | `WARN_WATER_LOW` | 30      | `WATER_CAP` is 125, so ~24%                                                                            |
| Needs to pee | `WARN_PEE_HIGH`  | 80      | Of `PEE_MAX` 100                                                                                       |

Plus `MUSIC_VOLUME` (0.18) and `SFX_VOLUME` (0.5). The dev panel enumerates
`Object.keys(DEFAULTS)`, so all five appear there automatically with no panel
changes.

### Browser autoplay

An `AudioContext` starts suspended until a user gesture. It is resumed on the
menu's Start button — a real click, so it always satisfies the policy. `M`
toggles mute.

---

## 2. Tricks cost water, not food

`WorldActions.trick` currently spends one `TRICK_COST` from **both** food and
water. Food is the score currency and Bandit never tricks, so that food charge
was the _entire_ score-relevant asymmetry between the two dogs — everything else
(movement decay, heat, digestion) already hits both equally.

Split into `TRICK_FOOD_COST` (**0**) and `TRICK_WATER_COST` (**1**). Blizzard
still pays a real price — a tick standing still per trick, plus trips to the
pond — but no longer burns score to build affection.

---

## 3. Foul cost rebalance

Post-#27, Bandit empties a bar in 99 drops of 1 affection × sensitivity, so a
single visit could strip up to 495 affection against a cap of 100 — any yard
zeroed, regardless of how much was invested in it.

Family sensitivities in `owners.ts` are `1,1,1,1,1,1,2,2,3,3,3,3,3,3,4,4,4,4,5`
— **median 3**. So the "average tolerance yard" is sensitivity 3, and the target
is calibrated there.

Setting `POOP_COST` = `PEE_COST` = **0.084** (from 1):

| Yard                           | Sensitivity | Affection lost to one full load | Result from 100% |
| ------------------------------ | ----------- | ------------------------------- | ---------------- |
| Most forgiving                 | 1           | 8.3                             | 92%              |
| Average (median)               | 3           | **24.9**                        | **75%**          |
| Least forgiving (The Grumbles) | 5           | 41.6                            | 58%              |

That satisfies all three of the stated constraints: no more than 25% at the
average yard, less for forgiving ones, more for harsh ones.

Applies to **both** dogs (one shared constant). Blizzard relieving in his own
farmed yard therefore also hurts less — a mild reduction in camping cost, noted
and accepted.

---

## 4. BUG: fouling while walking at low levels

### Reproduced, and the reported mechanism is innocent

Driven in the running game with poop set to 20 (well under `POOP_MAX`):

| Scenario                  | Fouling produced                               |
| ------------------------- | ---------------------------------------------- |
| No key held               | **0 dirt, 0 destruction**                      |
| `action = 'poop'` latched | **19 dirt**, poop drained 20 → 1 while walking |

`WorldActions.autoDump` is correctly gated on `inv.poop >= POOP_MAX` and never
fired. The real cause is `GameScene.action`: a latch set on keydown and cleared
only on keyup, which `simTick` then applies **every tick regardless of level or
motion**. A missed keyup (alt-tab, focus loss) latches it forever; even without
that, holding C while walking fouls every grass tile crossed.

[GameScene.ts:307](../../src/scenes/GameScene.ts#L307) labels this block
`// 3) standing actions` but never checks that he is standing.

### Fix

Gate poop/pee/trick/drink on **not currently mid-glide**, making the code match
its own label. Walking never fouls; only `autoDump` at max does, which is the
behaviour expected in the report. This fixes the latched-key case and the
hold-C-while-walking case with one condition.

Control change: you must stop moving to poop, pee, trick, or drink.

---

## Acceptance criteria

1. Music plays under the game, loops without exact repetition, and is quiet
   enough to sit under the sound effects.
2. Each of Blizzard's five actions plays its own distinct cue.
3. Bandit's three mode transitions each play a cue, once per transition.
4. The three warnings fire on crossing their configured thresholds and do not
   repeat while the stat sits in the danger zone.
5. All five audio config values are tunable from the dev panel.
6. Audio starts correctly under browser autoplay policy; `M` mutes.
7. A trick costs water and no food.
8. A full Bandit load costs an average (sensitivity-3) yard ~25 affection.
9. Blizzard produces no fouling while moving, at any level.
10. `npm run build` and `npm test` green.

## Gherkin

```gherkin
Scenario: the melody varies
  Given the music is playing
  When two different bars are generated
  Then their notes are not identical
  And every note belongs to the current chord's scale

Scenario: a warning fires once, not every tick
  Given Blizzard's food is above WARN_FOOD_LOW
  When it falls below the threshold
  Then the low-food warning fires exactly once
  And it does not fire again while food stays low

Scenario: a warning re-arms after recovery
  Given the low-food warning has fired
  When Blizzard eats back above the threshold plus its margin
  And his food falls below the threshold again
  Then the low-food warning fires again

Scenario: a trick spends water only
  Given Blizzard has food and water
  When he does a trick
  Then his water decreases
  And his food is unchanged

Scenario: an average yard survives a full load
  Given a sensitivity-3 yard at 100 affection
  When Bandit empties a full bar onto it
  Then its affection is about 75

Scenario: walking never fouls
  Given Blizzard's poop is below the maximum
  And the poop action is held
  When he is mid-glide between tiles
  Then no waste is dropped

Scenario: standing still still works
  Given Blizzard is stationary on grass with poop to spare
  When the poop action is held
  Then he drops poop each tick
```

## Ambiguity log

| Question                                       | Resolution                                  | Source                   |
| ---------------------------------------------- | ------------------------------------------- | ------------------------ |
| Synthesized audio or bundled files?            | Procedural Web Audio, no assets             | user, 2026-08-09         |
| How far to take the dribble fix?               | Gate all standing actions on not-moving     | user, 2026-08-09         |
| Does the foul reduction apply to Blizzard too? | Yes — one shared constant                   | user, 2026-08-09         |
| What is an "average tolerance" yard?           | Median family sensitivity = 3               | derived from `owners.ts` |
| Warning repeat behaviour                       | Once on crossing, re-arm after 10% recovery | assumed                  |
| Mute control                                   | `M` key; no persistence                     | assumed                  |
