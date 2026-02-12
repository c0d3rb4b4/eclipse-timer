# System Overview

## Project Summary

`eclipse-timer` is a pnpm monorepo containing:
- A React Native (Expo) mobile app for selecting a location and viewing eclipse contact timings.
- A TypeScript eclipse engine that evaluates Besselian-element-based circumstances for an observer.
- Shared type contracts and a catalog package for eclipse dataset loading.

## Repository Layout

- `apps/mobile`
  - Expo app, map UI, GPS integration, and compute trigger.
- `packages/engine`
  - Core eclipse computation logic.
- `packages/catalog`
  - Catalog loader and sample eclipse dataset (`catalog.sample.json`).
- `packages/shared`
  - Shared TypeScript types used by app and engine.

## Package Dependency Graph

- `@eclipse-timer/mobile` -> `@eclipse-timer/catalog`, `@eclipse-timer/engine`, `@eclipse-timer/shared`
- `@eclipse-timer/engine` -> `@eclipse-timer/shared`, `@eclipse-timer/catalog`
- `@eclipse-timer/catalog` -> `@eclipse-timer/shared`
- `@eclipse-timer/shared` -> no internal package deps

## Runtime Data Flow

1. Mobile app loads catalog via `loadCatalog()` and selects the first eclipse record (MVP behavior).
2. User sets observer location from map tap/drag, GPS, or preset shortcuts.
3. User taps `Compute`.
4. App calls `computeCircumstances(eclipse, observer)`.
5. Engine returns contact times, visibility, local eclipse kind, magnitude, duration, and debug info.
6. UI renders results and a next-event countdown.

## Architecture Diagrams

### Component Diagram

```mermaid
flowchart LR
  U[User]
  GPS[Device Location Services]

  subgraph APP["apps/mobile"]
    APPUI[App.tsx UI and State]
    MAP[react-native-maps]
  end

  subgraph CATALOG["packages/catalog"]
    CLOAD[loadCatalog]
    CJSON[catalog.sample.json]
  end

  subgraph ENGINE["packages/engine"]
    COMP[computeCircumstances]
    FUN[evaluateAtT and contact functions]
    MATH[bracket/root/poly]
    GEO[observerToFundamental]
    TIME[t0 and UTC conversion]
  end

  subgraph SHARED["packages/shared"]
    TYPES[Type Contracts]
  end

  U --> APPUI
  APPUI --> MAP
  APPUI --> CLOAD
  CLOAD --> CJSON
  APPUI --> COMP
  COMP --> FUN
  FUN --> MATH
  FUN --> GEO
  COMP --> TIME
  APPUI -. types .-> TYPES
  CLOAD -. types .-> TYPES
  COMP -. types .-> TYPES
  APPUI --> GPS
  GPS --> APPUI
```

### Sequence Diagram

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant App as Mobile App (App.tsx)
  participant Loc as Expo Location API
  participant Catalog as Catalog Loader
  participant Engine as Engine computeCircumstances
  participant Math as Root + Geometry + Time Helpers

  App->>Catalog: loadCatalog()
  Catalog-->>App: EclipseRecord[]
  App->>App: select catalog[0] (MVP)

  User->>App: Tap map / drag pin / preset / Use GPS
  alt Use GPS path
    App->>Loc: requestForegroundPermissionsAsync()
    Loc-->>App: granted/denied
    App->>Loc: getLastKnownPositionAsync()
    Loc-->>App: last known coords (optional)
    App->>Loc: getCurrentPositionAsync() with timeout race
    Loc-->>App: current coords or timeout
  else Manual map path
    App->>App: update pin and region
  end

  User->>App: Press Compute
  App->>Engine: computeCircumstances(eclipse, observer)
  Engine->>Math: evaluateAtT, fPenumbra, fUmbraAbs
  Engine->>Math: findBrackets + bisectRoot
  Engine->>Math: TT->UTC conversion using deltaTSeconds
  Math-->>Engine: contacts + derived values
  Engine-->>App: Circumstances
  App-->>User: render status, contact times, countdown, debug
```

## Operational Constraints (Current State)

- Catalog selection is hardcoded to the first record.
- Time conversion uses record-level `deltaTSeconds`.
- Quality automation is scaffolded but not implemented (lint/test scripts are placeholders).
