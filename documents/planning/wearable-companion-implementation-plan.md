# Wearable Companion Implementation Plan (Concrete Checklist)

Last updated: 2026-02-24  
Status: In Progress (PR 1-PR 6 implemented in code and validated on emulator; final hardware QA pending)

## 1. Purpose

Translate these inputs into an executable implementation checklist:

- `documents/high-level/wearable-companion-requirements.md`
- `documents/low-level/wearable-companion-technical-design.md`

This plan is intentionally strict to MVP scope:

- Live mode: watch GPS + sun always + moon only when eclipse is active now.
- Preview mode: available only while phone preview is open, scrubbed by watch rotary input.
- No other watch features.

## 1A. Pull Request Plan (Execution Order)

This section is the active delivery sequence for the requested behavior:

- default watch screen = live sun render from current watch GPS + current time
- watch moon overlay only when eclipse is active now
- watch switches into preview mode while phone preview is open
- watch rotary scrub controls preview animation
- watch auto-returns to live mode when phone preview closes

### PR 1: Watch Live-Location Foundation (Start Here)

Status: Implemented in code (2026-02-24), emulator verified; real hardware verification pending

Scope:

- [x] Add watch location permission + runtime permission request.
- [x] Start fused GPS updates while watch app is foregrounded.
- [x] Send structured live-location payloads to phone over `/wear/live/location/v1`.
- [x] Keep watch status/debug text so phone reply payloads are visible during development.
- [x] Add basic location send throttling (distance + periodic resend fallback).

Files changed:

- [x] `apps/mobile/android/wear/build.gradle`
- [x] `apps/mobile/android/wear/src/main/AndroidManifest.xml`
- [x] `apps/mobile/android/wear/src/main/res/values/strings.xml`
- [x] `apps/mobile/android/wear/src/main/java/com/lallimaven/eclipsetimer/wear/MainActivity.kt`

Exit criteria:

- [x] `./gradlew :wear:assembleDebug` passes.
- [x] On real watch/emulator, location permission prompt appears and live-location payloads reach phone. *(verified in emulator)*

### PR 2: Phone Live Compute + Live Payload Publisher

Status: Implemented in code (2026-02-24), watch visual verification pending

Scope:

- [x] Parse watch live-location payload in phone bridge.
- [x] Compute eclipse-active-now using current UTC + watch coordinates.
- [x] Publish `LiveRenderPayloadV1` on `/wear/live/render/v1`:
  - [x] sun always implied
  - [x] moon only when active now (`showMoon=true`)
- [x] Fallback to safe sun-only payload on compute errors.

Exit criteria:

- [x] With mock watch location input, phone emits expected live payloads for active/inactive cases.
- [ ] With real watch location input, phone emits expected live payloads for active/inactive cases.

### PR 3: Watch Live Renderer (Sun/Moon)

Status: Implemented in code (2026-02-24), hardware visual verification pending

Scope:

- [x] Replace text placeholder with live renderer surface.
- [x] Always render centered sun.
- [x] Render moon overlay only when `showMoon=true` from live payload.
- [x] Handle stale/invalid payload safely (sun-only fallback).

Exit criteria:

- [ ] Live mode visual behavior matches AC-001/AC-002/AC-003 on paired phone+watch hardware.

### PR 4: Phone Preview Route Sync

Status: Implemented in code (2026-02-24), emulator verified; additional hardware verification pending

Scope:

- [x] Detect phone preview screen open/close state in navigator.
- [x] Publish preview payload only while preview route is active.
- [x] Clear/disable preview payload immediately on preview exit.

Exit criteria:

- [x] Watch preview availability is strictly tied to phone preview route state on paired emulator/hardware.

### PR 5: Watch Preview Mode + Rotary Scrub

Status: Implemented in code (2026-02-24), emulator validation complete; hardware rotary verification pending

Scope:

- [x] Enter preview mode only when preview payload is available.
- [x] Implement rotary input mapping to normalized progress `[0,1]`.
- [x] Re-render preview moon geometry while scrubbing.
- [x] Auto-exit preview mode when phone preview payload disappears.
- [x] Return to live render automatically.
- [x] Send scrub progress back to phone via `/wear/preview/scrub/v1`.
- [x] Keep phone/watch preview geometry aligned so identical progress renders identical frame.

Exit criteria:

- [ ] AC-004/AC-005/AC-006 pass on crown/bezel devices.

### PR 6: Reliability + QA Hardening

Status: Implemented in code (2026-02-24), hardware manual QA pending

Scope:

