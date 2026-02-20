# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] — 2026-02-20

### Added
- Added a per-eclipse master toggle on the Timer screen (`Enable alarms and reminders for this eclipse`) that gates all event alarms/reminders while preserving per-event selections.
- Added foreground in-app alarm timing controls in Notification/Alarm Settings: `a1 lead (sec)` and `a2 countdown (sec)` with validation (`a1: 2..60`, `a2: 1..30`, `a2 < a1`).
- Added a dedicated in-app alarm engine for enabled event contacts that speaks:
  - `a1` phrase (`"<a1> seconds to <Event>"`)
  - second-by-second countdown from `a2` to `1`
  - final phrase at event time (`"We're at <Event>"`)
- Added regression tests for alarm timing normalization, in-app alarm sequencing, and reminder schedule generation.

### Changed
- Renamed `Notification Settings` to `Notification/Alarm Settings` in UI labels/navigation.
- Reworked reminder scheduling to fixed per-eclipse background reminders only:
  - one reminder at `T-1h` and one at `T-10m`
  - both anchored to the eclipse first event time
  - no per-contact reminder scheduling
- Preserved mock contact timeline compatibility with the new hybrid model for both fixed reminders and in-app event alarms.
- Updated testing scenarios and status documentation to reflect the hybrid alarm/reminder model and foreground-only precision alarm behavior.

## [1.0.4] — 2026-02-20

### Added
- Added Android APK output (`android.apk`) to the existing release pipeline artifacts while keeping `ios.ipa` and `android.aab`.
- Added a dedicated `production-apk` EAS build profile for local Android APK generation in CI.

### Changed
- GitHub Releases now use the current version section from `CHANGELOG.md` as the release body instead of empty/auto-generated notes.

## [1.0.3] — 2026-02-20

### Added
- Added a configurable mock contact timeline for on-device alarm testing, with persisted settings for `C1` offset and per-contact gap in Notification Settings.

### Changed
- Replaced manual mock timeline apply flow with clearer toggle-driven behavior and inline ON/OFF status feedback in Notification Settings.
- Mock timeline notifications now schedule as a repeating cycle (`C1 -> C2 -> MAX -> C3 -> C4`) and continue looping while mock mode is enabled.
- Added a regression test covering mock contact timeline offset/gap behavior.

## [1.0.2] — 2026-02-20

### Changed
- Optimized GitHub Actions by removing duplicated setup/install work in `.github/workflows/eas-build.yml` (CI checks and local mobile build now share a single job setup).
- Added `paths-ignore` for docs/log-only changes in `.github/workflows/ci.yml` and `.github/workflows/eas-build.yml` to avoid unnecessary runner usage.
- Improved workflow runtime by preferring offline dependency installs (`pnpm install --frozen-lockfile --prefer-offline`) across CI/build/screenshot workflows.
- Reduced redundant release overhead in `.github/workflows/eas-build.yml` with shallow checkouts plus tag fetch, and by running release gate checks in parallel with the build.
- Made Android SDK install incremental in `.github/workflows/eas-build.yml` so only missing SDK components are installed.
- Removed duplicate iOS submit step and fixed Play release-note truncation to stay within the 500-character limit.

## [1.0.1] — 2026-02-19

### Added
- Timer screen now supports in-screen multi-eclipse switching via an eclipse picker modal.

### Changed
- `eas-build.yml` now always builds both iOS and Android in a single run.
- Store submit now compares `apps/mobile/package.json` version to the latest Git release tag and runs only when incremented, so retries after failed builds can reuse the same version.
- Store release notes are now sourced from `CHANGELOG.md` for all versions between the last successful release tag and the current version, then attached to submissions where supported.

## [1.0.0] — 2026-02-16

### Added
- **Eclipse catalog** — 200+ solar eclipses (1900–2100) with Besselian element polynomials, sourced from NASA data.
- **Eclipse engine** — computes five contact points (C1/C2/max/C3/C4), magnitude, obscuration, and eclipse kind for any observer location.
- **Interactive map** — tap or drag a pin to set observer location; toggle satellite/hybrid views.
- **Overlay paths** — penumbral and umbral/antumbral shadow paths rendered on the map, loaded lazily by decade.
- **GPS location** — one-tap "Use GPS" with pre-permission rationale dialog; location stays on-device.
- **Live countdown** — ticking countdown to the next eclipse contact event.
- **Local time display** — contact times shown in both UTC and device-local time.
- **Search & filter** — tokenized search on the eclipse landing list (by year, date, kind, ID).
- **Notifications** — per-contact local notification scheduling with configurable reminder lead times, sound, vibration, and TTS audio modes.
- **Notification settings** — dedicated screen for global and per-eclipse notification preferences, persisted via AsyncStorage.
- **NASA GIF preview** — prefetched/cached eclipse animation preview with loading placeholder and error fallback.
- **Error boundary** — catches runtime crashes with a recovery UI and Sentry reporting.
- **Sentry crash reporting** — `@sentry/react-native` integration (production-only).
- **Splash screen control** — native splash held until catalog loads via `expo-splash-screen`.
- **Accessibility** — labels, roles, and states on all interactive elements (landing + notification settings screens).
- **Privacy policy** — `PRIVACY_POLICY.md` covering location, Sentry, NASA GIF, notifications; iOS privacy manifest in `app.json`.
- **Store metadata** — descriptions, keywords, content rating answers, icon (alpha-stripped for iOS) in `documents/store-metadata.md`.
- **CI/CD** — GitHub Actions CI (typecheck/lint/test), EAS Build + Submit workflow, `expo-updates` OTA support.
- **Pre-commit hooks** — Husky + lint-staged running Biome check on staged files.
- **EAS Build profiles** — `development`, `preview`, `production` in `eas.json`.

### Changed
- Refactored `App.tsx` from ~1 000-line god component into screens, hooks, and utilities.
- Replaced `ScrollView` + `.map()` with virtualized `FlatList` on landing screen.
- Engine magnitude formula uses geometric `(L1obs - Δ) / (L1obs + L2obs)` instead of hardcoded `1`.
- Overlay polygons loaded lazily by decade instead of monolithic JSON.
- `evaluateAtT` results cached per-`t` during contact solving to avoid duplicate evaluations.

### Fixed
- Countdown timer now ticks in real time (was static).
- GPS altitude wired through to engine `elevM` (was hardcoded to 0).
