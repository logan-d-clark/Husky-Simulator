# Spec: Tutorial teaching pass, HUD highlights, win-condition fix

Status: approved 2026-08-22
Date: 2026-08-22

A instructional-design pass over the walkthrough shipped in #33, plus two real
bugs it exposed.

---

## 1. BUG: you can "win" while dying

`GameOverScene` computes `won = huskyFood >= chiFood` and never looks at
`reason`. Run out of water with more food than Bandit and it says
**"Blizzard wins! 🏆"** over a screen that just told you he ran out of water.

The stated goal is: **survive the full round AND finish with more food than
Bandit.** So a win requires `reason === 'Time'`. Running dry is a loss however
far ahead you were — which is also what makes water pressure matter at all.

The result screen should say which of the two conditions you missed, rather
than only announcing the outcome.

---

## 2. BUG: the Zoom Zoom Chew stage ends before the zoomies do

Its objective is "the chew was used", which is true the instant it is pressed —
so the stage completes and the walkthrough finishes while Blizzard is still
standing there, and the player never sees the thing the item does.

The stage must wait for the effect to **finish**: used, _and_ no longer zooming.
That turns the last lesson into the demonstration it was meant to be.

---

## 3. Treats spawn on lawns, not in the street

The tutorial's first stage scatters treats by distance over grass _or_ pavement.
Measured from the start tile, the nearest nine candidates are **seven pavement,
one owned lawn, one public grass** — so most land in the road, where real food
never appears.

Spawns now require **family-owned grass**. There are 58 such tiles within
distance 8 of the start (nearest at 2), so the constraint costs nothing and the
first thing the player learns is where food actually comes from.

---

## 4. The copy teaches in the wrong order, and leaves holes

### Reordering

Relieving currently says fouling "costs that family some affection" three stages
before affection is introduced. Affection moves ahead of it:

| #    | Stage                                                                                                                 | Why here                      |
| ---- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 1    | Move — collect three treats **from a lawn**                                                                           | where food comes from         |
| 2    | Your card: food is your score, water is your life                                                                     | the two bars                  |
| 3    | Drink (**Q** for quench)                                                                                              |                               |
| 4    | **Whose lawn — affection, and what tolerance means**                                                                  | needed by 5, 6, 7             |
| 5    | Tricks (**E** for exercise) raise affection                                                                           | acting on it                  |
| 6    | Affection thresholds → better food                                                                                    | what it buys                  |
| 7    | Relieve (**C** crap, **Z** the noise) — costs affection scaled by **tolerance**, **and each spot only holds so much** | now says something meaningful |
| 8    | Bandit **has the same needs** and fouls whichever lawn likes you most                                                 | motivates items               |
| 9–12 | The four items                                                                                                        |                               |
| 13   | Recap, including how you actually win                                                                                 |                               |

### The holes being filled

- **What affection _does_.** Every house scores how much it likes you, and that
  score decides what it puts out. Higher affection, better food.
- **What tolerance means.** The pips are how much a family _minds_ a mess: how
  far their affection falls per drop of poop or pee on their lawn. More pips,
  more forgiving. Named when Current Space is first read (stage 4) and made
  actionable where it matters (stage 7) — pick a tolerant lawn to foul and you
  keep more of what you built.
- **Tile capacity.** A lawn spot holds only so much poop and pee; Current
  Space's two right-hand bars show how full _this_ spot is, which is why you
  cannot keep using the same one.
- **Where items come from.** You do not start with any. They turn up in random
  places around the map as the round goes on, more often the more food you are
  carrying, and one arrives free at every 1000 food. Stated on the first item
  stage, so the four that follow are understood as a tutorial hand-out rather
  than a starting loadout.
- **Bandit has needs too.** He fills up like you do, and when he does he heads
  for whichever lawn likes you most — which is exactly what the items are for.
- **How you win**, stated in stage 2 and again in the recap: last the whole
  round without running out, and finish with more food than Bandit.

---

## 5. Point at the thing you are talking about

When a stage refers to part of the HUD, that part is **outlined** while the
stage is active — a pulsing accent border around the named region.

| Region                        | Used by                       |
| ----------------------------- | ----------------------------- |
| Blizzard's card               | food/water                    |
| His water bar                 | drink                         |
| Current Space                 | whose lawn                    |
| The affection bar             | affection, tricks, thresholds |
| Current Space's poop/pee bars | tile capacity                 |
| Bandit's card                 | meeting Bandit                |
| The item belt                 | each item stage               |

Declared per stage as data (`highlight: 'affectionBar'`), so the script stays
pure and `UIScene` owns the geometry.

---

## 6. `E` for exercise, next to the meter it moves

The trick key gets its mnemonic wherever it is taught, and an **`E`** badge sits
beside the affection meter in Current Space — matching the Q/C/Z badges already
beside the bars they act on.

---

## Acceptance criteria

1. Running out of food or water is a loss regardless of score, and the result
   screen names which condition was missed.
2. Finishing on time with more food than Bandit is a win.
3. The zoomies stage completes only once the effect has ended.
4. Tutorial treats spawn only on family-owned grass.
5. Affection is introduced before anything refers to it.
6. The tutorial explains what affection does, what tolerance means, that lawn
   spots have limited capacity, that Bandit has the same needs, where items come
   from, and how the game is won.
7. Each HUD-referring stage visibly highlights the region it names.
8. An `E` badge sits beside the affection meter.
9. `npm run build`, `npm test`, `npm run lint`, `npm run format:check` green.

## Gherkin

```gherkin
Scenario: running dry is a loss
  Given Blizzard has more food than Bandit
  When he runs out of water
  Then the result screen says he lost
  And names running out of water as the reason

Scenario: surviving and out-scoring is a win
  Given the round ends on the timer
  And Blizzard finished with more food than Bandit
  Then the result screen says he won

Scenario: the chew demonstrates itself
  Given the tutorial is on the Zoom Zoom Chew stage
  When the player uses it
  Then the stage does not complete while he is still zooming
  And it completes once the effect ends

Scenario: food comes from lawns
  When the tutorial spawns its treats
  Then every one is on grass owned by a family

Scenario: nothing is mentioned before it is taught
  Then the affection stage comes before any stage whose copy mentions affection

Scenario: the HUD is pointed at
  Given a stage that names part of the HUD
  Then that region is outlined while the stage is active
```

## Ambiguity log

| Question                                       | Resolution                                                              | Source           |
| ---------------------------------------------- | ----------------------------------------------------------------------- | ---------------- |
| Is running dry a loss even when ahead on food? | Yes — win needs `reason === 'Time'` and more food                       | user, 2026-08-22 |
| When does the zoomies stage end?               | When the effect ends, not when the key is pressed                       | user, 2026-08-22 |
| Where do tutorial treats go?                   | Family-owned grass only                                                 | user, 2026-08-22 |
| Where is tolerance taught?                     | Named at stage 4 with the rest of the panel, made actionable at stage 7 | user, 2026-08-22 |
| Highlight style                                | Pulsing accent outline around the named region                          | assumed          |
| Is the item drop model explained?              | Yes — on the first item stage                                           | user, 2026-08-22 |
| Does the recap restate the win condition?      | Yes, and stage 2 states it early                                        | user, 2026-08-22 |
