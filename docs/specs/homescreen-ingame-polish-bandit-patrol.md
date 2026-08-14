<!-- spec-version: 10.18.2 -->

# Spec: Home-Screen & In-Game Polish + Bandit Patrol AI

**Format:** dev-team specs v10.18.2

## Intent Description

Polish three recently-shipped areas of Husky Simulator so they read clearly and
behave believably, shipped as **three thematic PRs** (the `/plan` phase slices
these):

1. **Home-screen polish.** Every menu text label must be legible against the
   sky/grass backdrop (today the "DIFFICULTY" label and the header/subtitle wash
   out over the light-blue sky). The two flanking dogs — currently the tiny
   in-game sprites upscaled — are replaced with higher-fidelity,
   **home-screen-only, hand-authored SVG** renderings that keep the in-game
   color scheme and cuteness but add enough detail that a new player immediately
   reads "the grey one is the husky (Blizzard), the brown one is the chihuahua
   (Bandit)." A bug where the hover/click hit boundaries of every menu control
   are offset from the visible button (clicking Puppy selects Husky; clicking
   left of Puppy selects Puppy) is fixed so hit bounds match visible bounds.

2. **In-game HUD & food fixes.** Food items currently render with an opaque
   black background box instead of just the food shape — fixed so only the food
   shape shows. The countdown timer moves out of the top-left corner to sit on
   the header row beside the Blizzard/Bandit scores, left-aligned to the Current
   Space panel; and the Blizzard stat section is tightened (smaller Food→Water
   gap) so it occupies the same vertical extent as the Current Space section.

3. **Bandit patrol AI.** When Bandit smells no food he currently darts around
   fast and erratically. Instead he slows to **half speed** and walks a cohesive
   street-search pattern — mostly following pavement, occasionally dipping into a
   larger yard and returning to the street — until a scent catches his nose, at
   which point he speeds back to full and beelines for the food. A **Dev-settings
   toggle** switches Bandit between this new advanced patrol mode (default) and
   his original "find the most valuable food anywhere and go for it" _omniscient_
   algorithm, reserved for a future harder difficulty.

## Architecture Specification

**Components affected**

| Slice | Component                                                    | Change                                                                                                                                                                                      |
| ----- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | `src/scenes/MenuScene.ts`                                    | Strengthen text contrast (shadow/stroke/backing); swap flanking dogs to new menu SVGs; fix control hit areas so visible bounds == hit bounds.                                               |
| A     | `src/scenes/PreloadScene.ts`                                 | Load the two new menu-only dog SVGs via the existing `load.svg` path.                                                                                                                       |
| A     | `src/assets/menu-husky.svg`, `src/assets/menu-chi.svg` (new) | Hand-authored higher-fidelity dog art, home-screen only.                                                                                                                                    |
| B     | `src/assets/treat.png`, `bowl.png`, `bag.png`                | Restore transparency (re-export RGBA with the opaque background made transparent), preserving the pixel-art look.                                                                           |
| B     | `src/scenes/UIScene.ts`                                      | Move timer to header row at `x = CS_X` (Current Space left edge), same `y` as score; reduce Food→Water row gap so the Blizzard section matches the Current Space section's vertical extent. |
| C     | `src/systems/AISystem.ts`                                    | Street-biased patrol; expose whether a move is a patrol step vs a chase step; mode selection (advanced vs omniscient). Stays Phaser-free and unit-tested.                                   |
| C     | `src/scenes/GameScene.ts`                                    | Set the Bandit tween duration from the patrol/chase signal (patrol = 2× duration = half speed); read the Bandit-mode flag live.                                                             |
| C     | `src/ui/DevPanel.ts` + runtime flag                          | A boolean "Bandit: omniscient" toggle (default off) read live by the AI.                                                                                                                    |

**Constraints**

- Pure gameplay logic in `AISystem.ts` remains framework-agnostic (no Phaser
  import) and unit-tested with Vitest; Phaser glue stays in the scenes.
- Runtime config is read at call-time (never destructured at import), per the
  existing `config` contract.
- New art loads through the SVG asset path already fixed for production in PR #3;
  no change to the Vite asset handling.
- In-game husky/chihuahua sprites are unchanged — the new art is menu-only.
- The Bandit-mode toggle is a **boolean** dev setting kept separate from the
  all-numeric `GameConfig` (so `parseConfig`/`serializeConfig`/profiles stay
  number-only); it is read live and takes effect without a restart.
- Omniscient mode is **dev-only** and is deliberately **not** wired to any
  difficulty in this change (explicit future work).
- TypeScript strict mode and ESM discipline hold throughout (the repo's
  ts-enforcer / esm-enforcer expectations).

**Root-cause notes**

- _Food black background_ — confirmed: `treat/bowl/bag.png` are PNG color-type 0
  (grayscale, **no alpha channel**), so they draw as opaque boxes. Fix restores
  an alpha channel; the transparent SVG variants still exist as a fallback
  reference but the pixel-art PNG appearance is retained.
- _Button hit-area offset_ — the container `setInteractive(Rectangle(-w/2,-h/2,
w,h), Contains)` math is correct in isolation, so the offset is a subtler
  input hit-area/transform interaction to be reproduced (click-through test) and
  root-caused during build; the acceptance test is behavioral (visible bounds ==
  hit bounds).

## Acceptance Criteria

**Slice A — Home-screen polish**

