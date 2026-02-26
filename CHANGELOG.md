# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.31] — 2026-02-26

### Added
- Added first-run onboarding walkthrough for new users with step-by-step guidance across `Landing`, `Timer`, and `Settings`.
- Added persisted onboarding completion state in app preferences with an explicit `Skip` option.
- Added an in-app `Help & FAQ` screen under `Settings` with concise FAQ/troubleshooting content and deep links to full documentation.
- Added regression tests for onboarding walkthrough configuration and Help content/doc-link validation.

### Changed
- Updated `RootNavigator` to wire onboarding overlay behavior and Help route deep-link path (`eclipsetimer://settings/help`).
- Updated `documents/planning/tech-debt.md` to mark `ADD-11` and `ADD-13` as completed and remove them from pending execution order.
- Bumped `apps/mobile` version to `1.1.31`.

### Tests
- Verified mobile checks pass: `pnpm -C apps/mobile typecheck`, `pnpm -C apps/mobile lint`, and `pnpm -C apps/mobile test`.

## [1.1.30] — 2026-02-26

### Changed
- Updated `.github/workflows/eas-build.yml` to upload the Wear OS AAB to Google Play internal track in addition to the phone Android AAB.
- Made Wear OS Google Play upload non-blocking with `continue-on-error` and explicit failure logging so the workflow continues to GitHub release creation even if Wear upload fails.
- Bumped `apps/mobile` version to `1.1.30`.

## [1.1.29] — 2026-02-26

### Changed
- Continued the theme-token migration to remaining app surfaces by tokenizing `EclipsePreviewScreen` and removing hardcoded dark-only panel/background styling there.
- Updated app error recovery UI to respect active app theme preference by wiring `ErrorBoundary` to theme colors through app state context.
- Removed leftover hardcoded startup-shell fallback colors in `RootNavigator` styles so startup visual tokens come from the active theme.
- Bumped `apps/mobile` version to `1.1.29`.

### Tests
- Verified mobile checks pass after this migration step: `pnpm -C apps/mobile typecheck`, `pnpm -C apps/mobile test`, and `pnpm -C apps/mobile lint`.

## [1.1.28] — 2026-02-26

### Added
- Added a new `Settings` parent screen that links to `Theme Settings`, `Notification/Alarm Settings`, and `Location Settings`.
- Added a dedicated `Theme Settings` screen with persisted `System`, `Light`, and `Dark` appearance options.
- Added centralized mobile theme infrastructure (`apps/mobile/src/theme/colors.ts`, `apps/mobile/src/theme/resolveAppTheme.ts`, `apps/mobile/src/theme/useAppTheme.ts`) and app-state support for storing theme preference.
- Added a theme-resolution regression test (`apps/mobile/tests/theme-resolution.test.ts`).
- Added archived internal testing feedback report at `documents/reports/testing-feedback_2026-02-26.pdf`.

### Changed
- Reorganized side-menu navigation to expose a single `Settings` destination, with notification/location settings moved under the parent settings flow.
- Wired React Navigation container theming to app preference + system appearance and updated shared/shell styling (`BurgerButton`, `Landing`, `Timer`, `Notification/Alarm Settings`, `Location Settings`) to use theme tokens for light/dark support.
- Updated Timer favorite empty-state guidance path to `Menu > Settings > Location Settings`.
- Updated `documents/planning/tech-debt.md` with internal testing feedback mapping and new tracked backlog items (`ADD-11`..`ADD-15`, `IMP-28`..`IMP-29`).
- Bumped `apps/mobile` version to `1.1.28`.

### Tests
- Verified mobile checks pass after these changes: `pnpm -C apps/mobile typecheck`, `pnpm -C apps/mobile test`, and `pnpm -C apps/mobile lint`.

## [1.1.27] — 2026-02-24

### Fixed
- Updated Android phone app wearable listener manifest registration to replace deprecated `com.google.android.gms.wearable.BIND_LISTENER` with filtered `MESSAGE_RECEIVED` intent handling for live-location Data Layer messages.
- Resolved release build failure in CI caused by `WearableBindListener` lint fatal error during `:app:lintVitalRelease`.

### Changed
- Bumped `apps/mobile` version to `1.1.27`.

## [1.1.26] — 2026-02-24

### Added
- Added end-to-end Wear companion live pipeline: watch GPS payload publishing, phone-side active-eclipse computation, and live render payload sync with sun-only fallback when no active eclipse is found.
- Added Wear preview mode synchronization with strict phone `Preview` route gating, preview payload publishing, and two-way preview scrub messaging between phone and watch.
- Added watch native eclipse renderer (`EclipseRenderView`) with sun/moon drawing and totality ring/corona transitions, plus stale-live fallback handling and status messaging.
- Added a Windows disposable phone+Wear emulator workflow guide for path-length-safe local native testing (`documents/guides/windows-disposable-phone-wear-emulator.md`).

