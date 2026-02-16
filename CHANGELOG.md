# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
