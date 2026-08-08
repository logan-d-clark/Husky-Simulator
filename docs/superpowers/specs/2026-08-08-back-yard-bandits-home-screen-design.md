# Back Yard Bandits Home-Screen Design

**Date:** 2026-08-08  
**Status:** Approved visual direction; pending written-spec review

## Goal

Rename the game on the home screen to **Back Yard Bandits** and improve the
screen's readability without losing its cheerful summer atmosphere.

## Approved Direction

Use the recommended **Summer Ink** treatment from the visual comparison:

- Set the title to `Back Yard Bandits`.
- Replace the thick dark text strokes on the title, subtitle, and challenge
  header with clean, dark typography that contrasts directly with the pale sky.
- Use a friendly, highly readable system font stack led by `Trebuchet MS`, with
  Arial/sans-serif fallbacks so no font download or new asset is required.
- Render the title in deep summer-slate (`#263b4a`), bold, with only a restrained
  light shadow/highlight. The subtitle uses a slightly lighter slate tone.
- Change the subtitle to `Escape the yard. Gather treats. Rule the neighborhood.`
- Change the small section heading from `DIFFICULTY` to
  `CHOOSE YOUR CHALLENGE`, using the same clean type, dark warm-brown text, and
  modest letter spacing.

## Layout

- Keep the existing hand-authored `menu-husky.svg` and `menu-chi.svg` artwork.
  Do not replace or redraw either dog.
- Keep the sky gradient, clouds, sun, green horizon, grass, button styling, and
  difficulty segmented-control styling.
- Move the challenge heading and all three difficulty segments entirely below
  the green horizon. No portion of a difficulty segment may cross the horizon.
- Reflow the central actions below the difficulty selector so they do not
  overlap it.
- Keep `Start`, `How to Play`, and the bottom-left `Dev Mode` toggle.
- Remove the `Credits` button. No replacement credits entry is added in this
  change; the existing credit line remains available on the How to Play screen.

## Implementation Boundaries

The change is confined to `src/scenes/MenuScene.ts`. It does not alter game
rules, difficulty behavior, scene navigation, the dog image assets, or the
instructions scene. The existing click-area helper and control behavior remain
unchanged.

## Verification

- Run the complete unit-test suite.
- Run the TypeScript/Vite production build.
- Open the home screen in a browser and verify at the game's fitted canvas size:
  - the exact title reads `Back Yard Bandits`;
  - the three requested text elements have no thick stroke;
  - the title and subtitle remain legible over clouds and sky;
  - all difficulty segments sit fully below the horizon;
  - the existing Blizzard and Bandit illustrations are unchanged;
  - `Start`, `How to Play`, difficulty selection, and `Dev Mode` remain clickable;
  - no `Credits` button appears.

## Non-Goals

- Renaming repository metadata, package names, deployment paths, or in-game
  character names.
- Reworking the game map, HUD, instructions screen, or game-over screen.
- Adding downloadable fonts, new dog artwork, or a separate credits screen.
