# Spec: HUD item pills, penned-Bandit countdown, rawhide timer

Status: awaiting approval
Date: 2026-08-14

Three read-at-a-glance improvements. All presentation — no game rules change.

---

## 1. Item slots become pills

The item belt currently reads as a loose run of `1 🦴 2  2 🔊 1 …`, so which
number goes with which icon is inferred from spacing alone. Each slot gets a
rounded-pill background enclosing its hotkey, icon and count, making the
grouping structural rather than typographic.

```
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ 1 🦴  2 │ │ 2 🔊  1 │ │ 3 🧷  3 │ │ 4 ⚡  0 │
└─────────┘ └─────────┘ └─────────┘ └─────────┘
```

- Drawn into the existing per-frame `Graphics` layer, so no new objects per tick.
- A slot at zero keeps today's dimming, applied to the pill as well as its
  contents, so an unusable item reads as unavailable at a glance.
- Four slots at the existing 82px pitch fit inside Blizzard's card (last pill
  ends at 346, card floor 358).

---

## 2. Bandit's card becomes a countdown while he's penned

While the gate is shut his food/water/poop/pee are frozen by design (#29), so
four flat bars and a permanent "Looking for Treats" tell the player nothing. The
one fact that matters is when he gets out.

For the duration of the pen, replace the four stat rows, their three bars, and
the goal line with:

```
        Leaves the yard in:

              2:35
```

- His `🐕 BANDIT` header stays — the card is still his.
- Formatted `M:SS`, sharing one `formatClock()` helper with the round timer
  rather than duplicating the `padStart` arithmetic a second time.
- The moment the gate opens the card reverts to the normal stat block, with no
  further state to unwind.

`getHudState` gains `chiPenned` and `chiPennedSeconds`. The countdown reads the
same `gateSecondsLeft` the gate itself runs on, so the number on screen cannot
drift from the moment he actually leaves.

---

## 3. A countdown on the rawhide while he chews

The repeller already shows its remaining seconds beside it; the rawhide — the
item whose whole value is _how long_ Bandit is out of action — shows nothing.

Add the same label above the rawhide, in the same raw-seconds style, **visible
only while he is actually chewing**. That matches the mechanic: the timer does
not start until he arrives, so showing a number before then would imply a
countdown that is not running.

Torn down with the rawhide when it is finished.

---

## Acceptance criteria

1. Each item slot renders as a pill containing its hotkey, icon and count.
2. A zero-count pill is visibly dimmed.
3. While the gate is shut, Bandit's card shows only the header and a `M:SS`
   countdown — no stat labels, no bars, no goal line.
4. The countdown matches the real time remaining, and the card returns to normal
   the moment the gate opens.
5. The rawhide shows a seconds countdown while, and only while, Bandit is
   chewing it.
6. `npm run build`, `npm test`, `npm run lint` and `npm run format:check` green.

## Gherkin

```gherkin
Scenario: the belt shows which key does what
  Then each item slot is drawn as one pill containing its key, icon and count

Scenario: an item he does not have reads as unavailable
  Given Blizzard has no Zoom Zoom Chews
  Then that pill is dimmed

Scenario: the rival's card counts him out of the yard
  Given the gate is shut with 155 seconds left
  Then Bandit's card reads "Leaves the yard in:" above "2:35"
  And none of his stat bars or labels are shown

Scenario: it goes back to normal when he is loose
  When the gate opens
  Then his card shows his food, water, poop, pee and current goal again

Scenario: the rawhide counts down only once he is on it
  Given a rawhide is deployed and Bandit has not reached it
  Then no countdown is shown above it
  When he arrives and begins chewing
  Then a countdown appears and decreases each second
```

## Ambiguity log

| Question                                            | Resolution                                     | Source                                                |
| --------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| Does the countdown replace the `BANDIT` header too? | No — only the stat rows, bars and goal line    | user's wording                                        |
| Rawhide timer before he arrives                     | Hidden; the timer genuinely is not running yet | derived from the mechanic                             |
| Rawhide format                                      | Raw seconds, matching the repeller             | user ("like the counter for the sonic dog repellant") |
| Gate countdown format                               | `M:SS`, shared with the round timer            | user's `2:35` example                                 |
