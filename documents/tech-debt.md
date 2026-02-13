# Tech Debt & Improvement Plan

> Generated: 2026-02-12
> Scope: Full codebase analysis — UI/UX, architecture, code quality, testing, productionization, missing features.

---

## Table of Contents

1. [Testing](#1-testing)
2. [Linting & Code Quality Tooling](#2-linting--code-quality-tooling)
3. [Mobile App — Architecture & Code](#3-mobile-app--architecture--code)
4. [Mobile App — UI/UX](#4-mobile-app--uiux)
5. [Engine Package](#5-engine-package)
6. [Catalog Package](#6-catalog-package)
7. [Shared Package](#7-shared-package)
8. [Monorepo & Build Infrastructure](#8-monorepo--build-infrastructure)
9. [Missing Features — Product](#9-missing-features--product)
10. [Performance](#10-performance)
11. [Accessibility](#11-accessibility)
12. [Security & Privacy](#12-security--privacy)
13. [CI/CD & Productionization](#13-cicd--productionization)
14. [Documentation Gaps](#14-documentation-gaps)

---

## 1. Testing

| ID | Item | Severity | Details |
|----|------|----------|---------|
| T-01 | **No test framework installed** | 🔴 Critical | ✅ Resolved 2026-02-13: installed a root Vitest config and replaced placeholder `test` scripts with Vitest commands across packages/apps. |
| T-02 | **Limited unit coverage for the engine** | 🔴 Critical | 🟡 In progress 2026-02-13: added initial Vitest coverage for `computeCircumstances`, `evaluateAtT`, `fPenumbra`, and `fUmbraAbs` (regression + classification cases). Remaining gaps: more known-answer vectors, edge-case error handling, and broader contact-solver scenarios. |
| T-03 | **Zero unit tests for math helpers** | 🔴 Critical | `evalPoly`, `findBrackets`, `bisectRoot` are numerically sensitive pure functions — ideal for property-based and example-based tests but completely untested. |
| T-04 | **Zero unit tests for geo/coords** | 🟠 High | `observerToFundamental` contains WGS84 geodetic math with no regression tests against known reference values. |
| T-05 | **Zero unit tests for time utilities** | 🟠 High | `t0TtDate`, `ttAtTHours`, `ttToUtcUsingDeltaT` have no tests; date math is notoriously bug-prone. |
| T-06 | **No integration/snapshot tests for catalog scripts** | 🟡 Medium | `build_catalog_json.ts`, `build_overlays_json.ts`, `filter_csv_1900_2100.ts` have no automated output verification. A typo in CSV column mapping would silently produce bad data. |
| T-07 | **No mobile component/screen tests** | 🟡 Medium | No React Native Testing Library or Detox setup. All UI behavior is manually verified. |
| T-08 | **No end-to-end regression suite** | 🟡 Medium | No known-answer tests validating the full pipeline (catalog → engine → formatted output) against NASA reference data. |

### Recommended actions
- Install Vitest (shared config at workspace root) for `engine`, `catalog`, `shared`.
- Write golden-file / snapshot tests for `computeCircumstances` against NASA reference coordinates.
- Add property-based tests for `evalPoly` (Horner's identity), `findBrackets` (sign-change guarantee), `bisectRoot` (convergence).
- Add React Native Testing Library for `apps/mobile`.

---

## 2. Linting & Code Quality Tooling

| ID | Item | Severity | Details |
|----|------|----------|---------|
| L-01 | **No linter configured** | 🟠 High | All `lint` scripts are `echo "(add eslint later)"`. No ESLint, Biome, or equivalent. |
| L-02 | **No formatter configured** | 🟠 High | No Prettier/Biome/dprint config. Inconsistent indentation is already visible (e.g., mixed 2-space and realigned blocks in `App.tsx` styles). |
| L-03 | **No pre-commit hooks** | 🟡 Medium | No Husky/lint-staged setup. Nothing prevents committing broken types or unformatted code. |
| L-04 | **No `.editorconfig`** | 🟢 Low | Helps enforce consistent whitespace across editors/contributors. |
| L-05 | **No `.nvmrc` / `.node-version`** | 🟢 Low | README says "Node 18+" but nothing pins or validates it. |

### Recommended actions
- Add ESLint 9 flat config (or Biome) with TypeScript + React Native rules.
- Add Prettier with a shared config.
- Install Husky + lint-staged for pre-commit formatting + type-check.

---

## 3. Mobile App — Architecture & Code

| ID | Item | Severity | Details |
|----|------|----------|---------|
| A-01 | **God component: `App.tsx` is ~1 000 lines** | 🔴 Critical | ✅ Resolved 2026-02-12: split into `LandingScreen`/`TimerScreen` plus hooks/utilities; `App.tsx` now orchestrates only. |
| A-02 | **No state management layer** | 🟠 High | ✅ Resolved 2026-02-12: added `AppStateProvider` with reducer/actions for screen + selection state. |
| A-03 | **Helper functions defined outside module scope** | 🟡 Medium | ✅ Resolved 2026-02-13: helpers extracted into `utils/` and `hooks/` modules; `App.tsx` no longer hosts them. |
| A-04 | **No navigation library** | 🟡 Medium | ✅ Resolved 2026-02-13: added React Navigation native stack and moved screen switching to the navigator. |
| A-05 | **`computeCircumstances` runs on JS thread synchronously** | 🟠 High | ✅ Resolved 2026-02-13: compute now runs via `InteractionManager.runAfterInteractions` with cancellation guards for reset/unmount paths. |
| A-06 | **Countdown timer never re-renders** | 🟠 High | ✅ Resolved 2026-02-13: timer state now owns a 1-second interval and feeds a live `nextEventCountdownText` string to the UI. |
| A-07 | **Alarm system is a UI stub** | 🟡 Medium | Alarm toggles and "Test Alarm" exist, but there is no background scheduling (e.g., `expo-notifications` local notifications). Alarms are effectively non-functional. |
| A-08 | **`loadCatalog()` called in `useMemo` with `[]` deps** | 🟢 Low | Works, but `loadCatalog` is synchronous and reads JSON via `require()`. On large catalogs this blocks the initial render. Could be deferred with `useEffect` + loading state. |
| A-09 | **`StyleSheet` defined outside component but after `export default`** | 🟢 Low | Minor: the `const styles = StyleSheet.create(...)` block sits after the component's closing brace, inside the module. This is valid but unconventional and confusing. |
| A-10 | **Hardcoded elevation `elevM: 0`** | 🟡 Medium | Observer elevation is always 0. GPS APIs provide altitude — it should be wired through. |
| A-11 | **No error boundary** | 🟡 Medium | An unhandled exception in compute or rendering crashes the entire app with no recovery UI. |

---

## 4. Mobile App — UI/UX

| ID | Item | Severity | Details |
|----|------|----------|---------|
| U-01 | **No local time display** | 🟠 High | All contact times are shown in UTC only. Most users need local-time equivalents. |
| U-02 | **"Central 10:00" button label is cryptic** | 🟡 Medium | The button jumps to the greatest-eclipse coordinates but the label is an internal jargon term. Should say "Greatest Eclipse" or similar. |
| U-03 | **No loading/splash screen** | 🟡 Medium | Catalog and overlay loading is synchronous at startup with no visual feedback. |
| U-04 | **No empty state on timer screen** | 🟢 Low | If the user navigates to the timer without computing, the results card just says "Press Compute to run the engine." — could be more informative with an illustration or contextual guidance. |
| U-05 | **No dark/light theme support** | 🟢 Low | The app is hardcoded to a dark theme. `useColorScheme` is not used. |
| U-06 | **Landing list has no search or filter** | 🟡 Medium | With 200+ eclipses from 1900–2100, scrolling to find a specific one is tedious. Needs at minimum a date filter or search bar. |
| U-07 | **No visual indicator of pin location on results card** | 🟢 Low | After compute, the selected-pin card is gone (only map shows it). Lat/lon should appear in the results context. |
| U-08 | **GIF preview loads from NASA servers** | 🟡 Medium | No caching, no placeholder, no error fallback. On slow connections the preview card is blank. Needs a loading indicator and error state. |
| U-09 | **Magnitude is displayed as `1` for total/annular** | 🟡 Medium | Magnitude for total eclipses should be the obscuration ratio (>1), not clamped to 1. This is an engine issue surfacing in UX. |
| U-10 | **No haptic feedback on map interactions** | 🟢 Low | Pin drop and drag could benefit from subtle haptics for tactile confirmation. |
| U-11 | **Countdown not ticking live** | 🟠 High | ✅ Resolved 2026-02-13 via A-06: hero card countdown is now driven by a ticking interval-backed state value. |
| U-12 | **No landscape orientation support** | 🟢 Low | `app.json` locks to portrait. Map exploration benefits from landscape. |

---

## 5. Engine Package

| ID | Item | Severity | Details |
|----|------|----------|---------|
| E-01 | **`deltaTSecondsApprox` is dead code** | 🟡 Medium | `time/deltaT.ts` exports `deltaTSecondsApprox` but it is never imported anywhere. The engine uses the per-record `deltaTSeconds` field instead. Should be deleted or integrated. |
| E-02 | **`bessel/elements.ts` is dead code** | 🟡 Medium | `evalElements` duplicates what `evaluateAtT` already does in `functions.ts`. It is never imported by any consumer. |
| E-03 | **Redundant evaluation in `fPenumbra` / `fUmbraAbs`** | 🟡 Medium | Each call to `fPenumbra` or `fUmbraAbs` calls `evaluateAtT` independently. During bracket scanning (~360 evaluations per eclipse × 2 functions), many evaluations are duplicated at the same `t`. Could return both metrics from a single evaluation. |
| E-04 | **Magic numbers in `solveContacts`** | 🟡 Medium | `tMin = -3`, `tMax = +3`, `stepBracket = 1/60`, `stepFine = 1/600`, `tol = 1e-7` are inlined constants with no configuration or documentation of units beyond comments. |
| E-05 | **Magnitude formula is oversimplified** | 🟠 High | For total/annular eclipses, magnitude is hardcoded to `1`. Astronomical magnitude for a total eclipse is typically `> 1` (ratio of apparent diameters). The partial formula `(L1obs - delta) / L1obs` may also be an approximation — should be validated against references. |
| E-06 | **No input validation** | 🟡 Medium | `computeCircumstances` trusts that `EclipseRecord` has valid polynomial arrays and numeric fields. A malformed record causes silent NaN propagation. |
| E-07 | **`evalPoly` JSDoc says "minutes" but input is hours** | 🟢 Low | The comment `t is a number (we'll use minutes)` is incorrect — the engine passes hours from t0. |
| E-08 | **No structured error type** | 🟡 Medium | Errors from the engine are thrown as generic `Error`. A typed result (`{ ok: true, data } | { ok: false, error }`) would be safer for the UI layer. |
| E-09 | **`_debug` payload typed as `any`** | 🟢 Low | The debug field on `Circumstances` is `any`. Should have a proper type for discoverability and serialization safety. |
| E-10 | **`scanMin` does linear scan, not golden-section** | 🟢 Low | The fine scan for maximum eclipse uses a 6-second linear sweep. A golden-section or Brent minimization would converge faster for high-accuracy needs. |

---

## 6. Catalog Package

| ID | Item | Severity | Details |
|----|------|----------|---------|
| C-01 | **Cross-package deep import in `build_overlays_json.ts`** | 🔴 Critical | The overlay build script directly imports `../../engine/src/circumstances/functions.ts` — a deep relative path into another package's internals. This bypasses package boundaries and will break if the engine restructures. Should import from `@eclipse-timer/engine` public API. |
| C-02 | **`loadCatalog()` uses `require()` (CJS) in an ESM package** | 🟡 Medium | `catalog/src/index.ts` uses `require("../generated/overlays.generated.json")` in a package marked `"type": "module"`. This works via Metro/bundler magic but is a portability risk for Node.js consumers. |
| C-03 | **Generated files are committed (implied)** | 🟡 Medium | `generated/catalog.generated.json` and `overlays.generated.json` appear in the repo. Large generated JSON files inflate the git history. Consider `.gitignore`-ing them and regenerating in CI. |
| C-04 | **No checksum or version stamping on generated data** | 🟢 Low | There's no way to tell which CSV input or script version produced a given `.generated.json`. Adding a metadata header (timestamp, input hash) aids reproducibility. |
| C-05 | **`build_catalog_json.ts` maps `kind` to single-char `T/A/P/H`** | 🟡 Medium | The `EclipseKind` type is `"total" | "annular" | "partial" | "hybrid"`, but the catalog script stores raw single-letter codes from the CSV. This mismatch forces `kindCodeForRecord()` in the mobile app to do defensive string surgery at runtime. The build script should normalize to the canonical string. |
| C-06 | **No data validation in overlay build** | 🟡 Medium | `build_overlays_json.ts` performs complex geometric computation but has no assertions or sanity checks on output polygon validity (e.g., minimum point count, self-intersection, area bounds). |
| C-07 | **Overlay script is ~730 lines of pure computation** | 🟢 Low | Complex geodetic helpers (`destPoint`, `bearingFromTo`, `sphericalInterp`, `angularDistance`, `douglasPeucker`) are embedded in a build script. These could be extracted to a shared geo-math utility for reuse and testing. |
| C-08 | **`filter_csv_1900_2100.ts` has no idempotency guard** | 🟢 Low | Running the filter twice on already-filtered output is harmless but produces duplicate console output and unnecessary I/O. |

---

## 7. Shared Package

| ID | Item | Severity | Details |
|----|------|----------|---------|
| S-01 | **`Circumstances._debug` typed as `any`** | 🟡 Medium | Loses type safety across the boundary. Should be a dedicated `DebugPayload` type or at least `Record<string, unknown>`. |
| S-02 | **No runtime validation (Zod, ArkType, io-ts)** | 🟡 Medium | Types are compile-time only. Catalog data loaded from JSON at runtime is cast with `as EclipseRecord[]` — no shape validation. A corrupt JSON file causes silent type-lie bugs. |
| S-03 | **No versioning strategy for type changes** | 🟢 Low | Since all packages are `workspace:*`, a breaking type change is invisible until runtime. Consider a CHANGELOG or semver bumps for `@eclipse-timer/shared`. |

---

## 8. Monorepo & Build Infrastructure

| ID | Item | Severity | Details |
|----|------|----------|---------|
| M-01 | **`pnpm@9.0.0` pinned in `packageManager` but not enforced** | 🟡 Medium | No `engines` field, no Corepack `packageManager` enforcement. Contributors may use npm/yarn. |
| M-02 | **TypeScript duplicated in every package `devDependencies`** | 🟢 Low | `typescript: ^5.4.0` appears in root, engine, catalog, shared, mobile. Could be hoisted to root-only with workspace protocol. |
| M-03 | **`ts-node` in engine devDependencies is unused** | 🟢 Low | Engine uses `tsx` for `dev:one`. `ts-node` can be removed. |
| M-04 | **No build step for packages** | 🟡 Medium | Packages expose raw `.ts` source as `main`/`types` entry points. This works for Metro but will fail for any consumer that expects compiled `.js` + `.d.ts` (e.g., a web app, a CLI tool, server-side rendering). |
| M-05 | **No workspace-level `clean` script** | 🟢 Low | No way to wipe `generated/`, `node_modules`, or build artifacts in one command. |
| M-06 | **No Turborepo / Nx for task orchestration** | 🟢 Low | `pnpm -r` works for now but doesn't support caching or dependency-aware task scheduling. |

---

## 9. Missing Features — Product

| ID | Item | Priority | Details |
|----|------|----------|---------|
| F-01 | **Multi-eclipse selection on timer screen** | 🟠 High | Once on the timer screen, the user cannot switch eclipses without going back. A dropdown or swipe-to-switch would improve flow. |
| F-02 | **Persisted user preferences** | 🟠 High | Selected eclipse, pin location, map type, and alarm settings are lost on app restart. Need AsyncStorage or MMKV persistence. |
| F-03 | **Real alarm/notification scheduling** | 🟠 High | Users expect to set an alarm for C1 and get a push notification. Requires `expo-notifications` local scheduling. |
| F-04 | **Offline support** | 🟡 Medium | Catalog JSON is bundled, but GIF previews require network. The app has no offline-first UX or cached assets. |
| F-05 | **Elevation input / altitude from GPS** | 🟡 Medium | The engine supports `elevM` but the app hardcodes `0`. GPS provides altitude — wire it through. |
| F-06 | **Share / export results** | 🟢 Low | No way to share computed contact times via OS share sheet or clipboard. |
| F-07 | **Web platform support** | 🟢 Low | `app.json` lists only `ios`/`android`. Expo supports web — overlay rendering may need adjustment but the engine is platform-agnostic. |
| F-08 | **Eclipse animation / sun coverage visualization** | 🟢 Low | Beyond the NASA GIF, a native real-time animation showing the moon transiting the sun at the observer's location would be a differentiating feature. |
| F-09 | **Local time zone display for contacts** | 🟠 High | Contact times should be shown in the observer's local timezone (derivable from longitude or device TZ), not just UTC. |
| F-10 | **Geocoding / address search** | 🟡 Medium | Users should be able to type a city name to set the pin, not only tap the map or use GPS. |

---

## 10. Performance

| ID | Item | Severity | Details |
|----|------|----------|---------|
| P-01 | **Entire 200-eclipse catalog loaded into memory at startup** | 🟡 Medium | `loadCatalog()` merges all catalog entries with overlay data eagerly. For mobile, lazy loading or pagination would reduce memory. |
| P-02 | **Overlay JSON can be large** | 🟡 Medium | With 200+ eclipses, `overlays.generated.json` can be multiple MB. Metro bundles it into the JS bundle. Consider on-demand loading per eclipse. |
| P-03 | **`splitPolygonOnDateline` runs on every render** | 🟢 Low | `overlayTuplesToCells` is wrapped in `useMemo` keyed on `activeEclipse`, which is correct. But the function allocates heavily — could be precomputed in the build script. |
| P-04 | **Duplicate `evaluateAtT` calls during root solving** | 🟡 Medium | See E-03. Each bracket scan step calls `evaluateAtT` twice (once for penumbra, once for umbra), but the polynomial evaluation is identical — only the metric differs. |
| P-05 | **Landing list renders all 200+ rows** | 🟡 Medium | Uses a plain `ScrollView` + `.map()`. Should be a `FlatList` with virtualization for smooth scrolling on low-end devices. |

---

## 11. Accessibility

| ID | Item | Severity | Details |
|----|------|----------|---------|
| AC-01 | **No `accessibilityLabel` or `accessibilityRole` on any component** | 🟠 High | Buttons, map overlay, status bar, result cards — none have accessibility props. App is unusable with screen readers. |
| AC-02 | **Color-only differentiation for overlay paths** | 🟡 Medium | Visible vs. central path is distinguished only by color. Needs pattern or label for color-blind users. |
| AC-03 | **Small touch targets on some buttons** | 🟢 Low | Map type toggle and legend items may be below the 44×44pt minimum recommended by Apple HIG / Material guidelines. |
| AC-04 | **No dynamic font size support** | 🟡 Medium | All font sizes are hardcoded. Should respect system accessibility font scaling (`allowFontScaling`). |

---

## 12. Security & Privacy

| ID | Item | Severity | Details |
|----|------|----------|---------|
| SP-01 | **Location permission requested without prior explanation** | 🟡 Medium | Best practice is to show a custom rationale dialog before the OS permission prompt. Currently the app just calls `requestForegroundPermissionsAsync()` directly. |
| SP-02 | **No privacy policy or data usage disclosure** | 🟡 Medium | App requests location and loads remote GIFs (NASA). App store submissions require a privacy policy. |
| SP-03 | **External URL (NASA GIF) loaded without HTTPS validation** | 🟢 Low | The URL is constructed dynamically. A malformed date could produce a broken URL — no sanitization. |

---

## 13. CI/CD & Productionization

| ID | Item | Severity | Details |
|----|------|----------|---------|
| CI-01 | **No CI pipeline** | 🔴 Critical | No GitHub Actions, no GitLab CI, no any CI config. Nothing runs `typecheck`, `lint`, or `test` automatically on push/PR. |
| CI-02 | **No automated mobile builds** | 🟠 High | No EAS Build configuration for Expo. Building release APK/IPA is entirely manual. |
| CI-03 | **No app signing / keystore management** | 🟡 Medium | No `eas.json`, no code-signing config. Required for store distribution. |
| CI-04 | **No environment configuration** | 🟡 Medium | No `.env` support, no staging vs. production config. API keys or feature flags have no mechanism. |
| CI-05 | **No crash reporting / analytics** | 🟡 Medium | No Sentry, Bugsnag, or similar. Production crashes will be invisible. |
| CI-06 | **No OTA update mechanism** | 🟢 Low | Expo supports `expo-updates` for over-the-air JS updates. Not configured. |
| CI-07 | **No app store metadata** | 🟢 Low | No screenshots, store description, or icon assets beyond the Expo defaults. |

---

## 14. Documentation Gaps

| ID | Item | Severity | Details |
|----|------|----------|---------|
| D-01 | **No CONTRIBUTING.md** | 🟡 Medium | No guide for external or new contributors on branch strategy, PR process, or code conventions. |
| D-02 | **No CHANGELOG** | 🟡 Medium | No version history. Makes it hard to track what changed between releases. |
| D-03 | **API reference for engine is prose-only** | 🟢 Low | `engine-algorithm.md` describes the algorithm but there's no auto-generated TSDoc/TypeDoc API reference. |
| D-04 | **No architecture decision records (ADRs)** | 🟢 Low | Key decisions (Besselian approach, WGS84 vs spherical, ΔT strategy, overlay tracing method) are embedded in code comments. ADRs would capture rationale more durably. |
| D-05 | **`evalPoly` JSDoc is wrong** | 🟢 Low | See E-07. Says "minutes" when the actual unit is hours. |
| D-06 | **No catalog data provenance doc** | 🟡 Medium | The raw CSV origin, license, last-updated date, and transformation pipeline are undocumented. |

---

## Priority Summary

### 🔴 Critical — Fix First
| ID | Summary |
|----|---------|
| T-01 | ✅ Resolved 2026-02-13: install a test framework |
| T-02 | Unit tests for core engine |
| T-03 | Unit tests for math helpers |
| A-01 | ✅ Resolved 2026-02-12: break up the 1 000-line `App.tsx` |
| C-01 | Fix cross-package deep import in overlay build |
| CI-01 | Set up a CI pipeline |

### 🟠 High — Fix Soon
| ID | Summary |
|----|---------|
| T-04 | Tests for geo/coords |
| T-05 | Tests for time utilities |
| L-01 | Configure a linter |
| L-02 | Configure a formatter |
| A-02 | ✅ Resolved 2026-02-12: introduce state management |
| A-05 | ✅ Resolved 2026-02-13: defer compute with `InteractionManager.runAfterInteractions` |
| A-06 / U-11 | ✅ Resolved 2026-02-13: make countdown timer tick in real time |
| E-05 | Fix oversimplified magnitude formula |
| AC-01 | Add accessibility labels |
| U-01 / F-09 | Show local time for contacts |
| F-01 | Multi-eclipse switching on timer |
| F-02 | Persist user preferences |
| F-03 | Implement real alarm scheduling |
| CI-02 | Set up EAS Build |

### 🟡 Medium — Plan Next
| ID | Summary |
|----|---------|
| T-06 | Tests for catalog scripts |
| T-07 | Mobile component tests |
| T-08 | End-to-end regression suite |
| L-03 | Pre-commit hooks |
| A-03 | ✅ Resolved 2026-02-13: extract helper functions from App.tsx |
| A-04 | ✅ Resolved 2026-02-13: add navigation library |
| A-07 | Wire up real notifications for alarms |
| A-10 | Pass GPS altitude as `elevM` |
| A-11 | Add error boundary |
| E-03 | Deduplicate evaluateAtT calls |
| E-04 | Extract magic numbers to config |
| E-06 | Add input validation to engine |
| E-08 | Typed result instead of thrown errors |
| C-02 | Fix CJS `require()` in ESM package |
| C-05 | Normalize eclipse kind codes at build time |
| C-06 | Add overlay output validation |
| S-01 | Type the `_debug` payload |
| S-02 | Add runtime type validation for catalog data |
| M-01 | Enforce pnpm via Corepack |
| M-04 | Add build step for packages |
| U-02 | Rename "Central 10:00" button |
| U-03 | Add splash/loading screen |
| U-06 | Add search/filter to landing list |
| U-08 | Handle GIF loading/error states |
| U-09 | Fix magnitude display for total eclipses |
| P-01 | Lazy-load catalog |
| P-02 | On-demand overlay loading |
| P-04 | Deduplicate polynomial evaluations |
| P-05 | Virtualize landing list with FlatList |
| AC-02 | Add non-color overlay differentiation |
| AC-04 | Support dynamic font sizing |
| SP-01 | Show location rationale before permission |
| SP-02 | Add privacy policy |
| CI-03 | Configure app signing |
| CI-04 | Add env config support |
| CI-05 | Add crash reporting |
| D-01 | Write CONTRIBUTING.md |
| D-02 | Start a CHANGELOG |
| D-06 | Document catalog data provenance |
| F-04 | Offline support |
| F-05 | Elevation from GPS |
| F-10 | Geocoding / address search |

### 🟢 Low — Backlog
| IDs | Summary |
|-----|---------|
| L-04, L-05 | `.editorconfig`, `.nvmrc` |
| A-08, A-09 | Minor code organization |
| E-07, E-09, E-10 | Docs fix, `_debug` type, optimizer upgrade |
| C-03, C-04, C-07, C-08 | Generated file hygiene |
| S-03 | Shared types versioning |
| M-02, M-03, M-05, M-06 | Dep dedup, clean script, task runner |
| U-04, U-05, U-07, U-10, U-12 | UX polish |
| AC-03 | Touch target sizing |
| SP-03 | URL sanitization |
| CI-06, CI-07 | OTA updates, store assets |
| D-03, D-04, D-05 | TSDoc, ADRs, JSDoc fix |
| F-06, F-07, F-08 | Share, web support, animation |
