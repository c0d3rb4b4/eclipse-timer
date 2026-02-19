# Tech Debt & Improvement Plan

> Generated: 2026-02-12 · Updated: 2026-02-19
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
15. [Production Readiness Checklist — App Store Submission](#15-production-readiness-checklist--app-store-submission)

---

## 1. Testing

| ID | Item | Severity | Details |
|----|------|----------|---------|
| T-01 | **No test framework installed** | 🔴 Critical | ✅ Resolved 2026-02-13: installed a root Vitest config and replaced placeholder `test` scripts with Vitest commands across packages/apps. |
| T-02 | **Limited unit coverage for the engine** | 🔴 Critical | ✅ Resolved 2026-02-13: added comprehensive Vitest coverage for `computeCircumstances`, `evaluateAtT`, `fPenumbra`, and `fUmbraAbs` including deterministic regression vectors, whole-catalog greatest-point invariant sweeps, root-equation checks, partial-magnitude validation, and malformed-input/elevation robustness tests. |
| T-03 | **Zero unit tests for math helpers** | 🔴 Critical | ✅ Resolved 2026-02-13: added dedicated Vitest coverage for `evalPoly`, `findBrackets`, and `bisectRoot` with example-based assertions and deterministic property-style sweeps (Horner equivalence, sign-change bracket guarantees, and bisection convergence/null-path behavior). |
| T-04 | **Zero unit tests for geo/coords** | 🟠 High | ✅ Resolved 2026-02-13: added dedicated geo regression/invariant tests for `observerToFundamental` (reference vectors, periodicity checks, elevation sensitivity, and polar finiteness). |
| T-05 | **Zero unit tests for time utilities** | 🟠 High | ✅ Resolved 2026-02-13: added tests for `t0TtDate`, `ttAtTHours`, `ttToUtcUsingDeltaT`, and `toIsoUtc` covering fractional-hour conversion, boundary rounding, positive/negative ΔT, and invalid-date behavior. |
| T-06 | **No integration/snapshot tests for catalog scripts** | 🟡 Medium | ✅ Resolved 2026-02-13: added catalog integration/snapshot tests validating `filter_csv_1900_2100` year-range output, `build_catalog_json` field mapping against CSV columns, `build_overlays_json` output shape/coordinate sanity, and artifact hash snapshots for generated files. |
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
| L-01 | **No linter configured** | 🟠 High | ✅ Resolved 2026-02-13: configured Biome at the workspace root and replaced placeholder `lint` scripts across app/package workspaces with `biome lint .`. |
| L-02 | **No formatter configured** | 🟠 High | ✅ Resolved 2026-02-13: added shared Biome formatter config and `format` scripts (`biome format --write .`) across workspaces. |
| L-03 | **No pre-commit hooks** | 🟡 Medium | ✅ Resolved 2026-02-16: installed Husky + lint-staged; pre-commit hook runs `biome check --write` on staged files. |
| L-04 | **No `.editorconfig`** | 🟢 Low | Helps enforce consistent whitespace across editors/contributors. |
| L-05 | **No `.nvmrc` / `.node-version`** | 🟢 Low | ✅ Resolved 2026-02-16: created `.nvmrc` pinning Node 20 at repo root. |

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
| A-07 | **Alarm system is a UI stub** | 🟡 Medium | ✅ Resolved 2026-02-16: wired `expo-notifications` local scheduling with per-contact toggles, test notification scheduling, and global reminder/sound/vibration controls in Notification Settings. |
| A-08 | **`loadCatalog()` called in `useMemo` with `[]` deps** | 🟢 Low | Works, but `loadCatalog` is synchronous and reads JSON via `require()`. On large catalogs this blocks the initial render. Could be deferred with `useEffect` + loading state. |
| A-09 | **`StyleSheet` defined outside component but after `export default`** | 🟢 Low | Minor: the `const styles = StyleSheet.create(...)` block sits after the component's closing brace, inside the module. This is valid but unconventional and confusing. |
| A-10 | **Hardcoded elevation `elevM: 0`** | 🟡 Medium | ✅ Resolved 2026-02-16: GPS altitude now captured from `coords.altitude` and threaded through `Pin.elevM` to `Observer.elevM`. Map taps default to 0. |
| A-11 | **No error boundary** | 🟠 High | ✅ Resolved 2026-02-16: added `ErrorBoundary` class component wrapping `<RootNavigator />` with recovery UI ("Restart" button), integrated with Sentry for crash capture. |

---

## 4. Mobile App — UI/UX

| ID | Item | Severity | Details |
|----|------|----------|---------|
| U-01 | **No local time display** | 🟠 High | ✅ Resolved 2026-02-13: contact rows now show both UTC and local device time (`UTC±HH:MM`) for every available event. |
| U-02 | **"Central 10:00" button label is cryptic** | 🟡 Medium | ✅ Resolved 2026-02-13: renamed the action button to **Greatest Eclipse** to match user-facing terminology. |
| U-03 | **No loading/splash screen** | 🟡 Medium | ✅ Resolved 2026-02-13: added a startup loading screen for catalog bootstrapping and an in-screen loading state while active eclipse overlays hydrate. |
| U-04 | **No empty state on timer screen** | 🟢 Low | If the user navigates to the timer without computing, the results card just says "Press Compute to run the engine." — could be more informative with an illustration or contextual guidance. |
| U-05 | **No dark/light theme support** | 🟢 Low | The app is hardcoded to a dark theme. `useColorScheme` is not used. |
| U-06 | **Landing list has no search or filter** | 🟡 Medium | ✅ Resolved 2026-02-13: added a search bar with tokenized filtering (year/date/kind/ID) and live filtered-count feedback. |
| U-07 | **No visual indicator of pin location on results card** | 🟢 Low | After compute, the selected-pin card is gone (only map shows it). Lat/lon should appear in the results context. |
| U-08 | **GIF preview loads from NASA servers** | 🟡 Medium | ✅ Resolved 2026-02-13: preview card now prefetches/caches, shows a loading placeholder, and provides an error fallback with retry. |
| U-09 | **Magnitude is displayed as `1` for total/annular** | 🟡 Medium | ✅ Resolved 2026-02-13: engine now computes central magnitude from `L1/L2/Δ` instead of hardcoding `1`, and the results UI surfaces the corrected value. |
| U-10 | **No haptic feedback on map interactions** | 🟢 Low | Pin drop and drag could benefit from subtle haptics for tactile confirmation. |
| U-11 | **Countdown not ticking live** | 🟠 High | ✅ Resolved 2026-02-13 via A-06: hero card countdown is now driven by a ticking interval-backed state value. |
| U-12 | **No landscape orientation support** | 🟢 Low | `app.json` locks to portrait. Map exploration benefits from landscape. |

---

## 5. Engine Package

| ID | Item | Severity | Details |
|----|------|----------|---------|
| E-01 | **`deltaTSecondsApprox` is dead code** | 🟡 Medium | `time/deltaT.ts` exports `deltaTSecondsApprox` but it is never imported anywhere. The engine uses the per-record `deltaTSeconds` field instead. Should be deleted or integrated. |
| E-02 | **`bessel/elements.ts` is dead code** | 🟡 Medium | `evalElements` duplicates what `evaluateAtT` already does in `functions.ts`. It is never imported by any consumer. |
| E-03 | **Redundant evaluation in `fPenumbra` / `fUmbraAbs`** | 🟡 Medium | ✅ Resolved 2026-02-13: introduced `evaluateShadowMetricsAtT` and shared per-`t` metric caching inside contact solving so penumbral/umbral scans reuse one `evaluateAtT` result. |
| E-04 | **Magic numbers in `solveContacts`** | 🟡 Medium | `tMin = -3`, `tMax = +3`, `stepBracket = 1/60`, `stepFine = 1/600`, `tol = 1e-7` are inlined constants with no configuration or documentation of units beyond comments. |
| E-05 | **Magnitude formula is oversimplified** | 🟠 High | ✅ Resolved 2026-02-13: replaced central-event hardcode with geometric magnitude `(L1obs - delta) / (L1obs + L2obs)` (with kind-aware bounds), allowing total magnitudes >1 and annular magnitudes <1. |
| E-06 | **No input validation** | 🟡 Medium | `computeCircumstances` trusts that `EclipseRecord` has valid polynomial arrays and numeric fields. A malformed record causes silent NaN propagation. |
| E-07 | **`evalPoly` JSDoc says "minutes" but input is hours** | 🟢 Low | The comment `t is a number (we'll use minutes)` is incorrect — the engine passes hours from t0. |
| E-08 | **No structured error type** | 🟡 Medium | Errors from the engine are thrown as generic `Error`. A typed result (`{ ok: true, data } | { ok: false, error }`) would be safer for the UI layer. |
| E-09 | **`_debug` payload typed as `any`** | 🟢 Low | The debug field on `Circumstances` is `any`. Should have a proper type for discoverability and serialization safety. |
| E-10 | **`scanMin` does linear scan, not golden-section** | 🟢 Low | The fine scan for maximum eclipse uses a 6-second linear sweep. A golden-section or Brent minimization would converge faster for high-accuracy needs. |

---

## 6. Catalog Package

| ID | Item | Severity | Details |
|----|------|----------|---------|
| C-01 | **Cross-package deep import in `build_overlays_json.ts`** | 🔴 Critical | ✅ Resolved 2026-02-13: `build_overlays_json.ts` now imports `evaluateAtT` from `@eclipse-timer/engine`, and the engine exports `evaluateAtT` through its public API surface. |
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
| F-01 | **Multi-eclipse selection on timer screen** | 🟠 High | ✅ Resolved 2026-02-19: added an in-screen eclipse picker modal on Timer so users can switch eclipses directly without returning to Landing. |
| F-02 | **Persisted user preferences** | 🟠 High | ✅ Resolved 2026-02-16: AsyncStorage persistence wired up via `APP_PREFERENCES_STORAGE_KEY`; user preferences survive app restart. |
| F-03 | **Real alarm/notification scheduling** | 🟠 High | ✅ Resolved 2026-02-16 via A-07: computed eclipse contacts now schedule local notifications with configurable reminder lead times. |
| F-04 | **Offline support** | 🟡 Medium | Catalog JSON is bundled, but GIF previews require network. The app has no offline-first UX or cached assets. |
| F-05 | **Elevation input / altitude from GPS** | 🟡 Medium | The engine supports `elevM` but the app hardcodes `0`. GPS provides altitude — wire it through. |
| F-06 | **Share / export results** | 🟢 Low | No way to share computed contact times via OS share sheet or clipboard. |
| F-07 | **Web platform support** | 🟢 Low | `app.json` lists only `ios`/`android`. Expo supports web — overlay rendering may need adjustment but the engine is platform-agnostic. |
| F-08 | **Eclipse animation / sun coverage visualization** | 🟢 Low | Beyond the NASA GIF, a native real-time animation showing the moon transiting the sun at the observer's location would be a differentiating feature. |
| F-09 | **Local time zone display for contacts** | 🟠 High | ✅ Resolved 2026-02-13 via U-01: contact rows now include local device-time equivalents alongside UTC. |
| F-10 | **Geocoding / address search** | 🟡 Medium | Users should be able to type a city name to set the pin, not only tap the map or use GPS. |

---

## 10. Performance

| ID | Item | Severity | Details |
|----|------|----------|---------|
| P-01 | **Entire 200-eclipse catalog loaded into memory at startup** | 🟡 Medium | ✅ Resolved 2026-02-13: `loadCatalog()` now returns lightweight records and overlays are hydrated lazily only for the selected eclipse. |
| P-02 | **Overlay JSON can be large** | 🟡 Medium | ✅ Resolved 2026-02-13: overlays are now emitted as decade chunk files and loaded on demand by eclipse year instead of eagerly loading a monolithic overlay map in the app path. |
| P-03 | **`splitPolygonOnDateline` runs on every render** | 🟢 Low | ✅ Resolved 2026-02-13: `overlayTuplesToCells` now memoizes converted/split polygons in a `WeakMap`, eliminating repeat allocation work for previously seen overlay arrays. |
| P-04 | **Duplicate `evaluateAtT` calls during root solving** | 🟡 Medium | ✅ Resolved 2026-02-13 via E-03: contact solving now shares one cached evaluation per `t` for both penumbral and umbral metrics. |
| P-05 | **Landing list renders all 200+ rows** | 🟡 Medium | ✅ Resolved 2026-02-13: replaced `ScrollView` + `.map()` with a virtualized `FlatList` (batched rendering + clipped subviews + fixed item layout). |

---

## 11. Accessibility

| ID | Item | Severity | Details |
|----|------|----------|---------|
| AC-01 | **Incomplete accessibility labels** | 🟠 High | ✅ Resolved 2026-02-16: added `accessibilityLabel`, `accessibilityRole`, and `accessibilityState` to all interactive elements in `LandingScreen` and `NotificationSettingsScreen` (search input, list items, buttons, switches, headers). |
| AC-02 | **Color-only differentiation for overlay paths** | 🟡 Medium | Visible vs. central path is distinguished only by color. Needs pattern or label for color-blind users. |
| AC-03 | **Small touch targets on some buttons** | 🟢 Low | Map type toggle and legend items may be below the 44×44pt minimum recommended by Apple HIG / Material guidelines. |
| AC-04 | **No dynamic font size support** | 🟡 Medium | All font sizes are hardcoded. Should respect system accessibility font scaling (`allowFontScaling`). |

---

## 12. Security & Privacy

| ID | Item | Severity | Details |
|----|------|----------|---------|
| SP-01 | **Location permission requested without prior explanation** | 🟡 Medium | ✅ Resolved 2026-02-16: added a custom `Alert.alert` rationale dialog explaining on-device-only location use before the OS permission prompt. |
| SP-02 | **No privacy policy or data usage disclosure** | 🟠 High | ✅ Resolved 2026-02-16: wrote `PRIVACY_POLICY.md`, created `documents/store-privacy-declarations.md` with Apple App Privacy and Google Play Data Safety declarations, added iOS privacy manifest to `app.json`. Remaining: host the policy at a public URL and link in store listings. |
| SP-03 | **External URL (NASA GIF) loaded without HTTPS validation** | 🟢 Low | The URL is constructed dynamically. A malformed date could produce a broken URL — no sanitization. |

---

## 13. CI/CD & Productionization

| ID | Item | Severity | Details |
|----|------|----------|---------|
| CI-00 | **Convert from Expo Go to EAS Build for production releases** | 🔴 Critical | ✅ Resolved 2026-02-16: created `eas.json` with `development`/`preview`/`production` build profiles (EAS project ID `a29a7662-96be-4509-a79e-fbe4b5dac1ff`). |
| CI-01 | **No CI pipeline** | 🔴 Critical | ✅ Resolved 2026-02-16: created `.github/workflows/ci.yml` (GitHub Actions) running `pnpm typecheck`, `pnpm lint`, `pnpm test` on push/PR to `main`. |
| CI-02 | **No automated mobile builds in CI** | 🟠 High | ✅ Resolved 2026-02-16: created `.github/workflows/eas-build.yml` with CI → local EAS Build → direct store upload pipeline. Triggered on `main` push or manual dispatch. Submit job gated behind `environment: production` approval. |
| CI-03 | **No app signing / keystore management** | 🟠 High | No `eas.json`, no code-signing config. Android `gradle.properties` still references debug keystore only. Required for store distribution. Severity upgraded — this blocks store submission. |
| CI-04 | **No environment configuration** | 🟡 Medium | ✅ Resolved 2026-02-16: created `apps/mobile/.env.example` with Sentry and EAS placeholders. |
| CI-05 | **No crash reporting / analytics** | 🟠 High | ✅ Resolved 2026-02-16: installed `@sentry/react-native`, configured `app.json` plugin, wrapped root with `Sentry.wrap` + `ErrorBoundary`. DSN placeholder requires replacement before production. |
| CI-06 | **No OTA update mechanism** | 🟡 Medium | ✅ Resolved 2026-02-16: installed `expo-updates`, configured `runtimeVersion` (appVersion policy) and `updates` URL pointing to EAS project in `app.json`. |
| CI-07 | **No app store metadata** | 🟡 Medium | No screenshots, store description, keyword list, or promotional assets. Required for both App Store Connect and Google Play Console submission. Severity upgraded — blocks submission. |
| CI-08 | **iOS `bundleIdentifier` not set** | 🔴 Critical | ✅ Resolved 2026-02-16: set `expo.ios.bundleIdentifier` to `com.lallimaven.eclipse-timer` with `buildNumber: "1"`. |
| CI-09 | **Android package name is a placeholder** | 🔴 Critical | ✅ Resolved 2026-02-16: set `android.package` to `com.lallimaven.eclipsetimer` with `versionCode: 1`. |
| CI-10 | **No `expo-splash-screen` control** | 🟡 Medium | ✅ Resolved 2026-02-16: `SplashScreen.preventAutoHideAsync()` called at module level, `hideAsync()` after catalog loads. |
| CI-11 | **Version `0.0.1` — needs release versioning** | 🟡 Medium | ✅ Resolved 2026-02-16: bumped to `1.0.0` in both `package.json` and `app.json`, set `ios.buildNumber: "1"` and `android.versionCode: 1`. |

---

## 14. Documentation Gaps

| ID | Item | Severity | Details |
|----|------|----------|---------|
| D-01 | **No CONTRIBUTING.md** | 🟡 Medium | No guide for external or new contributors on branch strategy, PR process, or code conventions. |
| D-02 | **No CHANGELOG** | 🟡 Medium | ✅ Resolved 2026-02-16: created `CHANGELOG.md` with full v1.0.0 entry following Keep a Changelog format. |
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
| T-02 | ✅ Resolved 2026-02-13: unit tests for core engine |
| T-03 | ✅ Resolved 2026-02-13: unit tests for math helpers |
| A-01 | ✅ Resolved 2026-02-12: break up the 1 000-line `App.tsx` |
| C-01 | ✅ Resolved 2026-02-13: fix cross-package deep import in overlay build |
| CI-00 | ✅ Resolved 2026-02-16: created `eas.json` with development/preview/production build profiles |
| CI-01 | ✅ Resolved 2026-02-16: created GitHub Actions CI workflow (`.github/workflows/ci.yml`) |
| CI-08 | ✅ Resolved 2026-02-16: set iOS `bundleIdentifier` to `com.lallimaven.eclipse-timer` |
| CI-09 | ✅ Resolved 2026-02-16: set Android package to `com.lallimaven.eclipsetimer` |

### 🟠 High — Fix Soon
| ID | Summary |
|----|---------|
| T-04 | ✅ Resolved 2026-02-13: tests for geo/coords |
| T-05 | ✅ Resolved 2026-02-13: tests for time utilities |
| L-01 | ✅ Resolved 2026-02-13: configure a linter |
| L-02 | ✅ Resolved 2026-02-13: configure a formatter |
| A-02 | ✅ Resolved 2026-02-12: introduce state management |
| A-05 | ✅ Resolved 2026-02-13: defer compute with `InteractionManager.runAfterInteractions` |
| A-06 / U-11 | ✅ Resolved 2026-02-13: make countdown timer tick in real time |
| A-11 | ✅ Resolved 2026-02-16: added error boundary with recovery UI + Sentry crash reporting |
| E-05 | ✅ Resolved 2026-02-13: fix oversimplified magnitude formula |
| AC-01 | ✅ Resolved 2026-02-16: completed accessibility labels on LandingScreen + NotificationSettingsScreen |
| U-01 / F-09 | ✅ Resolved 2026-02-13: show local time for contacts |
| F-01 | ✅ Resolved 2026-02-19: multi-eclipse switching on timer |
| F-02 | ✅ Resolved 2026-02-16: persist user preferences via AsyncStorage |
| F-03 | ✅ Resolved 2026-02-16: implement real alarm scheduling |
| CI-02 | ✅ Resolved 2026-02-16: created local EAS Build + direct store upload workflow (`.github/workflows/eas-build.yml`) |
| CI-03 | Configure app signing / keystore (blocks store submission) |
| CI-05 | ✅ Resolved 2026-02-16: integrated @sentry/react-native with Sentry.wrap + ErrorBoundary |
| SP-02 | ✅ Resolved 2026-02-16: privacy policy written, store privacy declarations documented, iOS privacy manifest added |

### 🟡 Medium — Plan Next
| ID | Summary |
|----|---------|
| T-06 | ✅ Resolved 2026-02-13: tests for catalog scripts |
| T-07 | Mobile component tests |
| T-08 | End-to-end regression suite |
| L-03 | ✅ Resolved 2026-02-16: installed Husky + lint-staged pre-commit hooks |
| A-03 | ✅ Resolved 2026-02-13: extract helper functions from App.tsx |
| A-04 | ✅ Resolved 2026-02-13: add navigation library |
| A-07 | ✅ Resolved 2026-02-16: wire up real notifications for alarms |
| A-10 | ✅ Resolved 2026-02-16: wired GPS altitude through to engine `elevM` |
| E-03 | ✅ Resolved 2026-02-13: deduplicate `evaluateAtT` calls |
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
| U-02 | ✅ Resolved 2026-02-13: rename "Central 10:00" button |
| U-03 | ✅ Resolved 2026-02-13: add splash/loading screen |
| U-06 | ✅ Resolved 2026-02-13: add search/filter to landing list |
| U-08 | ✅ Resolved 2026-02-13: handle GIF loading/error states |
| U-09 | ✅ Resolved 2026-02-13: fix magnitude display for total eclipses |
| P-01 | ✅ Resolved 2026-02-13: lazy-load catalog overlays |
| P-02 | ✅ Resolved 2026-02-13: on-demand decade overlay chunks |
| P-04 | ✅ Resolved 2026-02-13: deduplicate polynomial evaluations |
| P-05 | ✅ Resolved 2026-02-13: virtualize landing list with FlatList |
| AC-02 | Add non-color overlay differentiation |
| AC-04 | Support dynamic font sizing |
| SP-01 | ✅ Resolved 2026-02-16: added pre-permission rationale Alert dialog before location request |
| CI-04 | ✅ Resolved 2026-02-16: created `.env.example` with Sentry/EAS placeholders |
| CI-06 | ✅ Resolved 2026-02-16: installed + configured `expo-updates` with runtimeVersion and EAS update URL |
| CI-07 | ✅ Partially resolved 2026-02-16: store descriptions, content rating answers, and icon fix completed. Screenshots and feature graphic still needed (manual). |
| CI-10 | ✅ Resolved 2026-02-16: added `expo-splash-screen` with preventAutoHideAsync/hideAsync |
| CI-11 | ✅ Resolved 2026-02-16: bumped to `1.0.0` with `buildNumber: "1"` and `versionCode: 1` |
| D-01 | Write CONTRIBUTING.md |
| D-02 | ✅ Resolved 2026-02-16: created `CHANGELOG.md` with v1.0.0 entry |
| D-06 | Document catalog data provenance |
| F-04 | Offline support |
| F-05 | ✅ Resolved 2026-02-16: GPS altitude wired through to engine `elevM` |
| F-10 | Geocoding / address search |

### 🟢 Low — Backlog
| IDs | Summary |
|-----|---------|
| L-04 | `.editorconfig` |\n| L-05 | ✅ Resolved 2026-02-16: pinned Node 20 via `.nvmrc` |
| A-08, A-09 | Minor code organization |
| E-07, E-09, E-10 | Docs fix, `_debug` type, optimizer upgrade |
| C-03, C-04, C-07, C-08 | Generated file hygiene |
| S-03 | Shared types versioning |
| M-02, M-03, M-05, M-06 | Dep dedup, clean script, task runner |
| U-04, U-05, U-07, U-10, U-12 | UX polish |
| AC-03 | Touch target sizing |
| SP-03 | URL sanitization |
| D-03, D-04, D-05 | TSDoc, ADRs, JSDoc fix |
| F-06, F-07, F-08 | Share, web support, animation |

---

## 15. Production Readiness Checklist — App Store Submission

> Added: 2026-02-16
> Goal: Track every concrete step required to go from the current state to a submitted app on the Apple App Store and Google Play Store.

### Phase 1 — Identity & Build Infrastructure (blocks everything else)

| # | Step | Relates To | Status |
|---|------|-----------|--------|
| 1.1 | **Choose a final Android `applicationId`** — set to `com.lallimaven.eclipsetimer` in `app.json` → `expo.android.package`. This is **immutable** after first Play Store upload. | CI-09 | ✅ Done 2026-02-16 |
| 1.2 | **Set iOS `bundleIdentifier`** — set to `com.lallimaven.eclipse-timer` in `app.json` → `expo.ios.bundleIdentifier`. | CI-08 | ✅ Done 2026-02-16 |
| 1.3 | **Create `eas.json`** with three build profiles: `development` (internal, simulator), `preview` (TestFlight / internal track APK), `production` (store release, autoIncrement). | CI-00, CI-03 | ✅ Done 2026-02-16 |
| 1.4 | **Run `eas build --profile production --platform all`** once to verify builds complete and EAS manages signing credentials (keystore + provisioning profiles). | CI-03 | ⬜ Not started |
| 1.5 | **Bump version to `1.0.0`** in both `apps/mobile/package.json` and `apps/mobile/app.json`. Set `expo.ios.buildNumber: "1"` and `expo.android.versionCode: 1`. | CI-11 | ✅ Done 2026-02-16 |

### Phase 2 — Stability & Quality (required before store review)

| # | Step | Relates To | Status |
|---|------|-----------|--------|
| 2.1 | **Add a React error boundary** wrapping `<RootNavigator />` in `App.tsx`. Show a recovery UI with "Restart" button instead of a white-screen crash. | A-11 | ✅ Done 2026-02-16 |
| 2.2 | **Integrate crash reporting** — installed `@sentry/react-native`, configured plugin in `app.json`, wrapped root component with `Sentry.wrap` + `ErrorBoundary`. DSN placeholder set — replace with real DSN before production. | CI-05 | ✅ Done 2026-02-16 |
| 2.3 | **Complete accessibility labels** on `LandingScreen` and `NotificationSettingsScreen`. All interactive elements have `accessibilityLabel` + `accessibilityRole`. | AC-01 | ✅ Done 2026-02-16 |
| 2.4 | **Add `expo-splash-screen` control** — `preventAutoHideAsync()` called at module level in `App.tsx`, `hideAsync()` called after catalog loads in `RootNavigator`. | CI-10 | ✅ Done 2026-02-16 |
| 2.5 | **Show a pre-permission rationale** dialog before calling `requestForegroundPermissionsAsync()` explaining why the app needs location. | SP-01 | ✅ Done 2026-02-16 |
| 2.6 | **Test on physical devices** for both iOS and Android using `eas build --profile preview`. Validate notifications, location, map, and deep-link scheme. | — | ⬜ Not started |

### Phase 3 — Legal & Policy (required by both stores)

| # | Step | Relates To | Status |
|---|------|-----------|--------|
| 3.1 | **Write a privacy policy** covering: location data (used locally, not transmitted), network requests (NASA GIF URLs), notification permissions, Sentry crash reporting, no analytics/tracking. Hosted at `PRIVACY_POLICY.md` — deploy to a public URL (e.g., GitHub Pages) before store submission. | SP-02 | ✅ Done 2026-02-16 |
| 3.2 | **Add the privacy policy URL** to `app.json` → `expo.ios.privacyManifests` (iOS 17+ privacy manifest with `NSPrivacyAccessedAPITypes` and `NSPrivacyCollectedDataTypes`). Also added `infoPlist.NSLocationWhenInUseUsageDescription`. Deploy public URL and link in store listings. | SP-02 | ✅ Done 2026-02-16 |
| 3.3 | **Prepare Apple App Privacy labels** — documented in `documents/store-privacy-declarations.md`. Declares Precise Location (app functionality, not linked, not tracking) and Crash Data (app functionality, not linked, not tracking). | SP-02 | ✅ Done 2026-02-16 |
| 3.4 | **Prepare Google Play Data Safety section** — documented in `documents/store-privacy-declarations.md`. Declares precise location (ephemeral, optional), crash logs (shared with Sentry), no personal info / ads / tracking. | SP-02 | ✅ Done 2026-02-16 |

### Phase 4 — Store Metadata & Assets (required for listing)

| # | Step | Relates To | Status |
|---|------|-----------|--------|
| 4.1 | **Create production app icon** — `icon.png` flattened to 24-bit RGB (no alpha) for iOS. `adaptive-icon.png` (1024×1024) and `favicon.png` (256×256) verified. Android feature graphic (1024×500) still needed. | CI-07 | ✅ Done 2026-02-16 |
| 4.2 | **Capture screenshots** — requirements documented in `documents/store-metadata.md` with device classes, sizes, and recommended screens. Actual capture requires `eas build --profile preview` on device/simulator. | CI-07 | ⬜ Manual step |
| 4.3 | **Write store description** — short description (71 chars), full description (1 753 chars), keywords (78 chars), and "what's new" for v1.0.0 written in `documents/store-metadata.md`. | CI-07 | ✅ Done 2026-02-16 |
| 4.4 | **Set content rating** — questionnaire answers documented in `documents/store-metadata.md`. Expected: 4+ (iOS) / Everyone (Android). Fill out in store consoles during submission. | CI-07 | ✅ Done 2026-02-16 |
| 4.5 | **Create or verify Apple Developer & Google Play Console accounts** — requirements documented. Verify `lallimaven` Expo account is linked to store accounts. | — | ⬜ Manual step |

### Phase 5 — CI/CD (strongly recommended before release)

| # | Step | Relates To | Status |
|---|------|-----------|--------|
| 5.1 | **Create a GitHub Actions CI workflow** — `.github/workflows/ci.yml` runs on push/PR to `main`: checkout → pnpm install → typecheck → lint → test. Includes concurrency grouping to cancel stale runs. | CI-01 | ✅ Done 2026-02-16 |
| 5.2 | **Add an EAS Build workflow** — `.github/workflows/eas-build.yml` triggers on `main` push or manual dispatch. CI checks run first, then `eas build --profile production --local`. Platform selectable via `workflow_dispatch` input (default: `all`). Requires `EXPO_TOKEN` secret. | CI-02 | ✅ Done 2026-02-16 |
| 5.3 | **Add a store upload step** — included as a gated `submit` job in `eas-build.yml`. Only runs on manual dispatch with `submit: true`. Uses `environment: production` for manual approval before store upload. Uploads iOS via `apple-actions/upload-testflight-build` and Android via `r0adkll/upload-google-play`. | CI-02 | ✅ Done 2026-02-16 |
| 5.4 | **Set up `expo-updates`** — installed `expo-updates`, added `runtimeVersion: { policy: "appVersion" }` and `updates` config (URL, checkAutomatically ON_LOAD, fallbackToCacheTimeout 0) to `app.json`, added `expo-updates` plugin. | CI-06 | ✅ Done 2026-02-16 |

### Phase 6 — Nice-to-have before v1.0.0

| # | Step | Relates To | Status |
|---|------|-----------|--------|
| 6.1 | Add pre-commit hooks (Husky + lint-staged) to prevent committing broken code. Configured `biome check --write` on staged files via `lint-staged` in root `package.json`. | L-03 | ✅ Done 2026-02-16 |
| 6.2 | Add `.env.example` and `expo-constants` for environment configuration. Created `apps/mobile/.env.example` with `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, and `EXPO_PROJECT_ID` placeholders. | CI-04 | ✅ Done 2026-02-16 |
| 6.3 | Start a `CHANGELOG.md`. Created with full v1.0.0 entry covering all Added/Changed/Fixed items. | D-02 | ✅ Done 2026-02-16 |
| 6.4 | Pin Node version with `.nvmrc` (e.g., `20`). Created `.nvmrc` at repo root. | L-05 | ✅ Done 2026-02-16 |
| 6.5 | Wire GPS altitude through to engine `elevM` for improved accuracy. `useGps` now captures `coords.altitude` and threads it through the `Pin` type to `Observer.elevM`. Map taps default to 0. | A-10, F-05 | ✅ Done 2026-02-16 |

### Summary: Minimum Viable Store Submission

The absolute minimum to submit to both stores (phases 1–4):

```
 Phases 1–4 complete
 ├── Final bundle ID + package name set
 ├── eas.json created, builds succeed
 ├── Version 1.0.0
 ├── Error boundary + crash reporting
 ├── Accessibility pass
 ├── Splash screen control
 ├── Privacy policy hosted + linked
 ├── Store metadata (icon, screenshots, description, rating)
 └── Physical device testing passed
```

Phase 5 (CI/CD) is strongly recommended but not strictly required for a manual first submission. Phase 6 items improve developer experience and code quality but are not store blockers.

### Remaining Items (manual steps across all phases)

All automatable work across Phases 1–6 is complete. The items below require manual action before the app can be submitted to the stores.

#### Before first build (Phase 1)
| # | Action | Where |
|---|--------|-------|
| 1.4 | Run `eas build --profile production --platform all` to verify builds complete and EAS manages signing credentials (keystore + provisioning profiles). | Terminal / EAS dashboard |

#### Before store submission (Phases 2–4)
| # | Action | Where |
|---|--------|-------|
| — | Replace `__YOUR_SENTRY_DSN__` with a real Sentry DSN. | `apps/mobile/src/App.tsx` line 16 |
| — | Replace `__YOUR_SENTRY_ORG__` and `__YOUR_SENTRY_PROJECT__` with real Sentry values. | `apps/mobile/app.json` → plugins → `@sentry/react-native/expo` |
| — | Ensure iOS submit identity is set in `apps/mobile/eas.json` (`appleId`, `ascAppId`, `appleTeamId`). | `apps/mobile/eas.json` → submit → production |
| — | Host `PRIVACY_POLICY.md` at a public URL (e.g., GitHub Pages) and link it in both store listings. | GitHub repo settings or hosting provider |
| 2.6 | Test on physical devices (iOS + Android) using `eas build --profile preview`. Validate notifications, location, map, and deep-link scheme. | Physical devices |
| 4.2 | Capture screenshots for all required device classes (see `documents/store-metadata.md` for sizes and recommended screens). | Simulator / physical devices |
| — | Create Android feature graphic (1024×500) for Google Play listing. | Design tool (Figma, etc.) |
| 4.4 | Fill out content rating questionnaires in App Store Connect and Google Play Console (answers documented in `documents/store-metadata.md`). | Store consoles |
| 4.5 | Verify Apple Developer and Google Play Console accounts. Ensure `lallimaven` Expo account is linked to both store accounts. | Apple Developer / Google Play Console |

#### Before CI/CD workflows work (Phase 5)
| # | Action | Where |
|---|--------|-------|
| — | Add `EXPO_TOKEN` secret to GitHub repo (used by local EAS build in CI). Generate at [expo.dev account settings](https://expo.dev/accounts/lallimaven/settings/access-tokens). | GitHub → Settings → Secrets → Actions |
| — | Add App Store upload secrets: `APPSTORE_ISSUER_ID`, `APPSTORE_API_KEY_ID`, `APPSTORE_API_PRIVATE_KEY`. | GitHub → Settings → Secrets → Actions |
| — | Add Google Play upload secret: `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`. | GitHub → Settings → Secrets → Actions |
| — | Create a `production` environment in GitHub for manual approval before store upload. | GitHub → Settings → Environments |
