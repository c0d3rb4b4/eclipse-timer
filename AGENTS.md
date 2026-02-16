# AGENTS.md

## What this repo is
- Primary goal: keep changes small, testable, and easy to review.
- Default approach: prefer the simplest working solution over clever abstractions.

## How to work
- Before coding:
  - Identify the entry point(s) and the minimal set of files to change.
  - If requirements are unclear, make a reasonable assumption and state it in the PR/summary.
- While coding:
  - Make incremental edits; avoid sweeping refactors unless requested.
  - Preserve existing patterns unless they’re clearly wrong.
  - Keep diffs small and readable.
- After coding:
  - Run the fastest relevant checks (lint/tests/build).
  - Update docs/comments only when behavior or public APIs change.

## Project commands (edit to match)
- Install: `npm install` / `pnpm install` / `yarn`
- Dev: `npm run dev`
- Test: `npm test`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Build: `npm run build`

## Code style
- Match existing formatting and conventions in the touched files.
- Prefer:
  - clear names over short names
  - early returns over deep nesting
  - pure functions where practical
- Avoid:
  - introducing new dependencies without strong reason
  - changing unrelated code just to “clean up”

## Testing expectations
- If you change logic, add/adjust tests.
- If tests are absent, add at least one minimal regression test when feasible.
- For UI changes, include a short “how to verify” note.

## Documentation expectations
- Update README/docs when:
  - setup steps change
  - env vars/config changes
  - public APIs/CLI flags change
- Otherwise, don’t add “fluff” documentation.

## Safety / correctness guardrails
- Never commit secrets (keys, tokens, connection strings).
- If unsure about security implications, choose the safer default and explain tradeoffs.

## Commit / PR notes (if applicable)
- Summary should include:
  - what changed
  - why it changed
  - how to test
  - any assumptions/limitations

## Skills (optional)
If a task repeats (release steps, scaffolding, codegen, migrations), consider creating a reusable “skill”:
- Put a short “Skill: <name>” section here describing:
  - when to use it
  - inputs required
  - commands/scripts to run
