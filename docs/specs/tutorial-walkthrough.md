# Spec: Hands-on tutorial walkthrough

Status: awaiting approval
Date: 2026-08-14

An optional guided run from the main menu that teaches the controls, how to read
the HUD, and all four items — by playing, not by reading. One mechanic at a
time, each with room to practise before the next arrives.

Budget: **5–10 minutes**. Thirteen stages at roughly 30 seconds each.

---

## 1. It teaches the real game

The tutorial runs the **actual `GameScene` on the actual map**, with a director
layered on top. No mock, no second map to keep in sync — what they learn is
literally the code path they will play.

The director's whole job is to make the neighbourhood behave predictably:

- suppress random food and item drops, and place exactly what the current stage
  needs, near the player
- keep Bandit penned until it is his turn
- grant the item a stage is about to teach
- watch for the stage's objective and move on when it is met

`simTick`'s six numbered steps are already the seams for this — dispensing (4),
Bandit (5) and the clock (6) each get one gate.

---

## 2. Nothing can end the run — but mistakes are still called out

Running out of food or water does **not** end a tutorial run. Instead it raises a
coaching panel naming what went wrong and how to fix it:

> **You ran out of water.**
> In a real game that ends your run on the spot.
> Ponds are the blue tiles — stand next to one and hold **Q** to drink.

The bars still drain normally, so "watch your water" stays a real lesson; what
is removed is the loss screen, not the consequence. Each warning fires **once**
per run, and nothing is auto-refilled — the player fixes it themselves, which is
the point.

There is no round countdown, so nobody is hurried while reading a panel.

---

## 3. The stages

Instructions live in a **persistent banner** above the play area showing the
current lesson and its progress, not a modal — the player is meant to be playing
while they read. Modals are reserved for the coaching warnings and the closing
summary.

| #   | Stage                                                          | They practise until       |
| --- | -------------------------------------------------------------- | ------------------------- |
| 1   | Move with WASD                                                 | 3 treats collected        |
| 2   | Your card: food, water, and what walking costs                 | 15 tiles walked           |
| 3   | Drink at a pond with Q                                         | topped back up            |
| 4   | Poop and pee with C / Z — grass only                           | bar drained               |
| 5   | Current Space: whose lawn, and how much they like you          | standing on a family yard |
| 6   | Tricks with E — cost water, buy affection                      | 5 tricks                  |
| 7   | The markers on the Likes-you bar: bowl 50, bag 90, pup cup 100 | affection past a marker   |
| 8   | Meet Bandit, penned — his card counts him out                  | the gate opens            |
| 9   | Rawhide (1) — pulls him off anything and pins him              | dropped, and he takes it  |
| 10  | Sonic Repeller (2) — fences him out of an area                 | dropped                   |
| 11  | Doggy Diaper (3) — empty out, no mess                          | used                      |
| 12  | Zoom Zoom Chew (4) — hands off the wheel                       | used                      |
| 13  | Summary → main menu                                            | —                         |

Each stage may **set up** the world (place a treat, fill a bar, grant an item,
release the gate) so the lesson is always reachable without waiting on luck.

---

## 4. Getting in and out

- A **Tutorial** button on the main menu, between Start and How to Play.
- `Esc` leaves at any time, straight back to the menu.
- Finishing shows a summary panel recapping the controls and the four items,
  then returns to the menu so the player picks their own difficulty for a real
  round.

Nothing is persisted: no completion flag, no unlocks. Replayable any time.

---

## Architecture notes

| Module                            | Role                                                                                          | Tested  |
| --------------------------------- | --------------------------------------------------------------------------------------------- | ------- |
| `src/systems/TutorialScript.ts`   | Pure data: the stage list, each with copy, an objective predicate and optional world setup    | yes     |
| `src/systems/TutorialDirector.ts` | Pure state machine: current stage, per-stage counters, advancement, which warnings have fired | yes     |
| `GameScene`                       | Applies setups, bumps counters on real events, renders the banner                             | browser |
| `TutorialScene`-free              | Reuses `GameScene` via `init({ tutorial: true })` rather than a parallel scene                | —       |

Objectives read a `TutorialState` snapshot — inventory, current tile and owner,
items held, Bandit's goal, gate state — plus **per-stage counters** the scene
bumps on real events (`ate`, `drank`, `pooped`, `tricked`, `stepped`,
`deployed:<item>`). Counters reset on every stage change, so "3 treats" means
three _this_ stage.

Keeping the script and the director pure is what makes a thirteen-stage
walkthrough testable at all: the whole progression can be driven in a unit test
without Phaser.

## Acceptance criteria

1. A Tutorial button on the main menu starts the walkthrough.
2. Stages advance only when their objective is met, in order.
3. Each stage's instruction and progress are visible while playing.
4. Random food and item drops are suppressed; each stage's needs are placed.
5. Bandit stays penned until his stage.
6. Food or water hitting zero raises a coaching panel and does not end the run.
7. Each coaching warning fires at most once per run.
8. There is no round timer and no game-over during the tutorial.
9. All four items are granted and taught.
10. Esc exits to the menu; finishing shows a summary and returns to the menu.
11. A normal (non-tutorial) game is completely unaffected.
12. `npm run build`, `npm test`, `npm run lint` and `npm run format:check` green.

## Gherkin

```gherkin
Scenario: one mechanic at a time
  Given the tutorial is on the "move" stage
  When the player has collected two of the three treats
  Then the stage does not advance
  When they collect the third
  Then the next stage begins and its counters start from zero

Scenario: the world is made predictable
  Given the tutorial is running
  Then no random food or item drops occur
  And each stage places what it needs

Scenario: a mistake is taught, not punished
  Given the tutorial is running and the player's water reaches zero
  Then the run does not end
  And a panel explains what happened and how to fix it
  And it does not appear a second time that run

Scenario: the rival waits his turn
  Given the tutorial has not reached Bandit's stage
  Then Bandit is still penned

Scenario: leaving early
  When the player presses Esc
  Then they return to the main menu

Scenario: a real game is untouched
  Given a normal game is started from the menu
  Then food drops, item drops, the round timer and game-over all behave as before
```

## Ambiguity log

| Question                              | Resolution                                                                             | Source                                |
| ------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------- |
| Real map or a dedicated tutorial map? | Real map, steered by the director                                                      | user, 2026-08-14                      |
| Can the player fail?                  | No — but each failure raises a coaching panel saying what went wrong and how to fix it | user, 2026-08-14                      |
| What happens at the end?              | Summary panel, then back to the menu                                                   | user, 2026-08-14                      |
| One PR or two?                        | One                                                                                    | user, 2026-08-14                      |
| Instructions: banner or modal?        | Persistent banner while playing; modals only for warnings and the summary              | derived from "hands on"               |
| Which mistakes are coached?           | The two real loss conditions, food and water                                           | derived — those are what "fail" means |
| Is completion persisted?              | No                                                                                     | assumed                               |