### Changed
- Extended wearable shared preview payload schema with travel vector and contact progress anchors so phone and watch preview frames stay aligned while scrubbing.
- Improved Android Data Layer reliability with node-id caching/retry send flow, a listener service fallback handshake, and JS bridge `sendMessage` support.
- Updated Wear package/config wiring to use `com.lallimaven.eclipsetimer` package naming in watch build/docs/workflows and to require watch location permissions.
- Updated phone preview visuals to blend totality ring/corona effects and synchronize scrub progress with watch input.
- Excluded Android build output folders from Metro resolution to avoid duplicate module/path issues.
- Bumped `apps/mobile` version to `1.1.26`.

### Tests
- Added regression tests for wear live payload computation, preview payload generation, preview scrub payload parsing, and totality glow blending behavior.

## [1.1.25] — 2026-02-24

### Added
- Added Android and Wear OS screenshot workflow device presets with profile-resolution fallbacks for Samsung, Pixel, and generic Wear form factors.
- Added iPad simulator targets to the iOS screenshot workflow dispatch input options.
- Added `supportsTablet: true` in `apps/mobile/app.json` so iOS build metadata explicitly supports iPad.

### Changed
- Improved Android and Wear screenshot automation to launch the app with `am start`, verify foreground activity before capture, and use safer deep-link iteration handling.
- Updated the Timer screen eclipse picker modal to auto-scroll to the selected eclipse (or first upcoming option) and recover reliably when `FlatList` index scrolling fails.
- Bumped `apps/mobile` version to `1.1.25`.

## [1.1.24] — 2026-02-24

### Changed
- Tightened the Timer screen compact `MAX View` preview to show the sun-only disk area (without surrounding corona glow) and reduced its footprint so the hero layout fits more cleanly.
- Bumped `apps/mobile` version to `1.1.24`.

## [1.1.23] — 2026-02-24

### Added
- Added dedicated Android and Wear OS emulator screenshot workflows that build local APK artifacts, capture screenshots, package results into a single zip, and upload that zip to the latest GitHub release.
- Added Wear app deep-link handling for the `eclipsetimer://` scheme in the Wear module so screenshot automation can drive deterministic screens by URL.

### Changed
- Updated iOS simulator screenshot release publishing to upload one packaged screenshots zip asset instead of attaching each screenshot file individually.
- Updated the Wear OS screenshot workflow to support configurable deep-link inputs and per-link screenshot capture behavior.
- Bumped `apps/mobile` version to `1.1.23`.

## [1.1.22] — 2026-02-24

### Fixed
- Fixed Wear OS release signing detection in `apps/mobile/android/wear/build.gradle` so EAS local Android phone builds no longer fail during `:wear` project configuration.
- Scoped the Wear signing guard to `:wear` release tasks and improved signing-property resolution for local EAS credential injection.

### Changed
- Bumped `apps/mobile` version to `1.1.22`.

## [1.1.21] — 2026-02-23

### Changed
- Refined the Timer screen declutter pass by keeping the larger map while moving action controls out of the map viewport into a compact row below it, so map content is less obstructed.
- Simplified the Active Eclipse switcher to a single concise row to reduce vertical and textual chrome.
- Increased map viewport height to `420` for stronger map-first focus on the Timer screen.
- Bumped `apps/mobile` version to `1.1.21`.

## [1.1.20] — 2026-02-23

### Changed
- Moved the map direction legend controls to the lower-left legend stack so they no longer block the map action buttons.
- Simplified map legend labels by removing `On/Off` state text for direction, eclipse visibility, and central-path overlays.
- Bumped `apps/mobile` version to `1.1.20`.

## [1.1.19] — 2026-02-23

### Fixed
- Corrected Timer screen compact `MAX View` moon/sun sizing so moon-size ratios now match the full preview geometry instead of using oversized fixed moon radii.

### Changed
- Bumped `apps/mobile` version to `1.1.19`.

### Tests
- Added regression tests to verify compact-stage moon/sun ratio scaling and C1/C4 tangency distance in the Timer screen `MAX View` size profile.

## [1.1.18] — 2026-02-23

### Added
- Split the Timer screen `Next Event Timer` hero into a two-column layout with a compact right-side `MAX View` sun preview.

### Changed
- Bumped `apps/mobile` version to `1.1.18`.

## [1.1.17] — 2026-02-23

### Changed
- Updated Timer screen duration formatting to show `hh:mm:ss` when total minutes are greater than 60; durations at 60 minutes or below continue showing `Xm YYs`.
- Bumped `apps/mobile` version to `1.1.17`.

## [1.1.16] — 2026-02-23

### Changed
- Updated Timer screen summary metrics: replaced `Magnitude` with `C1-C4 Duration` (computed from first to last contact times) and renamed `Central Duration` to `Totality Duration` for clearer eclipse-phase wording.
- Bumped `apps/mobile` version to `1.1.16`.

## [1.1.15] — 2026-02-23

### Removed
- Removed the Android map-mode rebuild hint from the Timer screen.

### Changed
- Bumped `apps/mobile` version to `1.1.15`.

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
