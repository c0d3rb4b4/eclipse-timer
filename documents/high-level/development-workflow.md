# Development Workflow

## Prerequisites

- Node.js 18+
- pnpm
- Expo tooling for mobile development

## Common Commands

From repository root:

```bash
pnpm install
pnpm dev:mobile
pnpm typecheck
pnpm lint
pnpm test
```

Package-specific useful command:

```bash
pnpm -C packages/engine dev:one
```

This executes `packages/engine/src/dev/run_one.ts` and prints sample circumstances for two coordinates.

## Monorepo Notes

- Workspace config is in `pnpm-workspace.yaml`.
- Shared TypeScript compiler options are in `tsconfig.base.json`.
- App/package tsconfigs extend the base file.

## Mobile Monorepo Bundling

`apps/mobile/metro.config.js` is configured to:
- Watch the workspace root.
- Resolve modules from both app-local and workspace `node_modules`.
- Include `ts`/`tsx` source extensions for workspace package code.

## Current Quality Gates

- Typechecking is implemented for all packages.
- Linting and tests are placeholders and should be replaced with real tooling.

## Recommended Team Cadence

- Run `pnpm typecheck` before commits.
- Update `documents/` when changing algorithms, types, or user-visible flows.
- Keep `catalog.sample.json` and docs aligned when adding new eclipse records.