- [x] Add logs for mode switches, payload updates, permission and connectivity failures.
- [x] Final payload validation/version checks and stale timeout behavior.
- [x] Optimize preview scrub transport (latest-only coalescing + node-id caching).
- [x] Resolve preview scrub drift by using shared contact-anchor + travel-vector motion model across phone/watch.
- [ ] Complete manual test matrix and regression checks. *(automated regression checks pass; remaining work is hardware manual matrix completion)*

Exit criteria:

- [ ] AC-007 and full manual checklist pass reliably.

## 2. Scope Guardrails (Do Not Expand During MVP)

- [ ] No watch-side eclipse picker.
- [ ] No watch-side map.
- [ ] No watch-side alarm/notification controls.
- [ ] No watch complications/widgets.
- [ ] No haptics feature work.
- [ ] No watchOS implementation work in this plan.

## 3. Assumptions

- [ ] Companion model only: Android phone + Wear OS watch.
- [ ] Phone remains compute source-of-truth for eclipse-active-now.
- [ ] Watch provides its own GPS coordinates to phone.
- [ ] New watch Gradle module will be named `wear` (adjust commands if module name differs).

## 4. Phase Plan

### Phase 0: Project Setup and Architecture Wiring

Goal: establish native watch module and communication skeleton before feature logic.

Checklist:

- [x] Add Wear OS module under `apps/mobile/android` (expected path: `apps/mobile/android/wear`).
- [x] Confirm package/signing compatibility between `app` and `wear` modules.
- [x] Add Data Layer dependencies in phone and watch Gradle configs.
- [x] Add minimal watch app launcher screen (placeholder sun-only).
- [x] Add phone-side native bridge entry point for Data Layer (Kotlin).
- [x] Define Data Layer paths:
  - [x] `/wear/live/location/v1`
  - [x] `/wear/live/render/v1`
  - [x] `/wear/preview/render/v1`
  - [x] `/wear/preview/scrub/v1` (optional forward sync)

Phase 0 implementation notes (2026-02-21):

- Added `wear` module scaffold and launcher UI (`apps/mobile/android/wear/...`).
- Added phone-side Kotlin Data Layer bridge + RN native module (`apps/mobile/android/app/src/main/java/com/lallimaven/eclipsetimer/wearable/...`).
- Added Data Layer dependency to phone app module (`com.google.android.gms:play-services-wearable:19.0.0`).
- Added TypeScript wrapper bridge entry point (`apps/mobile/src/services/wearDataLayerBridge.ts`).
- Implemented test-handshake wiring (watch sends test payload on launch, phone acks back on live-render path).

Exit criteria:

- [x] Phone/watch test-message exchange is implemented in code paths.
- [x] Phone and watch can exchange a small test message on paired emulator/hardware.

### Phase 1: Shared Contracts and Validation

Goal: codify payload contracts once and reuse everywhere.

Files:

- `packages/shared/src/wearable.ts` (new)
- `packages/shared/src/index.ts`
- `packages/shared/tests/wearable.payload.test.ts` (new)

Checklist:

- [x] Define `LiveRenderPayloadV1`.
- [x] Define `PreviewRenderPayloadV1`.
- [x] Define discriminated union `WearRenderPayloadV1`.
- [x] Add lightweight runtime guards/sanitizers for payload parse/clamp.
- [x] Export new types from `packages/shared/src/index.ts`.
- [x] Add tests for:
  - [x] mode discrimination (`live` vs `preview`)
  - [x] numeric clamp behavior (`[0,1]` where required)
  - [x] invalid payload rejection/fallback


Phase 1 implementation notes (2026-02-21):

- Added shared wearable payload contracts and union types in `packages/shared/src/wearable.ts`.
- Added runtime sanitizers for live/preview payload parsing, including numeric clamps for normalized fields.
- Exported wearable contracts from shared package entrypoint (`packages/shared/src/index.ts`).
- Added payload unit tests for mode discrimination, clamp behavior, and invalid payload rejection (`packages/shared/tests/wearable.payload.test.ts`).
- Update (2026-02-24): phone-side live/preview publishers now consume shared wearable contracts; watch remains native Kotlin with runtime validation.

Exit criteria:

- [x] Phone-side wearable publishers compile against shared payload types. *(Watch remains native Kotlin with runtime validation.)*
- [x] Payload tests pass.

### Phase 2: Phone Live Compute Pipeline

Goal: compute and publish live render state from watch GPS.

Files:

- `apps/mobile/src/services/wearLiveCompute.ts` (new)
- `apps/mobile/src/services/wearSync.ts` (new)
- `apps/mobile/src/navigation/RootNavigator.tsx`
- Android native bridge files under `apps/mobile/android/app/src/main/java/...` (new/updated)

Checklist:

