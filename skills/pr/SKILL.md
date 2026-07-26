---
name: pr
description: Pre-PR quality gate for Husky Simulator — run typecheck, lint, format check, and tests, then open a pull request with a structured summary. Use when the user says "create a PR", "open a PR", "ship this", or "I'm done with this feature".
---

# Pre-PR Quality Gate — Husky Simulator

Run the full gate below and **stop on the first failure**, reporting the exact
output. Only open the PR when every step passes.

## Gate

```bash
npm run build        # tsc --noEmit + vite build (typecheck + bundle)
npm run lint         # oxlint
npm run format:check # prettier --check
npm test             # vitest run
```

Optional deeper checks when the change is risky:

```bash
npm run test:coverage   # vitest + @vitest/coverage-v8
npm run test:mutation   # stryker run
```

## Open the PR

1. Ensure work is on a feature branch (never commit straight to `main`).
2. Push the branch.
3. Create the PR with `gh pr create` (install `gh` first if missing —
   `winget install --id GitHub.cli`), using a structured body:
   - **Summary** — what changed and why.
   - **Testing** — the gate output above (typecheck, lint, format, tests).
   - **Notes** — follow-ups or deferred items.

End the PR body with:

🤖 Generated with [Claude Code](https://claude.com/claude-code)
