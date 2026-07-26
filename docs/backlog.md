# Husky Simulator — Backlog

Working list of changes to drive through the dev-team pipeline
(**spec → plan → build → review → PR**). Created 2026-07-26.

## How to use this file

- **Features** → entry point is `/ship <item>` (runs the full pipeline) or
  `/specs` first if the item is fuzzy/large.
- **Bugs** → entry point is `/triage <item>` (investigates + writes a TDD fix
  plan), then `/build`.
- Fill in **Acceptance criteria** where you can — it's what the spec/plan gates
  need, and vaguer items will trigger more clarifying questions.
- One item = one vertical slice = ideally one PR. Split anything that's really
  several changes.
- Order matters: put dependencies above the items that need them, or note them.

**Status:** `backlog` → `spec` → `planned` → `building` → `review` → `shipped`
(update as an item moves; `blocked` if it's waiting on something)

**Priority:** `P0` critical · `P1` high · `P2` normal · `P3` nice-to-have

---

## Item template (copy this)

```
### <short title>
- **Type:** feature | bug
- **Priority:** P?
- **Status:** backlog
- **Depends on:** none
- **Description:** what & why, in a sentence or two.
- **Acceptance criteria:**
  - [ ] observable outcome 1
  - [ ] observable outcome 2
- **Notes:** links, repro steps (bugs), constraints, open questions.
```

---

## Features

<!-- drop feature items here -->

## Bugs

<!-- drop bug items here -->

## Parking lot (ideas, not yet committed)

<!-- half-formed ideas that aren't ready to plan -->
