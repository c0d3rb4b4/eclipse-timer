# Eclipse Timer Documentation

This folder contains the project documentation for the `eclipse-timer` monorepo.

## Documentation Map

### Planning
- `documents/01-documentation-plan.md`
- `documents/CHANGELOG.md`
- `documents/in-app-alarm-rework-plan.md`
- `documents/release-plan-eas.md`
- `documents/self-hosted-macos-runner.md`
- `documents/wearable-companion-implementation-plan.md`

### High-Level
- `documents/high-level/system-overview.md`
  - Includes Mermaid component and sequence architecture diagrams.
- `documents/high-level/user-flow-and-product-behavior.md`
- `documents/high-level/development-workflow.md`
- `documents/high-level/wearable-companion-requirements.md`

### Low-Level
- `documents/low-level/mobile-app-internals.md`
- `documents/low-level/engine-algorithm.md`
- `documents/low-level/data-contracts.md`
- `documents/low-level/wearable-companion-technical-design.md`

## Reading Order
1. `documents/high-level/system-overview.md`
2. `documents/high-level/user-flow-and-product-behavior.md`
3. `documents/low-level/data-contracts.md`
4. `documents/low-level/engine-algorithm.md`
5. `documents/low-level/mobile-app-internals.md`
6. `documents/high-level/wearable-companion-requirements.md`
7. `documents/low-level/wearable-companion-technical-design.md`

## Maintenance
- Update high-level docs when package boundaries, app behavior, or scripts change.
- Update low-level docs whenever equations, types, or state transitions change.
- Prefer linking to code paths as source of truth.
