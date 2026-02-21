# Eclipse Timer Documentation

This folder contains comprehensive documentation for the Eclipse Timer project—a monorepo for calculating and visualizing eclipse circumstances.

## Quick Start

**New to the project?** Start here:

1. [Setup and Development](guides/setup-and-development.md) – Install and configure your environment
2. [System Overview](high-level/system-overview.md) – Understand the architecture
3. [Contributing Guide](guides/contributing.md) – Learn how to make changes

## Documentation Map

### Guides (How-To)
- [Setup and Development](guides/setup-and-development.md) – Installation, common commands, monorepo workflow
- [Contributing Guide](guides/contributing.md) – Code style, testing, submission process
- [Deployment Guide](guides/deployment.md) – Building for release, EAS, app store submission
- [Troubleshooting Guide](guides/troubleshooting.md) – Common issues and solutions
- [Performance Optimization](guides/performance-optimization.md) – Profiling, bottlenecks, and optimization

### High-Level Documentation (Architecture & Behavior)
- [System Overview](high-level/system-overview.md) – Monorepo structure, package boundaries, data flow
- [User Flow and Product Behavior](high-level/user-flow-and-product-behavior.md) – User interactions, app states, screens
- [Wearable Companion Requirements](high-level/wearable-companion-requirements.md) – Requirements and design for wearable integration

### Low-Level Documentation (Implementation Details)
- [Data Contracts](low-level/data-contracts.md) – TypeScript types, catalog schema, data structures
- [Engine Algorithm](low-level/engine-algorithm.md) – Eclipse calculations, math, root solving
- [Mobile App Internals](low-level/mobile-app-internals.md) – React state, handlers, UI integration
- [Wearable Technical Design](low-level/wearable-companion-technical-design.md) – Implementation details for wearable

### Planning & Tracking
- [Documentation Plan](planning/01-documentation-plan.md) – Goals, standards, and maintenance triggers
- [In-App Alarm Rework Plan](planning/in-app-alarm-rework-plan.md) – Alarm system redesign proposal
- [Wearable Implementation Plan](planning/wearable-companion-implementation-plan.md) – Wearable rollout phases
- [Release Plan (EAS)](planning/release-plan-eas.md) – EAS build and release strategy
- [Self-Hosted macOS Runner](planning/self-hosted-macos-runner.md) – CI/CD setup for native builds
- [Tech Debt](planning/tech-debt.md) – Known issues and improvement areas

### Reference
- [CHANGELOG](reference/CHANGELOG.md) – Release history and version notes
- [Store Metadata](reference/store-metadata.md) – App store descriptions, screenshots, keywords
- [Store Privacy Declarations](reference/store-privacy-declarations.md) – Privacy policy and data handling
- [Testing Scenarios](reference/testing-scenarios.md) – QA test cases and edge cases

## Reading Paths by Role

### Product Owner / Project Manager
1. [System Overview](high-level/system-overview.md)
2. [User Flow and Product Behavior](high-level/user-flow-and-product-behavior.md)
3. [Wearable Companion Requirements](high-level/wearable-companion-requirements.md)
4. [Planning documents](planning/) as needed

### Mobile App Developer
1. [Setup and Development](guides/setup-and-development.md)
2. [System Overview](high-level/system-overview.md)
3. [User Flow and Product Behavior](high-level/user-flow-and-product-behavior.md)
4. [Mobile App Internals](low-level/mobile-app-internals.md)
5. [Data Contracts](low-level/data-contracts.md)

### Engine / Math Developer
1. [Setup and Development](guides/setup-and-development.md)
2. [System Overview](high-level/system-overview.md)
3. [Engine Algorithm](low-level/engine-algorithm.md)
4. [Data Contracts](low-level/data-contracts.md)

### Catalog / Data Developer
1. [Setup and Development](guides/setup-and-development.md)
2. [Data Contracts](low-level/data-contracts.md)
3. [Store Metadata](reference/store-metadata.md)

### QA / Tester
1. [Testing Scenarios](reference/testing-scenarios.md)
2. [Troubleshooting Guide](guides/troubleshooting.md)
3. [Deployment Guide](guides/deployment.md) (for release testing)

### Release Manager / DevOps
1. [Deployment Guide](guides/deployment.md)
2. [Release Plan (EAS)](planning/release-plan-eas.md)
3. [Self-Hosted macOS Runner](planning/self-hosted-macos-runner.md)

## Documentation Standards

- **Units are explicit**: Always include units (`hours`, `seconds`, `degrees`, `meters`, `UTC`)
- **Current behavior first**: Document what is, mark future or placeholder logic clearly
- **Code is source of truth**: Include direct file/line references to code
- **Examples are aligned**: Use `packages/catalog/src/catalog.sample.json` for examples
- **Searchable**: Use clear headings and organization

## When to Update Docs

Update documentation whenever these change:

- **Types**: `packages/shared/src/types.ts`
- **Engine**: `packages/engine/src/circumstances/compute.ts`, `functions.ts`
- **Mobile App**: `apps/mobile/src/App.tsx`, navigation, state management
- **Setup**: Root `package.json` scripts, `pnpm-workspace.yaml`, or `.env` files
- **User flows**: Major UI changes, new screens, or state transitions

See [Documentation Plan](planning/01-documentation-plan.md) for more details.

## Contributing to Docs

1. Use Markdown formatting for clarity
2. Link to related sections and external resources
3. Include code examples where helpful
4. Update the [Documentation Plan](planning/01-documentation-plan.md) if adding new docs
5. Keep the main README synchronized

---

**Have questions?** See [Troubleshooting Guide](guides/troubleshooting.md) or check relevant deep-dive documentation.
