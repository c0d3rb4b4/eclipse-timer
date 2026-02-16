# Engine Algorithm

## Source Files

- `packages/engine/src/circumstances/compute.ts`
- `packages/engine/src/circumstances/functions.ts`
- `packages/engine/src/geo/coords.ts`
- `packages/engine/src/math/bracket.ts`
- `packages/engine/src/math/root.ts`
- `packages/engine/src/math/poly.ts`
- `packages/engine/src/time/t0.ts`
- `packages/engine/src/time/utc.ts`

## Entry Point

`computeCircumstances(e: EclipseRecord, o: Observer): Circumstances`

This function:
1. Solves contact times in TT-relative hours from `t0`.
2. Converts solved times to UTC ISO strings.
3. Derives visibility, local eclipse kind, magnitude, and duration.
4. Returns optional debug payload.

## Evaluation At Time `t`

`evaluateAtT` computes:
- Polynomial values: `x`, `y`, `d`, `mu`, `l1`, `l2`
- Observer transformed coordinates: `xi`, `eta`, `zeta`
- Distance in fundamental plane:
  - `delta = hypot(x - xi, y - eta)`
- Observer-plane radii:
  - `L1obs = l1 - zeta * tanF1`
  - `L2obs = l2 - zeta * tanF2`

Helper functions:
- Penumbral function: `fPenumbra = delta - L1obs`
- Umbra/antumbra function: `fUmbraAbs = delta - abs(L2obs)`

## Contact Solving Strategy

Search window:
- `t` in `[-3, +3]` hours from `t0` (based on NASA validity note in comments).

Steps:
1. Bracket roots for `fPenumbra` using step `1/60` hour (60 seconds).
2. Solve each bracket with bisection (`tol = 1e-7` hours).
3. Select earliest/latest penumbral roots as `C1`/`C4`.
4. Repeat for `fUmbraAbs`, selecting earliest/latest as `C2`/`C3`.

Visibility and preliminary classification:
- `visible` requires finite `C1` and `C4`.
- If `C2`/`C3` also exist and lie inside `C1`/`C4`, local kind is central (`total`/`annular`) pending sign check.
- Otherwise local kind is `partial` or `none`.

## Maximum Eclipse Time Selection

- Central case (`C2`..`C3`): minimize `fUmbraAbs` with 6-second scan (`1/600` hour).
  - Final kind is:
    - `total` if `L2obs < 0` at best time
    - `annular` otherwise
- Partial case (`C1`..`C4`): minimize `fPenumbra`.
- Fallback: if no sane interval, pick time with minimal `delta` across full window.

## Time Conversion

- `t0TtDate` builds TT date from `dateYmd + t0TtHours`.
- `ttAtTHours` offsets from `t0` by solved hours.
- `ttToUtcUsingDeltaT` converts TT to UTC approximation:
  - `UTC = TT - deltaTSeconds`
- `toIsoUtc` serializes to ISO string.

## Derived Output Fields

- `durationSeconds`:
  - Only set when `C2` and `C3` exist and `C3 > C2`.
- `magnitude`:
  - `undefined` when not visible or invalid `L1obs`.
  - Central (`total`/`annular`) formula:
    - `raw = (L1obs - delta) / (L1obs + L2obs)`
    - `total`: `max(1, raw)`
    - `annular`: clamp to `[0, 1]`
  - Partial formula:
    - `(L1obs - delta) / L1obs`, clamped to `[0, 1]`.

## Numerical Helpers

- `evalPoly`: Horner's method.
- `findBrackets`: sign-change scan with support for exact-hit brackets.
- `bisectRoot`: finite-value-guarded bisection with max-iteration fallback.

## Debug Payload

`_debug` includes:
- Time references (`t0Tt`, approximate `t0UtcApprox`, `deltaTSeconds`)
- Catalog metadata (`nasaGreatestEclipseUtc`)
- Root/bracket counts, roots, raw root solver outputs
- Selected max time and metric
