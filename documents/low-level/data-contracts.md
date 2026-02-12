# Data Contracts

## Source Of Truth

- `packages/shared/src/types.ts`
- `packages/catalog/src/catalog.sample.json`

## Core Types

### `Observer`

```ts
type Observer = {
  latDeg: number;
  lonDeg: number; // east-positive
  elevM?: number;
};
```

Notes:
- Latitude/longitude are geodetic degrees.
- Longitude is east-positive; west longitudes are negative.
- Elevation defaults to `0` meters when omitted.

### `EclipseRecord`

Represents one eclipse entry and required polynomial coefficients:

- Identity and date:
  - `id`
  - `dateYmd` (`YYYY-MM-DD`)
  - `kind` (`total | annular | partial | hybrid`)
- Time model:
  - `t0TtHours` (reference TT hour on eclipse date)
  - `deltaTSeconds` (TT - UTC approximation for conversion)
- Geometry constants:
  - `tanF1`, `tanF2`
- Polynomial coefficient arrays:
  - `x`, `y`, `d`, `mu`, `l1`, `l2`
- Optional metadata:
  - `greatestEclipseUtc`
  - `greatestDurationUtc`

### `Circumstances`

Engine output:

- Identity and visibility:
  - `eclipseId`
  - `visible`
  - `kindAtLocation`
- Contact times:
  - `c1Utc`, `c2Utc`, `maxUtc`, `c3Utc`, `c4Utc`
- Derived metrics:
  - `magnitude`
  - `durationSeconds`
- Optional debugging:
  - `_debug`

## Catalog Loader Contract

`packages/catalog/src/index.ts` exposes:

```ts
function loadCatalog(): EclipseRecord[]
```

Current implementation returns the static JSON sample cast as `EclipseRecord[]`.

## Unit Conventions

- Angular quantities: degrees (`latDeg`, `lonDeg`, `d`, `mu`)
- Time in solver internals: hours relative to `t0` (TT)
- Output contact timestamps: UTC ISO strings
- Elevation: meters
- Duration: seconds

## Compatibility Rules

- Any new catalog entry must provide all required coefficient arrays.
- Fields used by engine should remain stable unless engine logic is updated in lockstep.
- If `kind` or output unions expand, update both shared types and UI rendering code.
