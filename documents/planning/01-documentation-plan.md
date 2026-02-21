# Documentation Plan

## Goal

Establish a maintainable documentation set that explains:
- What the app does and how the monorepo is organized.
- How runtime behavior works from map interaction to eclipse calculation output.
- How internal computation logic and data contracts are implemented.

## Audience

- Product or project owners who need a system-level view.
- Developers onboarding to mobile app or engine work.
- Contributors extending the catalog, types, or eclipse algorithm.

## Deliverables

### High-Level Documentation
- `documents/high-level/system-overview.md`
  - Monorepo architecture, package boundaries, runtime data flow.
- `documents/high-level/user-flow-and-product-behavior.md`
  - End-user behavior, states, and interaction model.
- `documents/high-level/development-workflow.md`
  - Setup, scripts, monorepo workflow, and current engineering constraints.

### Low-Level Documentation
- `documents/low-level/data-contracts.md`
  - Shared TypeScript contracts and catalog schema semantics.
- `documents/low-level/engine-algorithm.md`
  - Computation stages, math helpers, root solving, and output derivation.
- `documents/low-level/mobile-app-internals.md`
  - React Native state model, handlers, and UI-to-engine integration details.

## Documentation Standards

- Keep units explicit (`hours`, `seconds`, `degrees`, `meters`, `UTC`).
- Document current behavior first; clearly mark future or placeholder logic.
- Treat code as source of truth and include direct path references.
- Keep examples aligned with `packages/catalog/src/catalog.sample.json`.

## Ongoing Maintenance Triggers

Update docs whenever any of these change:
- `packages/shared/src/types.ts`
- `packages/engine/src/circumstances/compute.ts`
- `packages/engine/src/circumstances/functions.ts`
- `apps/mobile/src/App.tsx`
- Root or package-level scripts in `package.json`

## Open Gaps Identified

- Test strategy is not yet implemented (`test` scripts are placeholders).
- Linting strategy is not yet implemented (`lint` scripts are placeholders).
- `deltaTSecondsApprox` exists but is not currently used by `computeCircumstances`.