- [x] Receive watch location updates on phone. *(implemented via Data Layer subscription in PR 2)*
- [x] Implement eclipse-active-now evaluator:
  - [x] compute `Circumstances` for candidate eclipse(s) near now
  - [x] active if `c1Utc <= now <= c4Utc` with valid times
- [x] Build `LiveRenderPayloadV1`:
  - [x] `showMoon=false` when inactive or invalid compute
  - [x] `showMoon=true` + normalized moon geometry when active
- [x] Publish live payload on every meaningful watch location update.
- [x] Add rate limiting/debounce to avoid excessive compute churn.
- [x] Add fallback logic: publish sun-only payload when compute fails.

Exit criteria:

- [x] With mock watch location updates, phone emits expected live payloads for active/inactive cases.

### Phase 3: Phone Preview Publisher

Goal: publish preview payload only while phone preview screen is open.

Files:

- `apps/mobile/src/services/wearPreviewPublisher.ts` (new)
- `apps/mobile/src/services/wearSync.ts`
- `apps/mobile/src/navigation/RootNavigator.tsx`
- `apps/mobile/src/screens/EclipsePreviewScreen.tsx` (read-only reference unless extraction needed)

Checklist:

- [x] Detect preview route active/inactive in navigator state.
- [x] On preview enter:
  - [x] construct `PreviewRenderPayloadV1` from current preview context
  - [x] publish payload to watch
- [x] On preview updates (if payload fields change), republish.
- [x] On preview exit:
  - [x] send preview-unavailable state (or clear preview payload path)
- [x] Enforce strict gating:
  - [x] no preview payload when preview screen is not open

Exit criteria:

- [x] Watch can only enter preview mode when phone preview route is active.

### Phase 4: Watch Live Mode (GPS + Renderer)

Goal: deliver baseline user value (Live Now mode).

Files (watch module):

- `apps/mobile/android/wear/src/main/...` renderer/activity/service files

Checklist:

- [x] Request and handle watch location permission. *(watch-side implemented in PR 1)*
- [x] Acquire initial GPS fix and periodic updates. *(watch-side implemented in PR 1)*
- [x] Send location payload to phone via Data Layer. *(watch-side implemented in PR 1)*
- [x] Implement render surface:
  - [x] sun always centered
  - [x] minimal corona
  - [x] moon drawn only when `showMoon=true`
- [x] Implement disconnected behavior:
  - [x] use last valid payload briefly
  - [x] revert to sun-only when stale timeout reached
- [x] Ensure no-crash behavior for invalid/missing payloads.

Exit criteria:

- [ ] AC-001 and AC-002 from requirements are satisfied on real watch hardware.

### Phase 5: Watch Preview Mode + Rotary Scrub

Goal: add conditional preview mode with rotary scrubbing.

Files (watch module):

- preview mode state/controller files
- rotary input handler in Compose UI

Checklist:

- [x] Enter preview mode only when preview payload exists.
- [x] Implement rotary input handling:
  - [x] map delta -> progress update
  - [x] clamp progress to `[0,1]`
  - [x] tune configurable sensitivity
- [x] Re-render moon overlay from scrubbed progress.
- [x] Ignore rotary input outside preview mode.
- [x] Exit preview mode automatically when preview payload disappears.
- [x] (Optional) send scrub progress back to phone via `/wear/preview/scrub/v1`.
- [x] Keep scrubbed frame alignment consistent between phone and watch motion models.

Exit criteria:

- [ ] AC-004, AC-005, AC-006 are satisfied on crown and bezel test devices.

### Phase 6: Reliability, Logging, and Polish

Goal: prevent regressions and make failures diagnosable.

Checklist:

- [x] Add structured logs for:
  - [x] payload publish/receive
  - [x] mode switches (`live`/`preview`)
  - [x] location permission denial
  - [x] stale payload fallback
- [x] Add payload version checks and safe downgrade behavior.
- [x] Validate render clamps for all geometry values.
- [x] Add stale timeout constants and document their values.
- [x] Confirm app never blocks on unavailable phone connectivity.

Exit criteria:

- [ ] AC-007 is consistently satisfied in fault-injection tests.

### Phase 7: Testing and Verification

Goal: satisfy functional acceptance criteria and prevent regressions.

Automated checklist:

- [x] Add phone unit tests for active eclipse detection logic.
- [x] Add phone unit tests for live payload construction and sanitization.
- [x] Add shared tests for payload guards.
- [x] Keep existing repo tests passing.

Manual QA checklist (real devices):

