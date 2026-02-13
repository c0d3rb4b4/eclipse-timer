# eclipse-timer

`eclipse-timer` is a TypeScript monorepo for an eclipse-focused mobile app and a reusable eclipse computation engine.

It combines:
- A React Native + Expo app for selecting an eclipse, choosing an observer location, and viewing event timings.
- A Besselian-element-driven engine that computes local contact circumstances (`C1/C2/MAX/C3/C4`), local eclipse kind, magnitude, and duration.
- Catalog tooling for generating typed eclipse datasets and map overlay polygons.

## Project Overview

The current MVP is built around a two-screen flow:

1. **Landing screen**
   - Loads eclipse records from the local generated catalog.
   - Sorts eclipses by date and marks entries as past/upcoming.
   - Shows a preview animation URL (NASA animation endpoint per eclipse).
2. **Timer screen**
   - Displays a map with observer marker and eclipse overlays (visible band + central band when available).
   - Lets the user set location via map tap/drag, GPS, or jump-to-center preset.
   - Runs the engine for the selected eclipse at the observer location.
   - Shows contact times, next-event countdown, and alarm toggles/test alarm behavior.

## Monorepo Architecture

### Packages

- `apps/mobile`
  - Expo app (navigation, landing flow, timer/map UI, GPS integration, engine trigger).
- `packages/engine`
  - Eclipse circumstance solver and numeric helpers.
- `packages/catalog`
  - Generated eclipse catalog + scripts for CSV filtering and overlay generation.
- `packages/shared`
  - Shared type contracts (`EclipseRecord`, `Observer`, `Circumstances`, etc.).

### Internal dependency graph

```text
@eclipse-timer/mobile
  -> @eclipse-timer/catalog
  -> @eclipse-timer/engine
  -> @eclipse-timer/shared

@eclipse-timer/engine
  -> @eclipse-timer/shared

@eclipse-timer/catalog
  -> @eclipse-timer/shared
```

Catalog build scripts (`packages/catalog/scripts/*`) use `@eclipse-timer/engine` as a dev dependency.

## End-to-End Flow (High Level)

1. `@eclipse-timer/mobile` loads catalog records through `loadCatalog()` from `@eclipse-timer/catalog`.
2. Catalog loader merges base eclipse records with generated polygon overlays (visible + central paths) when available.
3. User selects an eclipse on the landing screen and moves to the timer screen.
4. User chooses observer coordinates (map tap/drag, GPS fix, or center preset).
5. App calls `computeCircumstances(eclipse, observer)` from `@eclipse-timer/engine`.
6. Engine solves eclipse contact timings and derived fields, then returns a typed `Circumstances` payload.
7. UI renders event timings, countdown state, and per-contact alarm toggles.

## Engine Summary

At a high level, the engine:
- Evaluates Besselian-element polynomials (`x`, `y`, `d`, `mu`, `l1`, `l2`) at candidate times.
- Solves contact roots for penumbral and umbral/antumbral boundaries.
- Computes local visibility and eclipse kind (`none`, `partial`, `total`, `annular`).
- Converts TT-relative solved times into UTC ISO strings using record `deltaTSeconds`.
- Returns additional derived metrics like magnitude and central duration (when applicable).

## Dataset Scope

- Source records are generated in `packages/catalog/generated/catalog.generated.json`.
- Current filtered range targets years **1900-2100**.
- Overlay polygons are generated into `packages/catalog/generated/overlays.generated.json`.
- Catalog/test integration currently validates a **454-eclipse** generated dataset.

## Tech Stack

- **Language:** TypeScript
- **Monorepo/tooling:** pnpm workspaces
- **Mobile:** Expo SDK 54, React Native 0.81, React Navigation
- **Maps/location:** `react-native-maps`, `expo-location`
- **Testing:** Vitest
- **Data processing:** Node scripts + `csv-parse`

## Prerequisites

- Node.js **18+**
- pnpm (**repo is pinned to `pnpm@9`**)
- For mobile native simulators:
  - iOS: Xcode + iOS Simulator (macOS)
  - Android: Android Studio + Android SDK/emulator

## Installation

Clone and install:

```bash
git clone <your-repo-url>
cd eclipse-timer
pnpm install
```

If you already have the repo locally, running `pnpm install` at the root is enough.

## Getting Started (Quick Start)

From the repo root:

```bash
pnpm dev:mobile
```

This starts the Expo dev server for `apps/mobile`.

For first-time setup, a recommended sequence is:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm dev:mobile
```

## Running the App in Expo

### Option 1: Physical device (Expo Go)

1. Install **Expo Go** on your phone.
2. Run:
   ```bash
   pnpm dev:mobile
   ```
3. Scan the QR code shown in the terminal/Expo UI.

### Option 2: iOS simulator

Use one of:

```bash
# Start Expo and press "i" in the interactive terminal
pnpm dev:mobile

# Or run directly
pnpm -C apps/mobile ios
```

### Option 3: Android emulator

Use one of:

```bash
# Start Expo and press "a" in the interactive terminal
pnpm dev:mobile

# Or run directly
pnpm -C apps/mobile android
```

### Option 4: Web preview

```bash
pnpm -C apps/mobile web
```

## Running Tests and Quality Checks

From the repo root:

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Package-level examples:

```bash
pnpm -C packages/engine test
pnpm -C packages/catalog test
pnpm -C apps/mobile test
```

Current test coverage includes:
- Engine math/time/geometry/circumstance behavior
- Full generated-catalog sweeps at greatest-eclipse coordinates
- Catalog script integration checks and generated artifact stability

## Common Commands

```bash
# Mobile dev server
pnpm dev:mobile

# Workspace-wide checks
pnpm typecheck
pnpm lint
pnpm test

# Engine local dev script
pnpm -C packages/engine dev:one

# Catalog generation pipeline
pnpm -C packages/catalog data:all
```

## Catalog Data Pipeline

Catalog tooling lives in `packages/catalog`.

Useful commands:

```bash
pnpm -C packages/catalog data:filter
pnpm -C packages/catalog data:build
pnpm -C packages/catalog data:overlays
```

Run all steps:

```bash
pnpm -C packages/catalog data:all
```

Generated artifacts are written under `packages/catalog/generated/`.

## Repository Layout

```text
apps/
  mobile/                 Expo app
packages/
  engine/                 Eclipse computation engine
  catalog/                Generated dataset + build scripts
  shared/                 Shared TypeScript types
documents/
  high-level/             Architecture and workflow docs
  low-level/              Algorithm/data/internal design docs
```

## Documentation

- `documents/README.md`
- `documents/high-level/system-overview.md`
- `documents/high-level/development-workflow.md`
- `documents/high-level/user-flow-and-product-behavior.md`
- `documents/low-level/engine-algorithm.md`
- `documents/low-level/mobile-app-internals.md`
- `documents/low-level/data-contracts.md`

## Current Status and Limits

- MVP behavior is implemented and usable for local exploration.
- Workspace lint/format tooling is configured with Biome; current codebase still has existing lint warnings to address incrementally.
- Alarm toggles/test alarm UI exists, but production-grade local notification scheduling is not implemented yet.
- Product polish and persistence/history features are intentionally limited while core engine/data reliability is prioritized.
