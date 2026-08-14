# Spec: Dev-panel item buttons + formatter cleanup

Status: awaiting approval
Date: 2026-08-13

Two unrelated pieces of housekeeping, shipped together but committed separately
so the formatting churn cannot bury the feature.

---

## 1. Dev-panel item buttons

Four buttons in the dev panel, one per item, each granting one of that item so
their behaviour can be exercised without waiting for a random drop or a
1000-food milestone.

- A labelled `ITEMS` section, matching how the Bandit AI toggle already gets its
  own section rather than being folded into the numeric key loop.
- Each button routes through GameScene's existing `giveItem()` — the **same**
  path a real pickup takes. So the first-pickup tutorial (and its queueing)
  fires from the panel too, and a bug there shows up in dev rather than hiding
  behind a shortcut. Cost: a dismissable pause the first time each type is
  granted in a round.
- Wired through a new `onGrantItem` callback on the existing options object,
  beside `onRestart`.

---

## 2. Formatter cleanup

`npm run format:check` has failed on every quality gate for six PRs. The
diagnosis is that it was never configured, not that the code drifted.

### What's actually wrong

| Cause | Effect |
| --- | --- |
| No `.prettierrc` at all | Prettier runs on defaults: 80 columns, double quotes — against a codebase written at ~110 columns with single quotes, so **every line of every file** is "wrong" |
| No `.gitattributes`, `core.autocrlf=true` | Files land on disk as CRLF while Prettier's default `endOfLine: "lf"` expects LF, so ~20 files fail on line endings alone. This is also the `LF will be replaced by CRLF` warning printed on every commit this session |

93 files fail today. With a config that matches the code as actually written,
the genuine formatting delta is **73 files / ~2,647 lines**.

### The fix

1. **`.gitattributes`** with `* text=auto eol=lf` — canonical LF in the repo and
   on disk regardless of platform or `autocrlf`. Kills the CRLF commit warnings
   permanently and makes `endOfLine: "lf"` deterministic in CI and locally
   (rather than `"auto"`, which quietly depends on the checkout).
2. **`.prettierrc`** matching the existing style: `singleQuote`, `printWidth`
   110, `endOfLine: "lf"`.
3. **`prettier --write`** across the repo, as its **own commit**.
4. **`.git-blame-ignore-revs`** naming that commit, so `git blame` still points
   at the author of a line rather than the reformat.

### What this costs

Prettier will unmake compact idioms this codebase uses deliberately:

```
- export interface Repeller { tile: TileCoord; secondsLeft: number }
+ export interface Repeller {
+   tile: TileCoord;
+   secondsLeft: number;
+ }

- const alive: T[] = [], expired: T[] = [];
+ const alive: T[] = [],
+   expired: T[] = [];
```

Accepted deliberately (user, 2026-08-13): a formatter that never runs is worse
than the idioms it flattens, and `CLAUDE.md` already declares Prettier as this
repo's formatter.

---

## Acceptance criteria

1. Four dev-panel buttons, one per item, each granting one of that type.
2. They use the same grant path as a real pickup, tutorial included.
3. The buttons appear only in dev mode (the panel already is dev-only).
4. `npm run format:check` passes.
5. Line-ending warnings stop appearing on commit.
6. The formatting reflow is a separate commit from the feature, listed in
   `.git-blame-ignore-revs`.
7. `npm run build`, `npm test` and `npm run lint` stay green.

## Gherkin

```gherkin
Scenario: granting an item from the panel
  Given the dev panel is open and Blizzard has no rawhide
  When the Rawhide button is clicked
  Then he has one rawhide
  And the HUD item row shows it

Scenario: the panel exercises the real path
  Given Blizzard has never picked up a repeller this round
  When the Repeller button is clicked
  Then the first-pickup tutorial appears, exactly as it would from the map

Scenario: the formatter agrees with the codebase
  When format:check runs
  Then it reports no issues

Scenario: blame survives the reflow
  When git blame runs against the ignore-revs file
  Then lines are attributed to their author, not to the formatting commit
```

## Ambiguity log

| Question | Resolution | Source |
| --- | --- | --- |
| Adopt Prettier or retire it? | Adopt: configure, then reformat | user, 2026-08-13 |
| Do panel grants fire the tutorial? | Yes — same path as a real pickup | user, 2026-08-13 |
| `endOfLine: auto` or `lf` + `.gitattributes`? | `lf` + `.gitattributes`; `auto` depends on the checkout and would differ between CI and a Windows dev box | derived |
| Separate commit for the reflow? | Yes, plus `.git-blame-ignore-revs` | assumed |
