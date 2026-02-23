# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.14] — 2026-02-23

### Changed
- Bumped `apps/mobile` version to `1.1.14` to trigger a fresh mobile release build after rotating Google Maps key secrets in GitHub Actions.

## [1.1.13] — 2026-02-22

### Fixed
- Corrected preview contact interpolation so C1/C2/C3/C4 remain geometrically consistent even when the moon track has a non-zero closest-approach offset.
- Improved satellite/hybrid map readability by reducing eclipse overlay opacity in photo map modes and forcing map remount when switching map type to refresh tile detail loading.

### Changed
- Bumped `apps/mobile` version to `1.1.13`.

### Tests
- Added a regression test that verifies C1/C4 tangency remains exact for partial eclipse preview geometry with non-zero closest approach and directional travel.

## [1.1.12] — 2026-02-22

### Changed
- Fixed eclipse preview moon trajectory to use contact-bearing motion vectors (including vertical drift), so locations like the 2024 eclipse path animate from lower-left toward upper-right when appropriate.
- Preview now shows a text summary of the computed moon-path direction relative to the sun for the selected GPS point.

### Tests
- Added regression tests for diagonal travel vector behavior and user-facing direction labeling in preview geometry utilities.

## [1.1.11] — 2026-02-22

### Fixed
- Updated preview mode moon motion so left/right travel direction follows local contact bearing progression when bearing data is available.
- Wired contact bearing values into preview payload construction so direction-aware geometry has access to C1/C2/C3/C4 bearing inputs.
- Added regression tests for bearing-based travel direction selection and fallback behavior when bearing pairs are incomplete.

## [1.1.10] — 2026-02-22

### Fixed
- Improved eclipse preview moon-path geometry so contact phases align with expected tangency behavior: C1 starts at outer tangency, C2 reaches inner tangency, MAX is centered, and C3 remains at inner tangency before sun reappears.
- Added regression tests for preview geometry calculations to keep C1/C2/MAX/C3 positioning behavior verifiable.

## [1.1.9] — 2026-02-21

### Added
- Added `production-wear-apk` EAS build profile in `apps/mobile/eas.json` to produce Wear OS APK output (`wear-release.apk`) for release packaging.

### Changed
- Updated `.github/workflows/eas-build.yml` to build both Wear OS artifacts (`wear-release.aab` and `wear-release.apk`) and attach both to GitHub releases.
- Kept store submission scoped to the phone Android AAB only; Wear OS artifacts are released on GitHub and not uploaded to Google Play.

## [1.1.8] — 2026-02-21

### Added
- Added a new docs guide set under `documents/guides/`: setup and development, contributing, deployment, troubleshooting, and performance optimization.
- Added `documents/REORGANIZATION.md` to document the new documentation layout and migration summary.

### Changed
- Reorganized `documents/` into purpose-based sections (`guides/`, `planning/`, `reference/`) and updated `documents/README.md` with quick-start, role-based reading paths, and maintenance standards.
- Updated `.github/workflows/eas-build.yml` to temporarily disable Wear OS artifact validation, release asset packaging, and Google Play upload steps until the Wear package is ready in Play Console.

## [1.1.7] — 2026-02-21

### Changed
- Updated `.github/workflows/eas-build.yml` to upload the Wear OS AAB (`com.lallimaven.eclipsetimer.wear`) to Google Play internal track in addition to the phone AAB, so releases for both packages are created directly from CI.

## [1.1.6] — 2026-02-21

### Fixed
- Updated the Wear module Android `applicationId` to `com.lallimaven.eclipsetimer.wear` so the Wear APK installs as a distinct package instead of conflicting with the phone app package during install/update.

## [1.1.5] — 2026-02-21

### Changed
- Updated Play Store submission in `.github/workflows/eas-build.yml` to upload only the Android AAB and temporarily disable Wear APK upload after Google Play returned `APKs are not allowed for this application.`.

## [1.1.4] — 2026-02-21

### Changed
- Updated mobile build artifact collection in `.github/workflows/eas-build.yml` to reliably distinguish phone and Wear APK outputs when EAS local builds emit generic `build-*.apk` filenames.

## [1.1.3] — 2026-02-21

### Added
- Added a dedicated `production-wear` EAS build profile to produce a Wear release APK (`android/wear/build/outputs/apk/release/wear-release.apk`).
- Added initial Wear OS companion module scaffolding and phone/watch Data Layer bridge wiring for Phase 0.

### Changed
- Updated mobile release workflow to build iOS, Android (AAB + APK), and Wear APK in one run, and publish the Wear APK as a GitHub release asset.
- Updated Google Play internal-track submission to upload both the phone AAB and Wear APK in the same release edit.

## [1.1.2] — 2026-02-20

### Changed
- Reworked notification/alarm settings so eclipse-level `T-1h` and `T-10m` reminders always use system notifications.
- Replaced `Test Notification` with `Play Test TTS Alarm` for foreground in-app voice alarm testing.
- Removed enabled in-app event alarm maintenance from Notification/Alarm Settings; per-event alarm toggles remain managed on the Timer screen.

### Removed
- Removed the `Voice (TTS)` toggle from Notification/Alarm Settings.
- Removed notification-delivery TTS playback for background reminders.

## [1.1.1] — 2026-02-20

### Changed
- GitHub Release artifacts are now versioned as `eclipse-timer-v<version>.ipa`, `eclipse-timer-v<version>.aab`, and `eclipse-timer-v<version>.apk` instead of static names.
- Updated in-app alarm TTS phrasing to use concise event keys for `a1` prompts (`"<a1> seconds to C1/C2/MAX/C3/C4"`) and event-specific completion phrases (`"Partial eclipse started"`, `"Totality started"`, `"This is the maximum eclipse"`, `"Totality ended"`, `"Partial eclipse ended"`).

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