- [ ] GPS allowed + no eclipse now => sun-only.
- [ ] GPS allowed + eclipse active now => moon overlay appears and updates.
- [x] Open phone preview => watch preview mode available quickly. *(verified in emulator)*
- [x] Rotary scrub changes preview progress smoothly. *(verified in emulator)*
- [x] Close phone preview => watch exits preview mode. *(verified in emulator)*
- [ ] Deny location permission => watch still renders sun-only safely.
- [ ] Disconnect phone => graceful stale fallback then sun-only.

Exit criteria:

- [ ] All acceptance criteria (AC-001 through AC-007) verified.

## 5. Commands and Quality Gates

Run from repo root unless noted.

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm test`
- [ ] Android compile smoke check from `apps/mobile/android`:
  - [ ] `./gradlew :app:assembleDebug`
  - [x] `./gradlew :wear:assembleDebug` (or replace `wear` with actual module name)

Phase 0 checks run (2026-02-21):

- [x] `pnpm --filter @eclipse-timer/mobile typecheck`
- [x] `pnpm --filter @eclipse-timer/mobile lint`
- [x] `./gradlew :wear:assembleDebug` (from `apps/mobile/android`)

Phase 1 checks run (2026-02-21):

- [x] `pnpm --filter @eclipse-timer/shared test`
- [x] `pnpm --filter @eclipse-timer/shared typecheck`
- [x] `./gradlew :app:compileDebugKotlin :app:processDebugManifest` (from `apps/mobile/android`)
- [ ] `./gradlew :app:assembleDebug` is currently blocked by existing external CMake/prefab errors in `react-native-screens` / `expo-modules-core`.

Phase 2 checks run (2026-02-24):

- [x] `pnpm --filter @eclipse-timer/mobile typecheck`
- [x] `pnpm --filter @eclipse-timer/mobile lint`
- [x] `pnpm --filter @eclipse-timer/mobile test`
- [x] `./gradlew :app:compileDebugKotlin :app:processDebugManifest` (from `apps/mobile/android`)

Phase 3 checks run (2026-02-24):

- [x] `./gradlew :wear:assembleDebug` (from `apps/mobile/android`)

Phase 4 checks run (2026-02-24):

- [x] `pnpm --filter @eclipse-timer/mobile typecheck`
- [x] `pnpm --filter @eclipse-timer/mobile lint`
- [x] `pnpm --filter @eclipse-timer/mobile test`
- [x] `./gradlew :app:compileDebugKotlin :app:processDebugManifest` (from `apps/mobile/android`)

Phase 5 checks run (2026-02-24):

- [x] `./gradlew :wear:assembleDebug` (from `apps/mobile/android`)

Phase 5/6 incremental checks run (2026-02-24):

- [x] `pnpm --filter @eclipse-timer/shared test -- tests/wearable.payload.test.ts`
- [x] `pnpm --filter @eclipse-timer/mobile test -- tests/wear-preview-payload.test.ts tests/wear-preview-scrub-sync.test.ts tests/wear-live-compute.test.ts`
- [x] `pnpm --filter @eclipse-timer/mobile typecheck`
- [x] `./gradlew :app:compileDebugKotlin :wear:assembleDebug` (from `apps/mobile/android`)

Phase 6 hardening checks run (2026-02-24):

- [x] `pnpm typecheck`
- [x] `pnpm lint`
- [x] `pnpm test`
- [x] `./gradlew :app:compileDebugKotlin :wear:assembleDebug` (from `apps/mobile/android`)

CI/Pipeline gap (Wear OS):

- [x] Add explicit Wear build step in GitHub Actions (`eas build --profile production-wear --platform android --local`).
- [x] Define release pipeline strategy for Wear artifact packaging/distribution and add corresponding workflow validation.
- [x] Include Wear APK as a GitHub release asset.
- [x] Upload Wear APK to Google Play in the same internal-track release edit as the phone AAB.
- [x] Keep store submission target unchanged to internal testing track only.

## 6. Definition of Done

- [ ] Live mode implemented and verified on watch hardware.
- [x] Preview mode implemented with rotary scrub and strict phone-preview gating. *(emulator-validated)*
- [ ] No scope creep beyond MVP non-goals.
- [x] Automated tests added for critical logic and passing.
- [ ] Manual QA checklist completed.
- [x] Docs updated for behavior and test scenarios:
  - [x] `documents/reference/testing-scenarios.md`
  - [x] `documents/low-level/mobile-app-internals.md` (mobile wear integration behavior documented)

## 7. Suggested Execution Order (Small Team)

1. Phase 0 + Phase 1
2. Phase 2 + Phase 4 (live mode end-to-end)
3. Phase 3 + Phase 5 (preview mode end-to-end)
4. Phase 6 + Phase 7 (hardening and release readiness)