- **AC-A1** Every text element on the Menu scene — title, subtitle, "DIFFICULTY"
  label, each difficulty segment's name + subtitle, Start / How to Play /
  Credits labels, and the Dev Mode toggle — is clearly legible against its
  background (sky or grass) via sufficient contrast (shadow, stroke, and/or
  backing). The previously washed-out subtitle and "DIFFICULTY" label read
  clearly.
- **AC-A2** The home screen shows higher-fidelity, hand-authored **SVG**
  renderings of Blizzard (grey husky) and Bandit (brown chihuahua), used only on
  the Menu scene. They preserve the in-game palette and cuteness, are more
  detailed than the in-game sprites, and are unmistakably a grey husky vs a brown
  chihuahua. In-game sprites are unchanged.
- **AC-A3** Clicking or hovering anywhere within the visible rectangle of any
  menu control — each of the three difficulty segments, Start, How to Play,
  Credits, and the Dev Mode toggle — activates exactly that control, and clicks
  outside a control's visible rectangle never activate it. (Clicking Puppy
  selects Puppy; the old offset is gone.)

**Slice B — In-game HUD & food fixes**

- **AC-B1** Food items (treat, bowl, bag) render on the map showing only the
  food shape — no black/opaque background box — while keeping their current
  pixel-art appearance.
- **AC-B2** The countdown timer appears on the HUD header row at the same
  vertical position as the Blizzard/Bandit score readout, left-aligned to the
  left edge of the Current Space panel (`CS_X`). It no longer appears in the
  top-left corner.
- **AC-B3** The Blizzard stat rows (Food, Water, Poop, Pee) are spaced so the
  Blizzard section occupies the same vertical extent as the Current Space
  section, achieved by reducing the Food→Water gap; all four readouts and their
  bars stay aligned and readable.

**Slice C — Bandit patrol AI + dev toggle**

- **AC-C1** In advanced mode, when Bandit smells no food in range he moves at
  half his normal (difficulty-adjusted) per-tile speed.
- **AC-C2** While patrolling, Bandit follows a cohesive search pattern that keeps
  him predominantly on streets/pavement, continues along a street rather than
  reversing or jittering randomly, and only occasionally steps into an adjacent
  larger yard before returning to the street — replacing the current fast
  erratic wander.
- **AC-C3** The moment Bandit smells a food item, he switches to full speed and
  pathfinds directly toward the best-smelled food (existing value/distance
  targeting).
- **AC-C4** A Dev-settings toggle switches Bandit between advanced patrol mode
  (default) and omniscient mode. In omniscient mode he ignores smell range and
  always pathfinds toward the globally best available food (value/distance over
  all foods) at full speed, falling back to patrol only when no food exists at
  all. The toggle takes effect live (no restart).
- **AC-C5** Both modes preserve Bandit's existing behaviors — thirst-driven water
  seeking, eating on entering a food tile, and mess/affection effects. Omniscient
  mode is dev-only and is not wired to any difficulty in this change.

## Ambiguity Log

| Decision                                                    | Classification               | Resolved By | Rationale / Answer                                                                                                                                                               |
| ----------------------------------------------------------- | ---------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ship as 3 thematic PRs vs one                               | `requires-stakeholder-input` | human       | Answered up front: 3 thematic PRs (home-screen / HUD+food / Bandit AI), sequential.                                                                                              |
| Home-screen dog art format (procedural vs SVG vs pixel PNG) | `requires-stakeholder-input` | human       | Answered up front: hand-authored SVG art.                                                                                                                                        |
| Food black-background fix approach                          | `inferable`                  | inference   | PNGs are color-type 0 (no alpha) → restore transparency while keeping pixel-art look, rather than switching art style back to the SVGs the user deliberately replaced in PR #13. |
| Contrast-fix mechanism                                      | `inferable`                  | inference   | Strengthen legibility via shadow/stroke/backing (title already uses a shadow); exact styling is presentation detail, judged against the "clearly legible" bar.                   |
| "Half speed" reference point                                | `inferable`                  | inference   | Half of Bandit's normal difficulty-adjusted speed → patrol tween duration = 2× the chase duration.                                                                               |
| Precise "cohesive street-search" algorithm                  | `inferable`                  | inference   | Behavioral bar only (mostly-pavement, non-jittery, occasional yard dip then return); exact heuristic/tuning is implementation detail validated against AC-C2.                    |
| Dev-toggle storage & UX                                     | `inferable`                  | inference   | "Toggleable in Dev settings" → a boolean toggle in the DevPanel backed by a separate boolean flag (kept out of the numeric config serialize/profiles), read live.                |
| Omniscient mode's other behaviors                           | `inferable`                  | inference   | Keep thirst/eating/affection; only the food-targeting changes (global best, no smell gate, full speed); patrol only when no food exists.                                         |
| Omniscient → difficulty wiring                              | `inferable`                  | inference   | User stated it's future ("at some point"); explicitly out of scope now — dev toggle only.                                                                                        |
| Whether in-game sprites also change                         | `inferable`                  | inference   | User said "home-screen-only" → in-game sprites untouched.                                                                                                                        |

## Consistency Gate

- [x] Intent is unambiguous
- [x] Every behavior/goal maps to an acceptance criterion
- [x] Architecture constrains without over-engineering
- [x] Terminology consistent across artifacts
- [x] No contradictions between artifacts
- [x] Every gap/ambiguity finding is logged — inferable with rationale or resolved by human

**Verdict: PASS**
