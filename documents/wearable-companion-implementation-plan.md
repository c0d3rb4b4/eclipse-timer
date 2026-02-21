# Wearable Companion Implementation Plan (Concrete Checklist)

Last updated: 2026-02-21  
Status: In Progress (Phases 0-1 implemented; hardware verification pending)

## 1. Purpose

Translate these inputs into an executable implementation checklist:

- `documents/high-level/wearable-companion-requirements.md`
- `documents/low-level/wearable-companion-technical-design.md`

This plan is intentionally strict to MVP scope:

- Live mode: watch GPS + sun always + moon only when eclipse is active now.
- Preview mode: available only while phone preview is open, scrubbed by watch rotary input.
- No other watch features.

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
- [ ] Phone and watch can exchange a small test message on paired hardware (manual verification pending).

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
- Gap captured: phone/watch runtime code does not consume these shared contract helpers yet (planned in Phase 2+ integration work).

Exit criteria:

- [ ] Phone and watch code compile against shared payload types. *(Gap: adoption is pending in app/wear modules.)*
- [x] Payload tests pass.

### Phase 2: Phone Live Compute Pipeline

Goal: compute and publish live render state from watch GPS.

Files:

- `apps/mobile/src/services/wearLiveCompute.ts` (new)
- `apps/mobile/src/services/wearSync.ts` (new)
- `apps/mobile/src/navigation/RootNavigator.tsx`
- Android native bridge files under `apps/mobile/android/app/src/main/java/...` (new/updated)

Checklist:

- [ ] Receive watch location updates on phone.
- [ ] Implement eclipse-active-now evaluator:
  - [ ] compute `Circumstances` for candidate eclipse(s) near now
  - [ ] active if `c1Utc <= now <= c4Utc` with valid times
- [ ] Build `LiveRenderPayloadV1`:
  - [ ] `showMoon=false` when inactive or invalid compute
  - [ ] `showMoon=true` + normalized moon geometry when active
- [ ] Publish live payload on every meaningful watch location update.
- [ ] Add rate limiting/debounce to avoid excessive compute churn.
- [ ] Add fallback logic: publish sun-only payload when compute fails.

Exit criteria:

- [ ] With mock watch location updates, phone emits expected live payloads for active/inactive cases.

### Phase 3: Phone Preview Publisher

Goal: publish preview payload only while phone preview screen is open.

Files:

- `apps/mobile/src/services/wearPreviewPublisher.ts` (new)
- `apps/mobile/src/services/wearSync.ts`
- `apps/mobile/src/navigation/RootNavigator.tsx`
- `apps/mobile/src/screens/EclipsePreviewScreen.tsx` (read-only reference unless extraction needed)

Checklist:

- [ ] Detect preview route active/inactive in navigator state.
- [ ] On preview enter:
  - [ ] construct `PreviewRenderPayloadV1` from current preview context
  - [ ] publish payload to watch
- [ ] On preview updates (if payload fields change), republish.
- [ ] On preview exit:
  - [ ] send preview-unavailable state (or clear preview payload path)
- [ ] Enforce strict gating:
  - [ ] no preview payload when preview screen is not open

Exit criteria:

- [ ] Watch can only enter preview mode when phone preview route is active.

### Phase 4: Watch Live Mode (GPS + Renderer)

Goal: deliver baseline user value (Live Now mode).

Files (watch module):

- `apps/mobile/android/wear/src/main/...` renderer/activity/service files

Checklist:

- [ ] Request and handle watch location permission.
- [ ] Acquire initial GPS fix and periodic updates.
- [ ] Send location payload to phone via Data Layer.
- [ ] Implement render surface:
  - [ ] sun always centered
  - [ ] minimal corona
  - [ ] moon drawn only when `showMoon=true`
- [ ] Implement disconnected behavior:
  - [ ] use last valid payload briefly
  - [ ] revert to sun-only when stale timeout reached
- [ ] Ensure no-crash behavior for invalid/missing payloads.

Exit criteria:

- [ ] AC-001 and AC-002 from requirements are satisfied on real watch hardware.

### Phase 5: Watch Preview Mode + Rotary Scrub

Goal: add conditional preview mode with rotary scrubbing.

Files (watch module):

- preview mode state/controller files
- rotary input handler in Compose UI

Checklist:

- [ ] Enter preview mode only when preview payload exists.
- [ ] Implement rotary input handling:
  - [ ] map delta -> progress update
  - [ ] clamp progress to `[0,1]`
  - [ ] tune configurable sensitivity
- [ ] Re-render moon overlay from scrubbed progress.
- [ ] Ignore rotary input outside preview mode.
- [ ] Exit preview mode automatically when preview payload disappears.
- [ ] (Optional) send scrub progress back to phone via `/wear/preview/scrub/v1`.

Exit criteria:

- [ ] AC-004, AC-005, AC-006 are satisfied on crown and bezel test devices.

### Phase 6: Reliability, Logging, and Polish

Goal: prevent regressions and make failures diagnosable.

Checklist:

- [ ] Add structured logs for:
  - [ ] payload publish/receive
  - [ ] mode switches (`live`/`preview`)
  - [ ] location permission denial
  - [ ] stale payload fallback
- [ ] Add payload version checks and safe downgrade behavior.
- [ ] Validate render clamps for all geometry values.
- [ ] Add stale timeout constants and document their values.
- [ ] Confirm app never blocks on unavailable phone connectivity.

Exit criteria:

- [ ] AC-007 is consistently satisfied in fault-injection tests.

### Phase 7: Testing and Verification

Goal: satisfy functional acceptance criteria and prevent regressions.

Automated checklist:

- [ ] Add phone unit tests for active eclipse detection logic.
- [ ] Add phone unit tests for live payload construction and sanitization.
- [ ] Add shared tests for payload guards.
- [ ] Keep existing repo tests passing.

Manual QA checklist (real devices):

- [ ] GPS allowed + no eclipse now => sun-only.
- [ ] GPS allowed + eclipse active now => moon overlay appears and updates.
- [ ] Open phone preview => watch preview mode available quickly.
- [ ] Rotary scrub changes preview progress smoothly.
- [ ] Close phone preview => watch exits preview mode.
- [ ] Deny location permission => watch still renders sun-only safely.
- [ ] Disconnect phone => graceful stale fallback then sun-only.

Exit criteria:

- [ ] All acceptance criteria (AC-001 through AC-007) verified.

## 5. Commands and Quality Gates

Run from repo root unless noted.

- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] Android compile smoke check from `apps/mobile/android`:
  - [ ] `./gradlew :app:assembleDebug`
  - [ ] `./gradlew :wear:assembleDebug` (or replace `wear` with actual module name)

Phase 0 checks run (2026-02-21):

- [x] `pnpm --filter @eclipse-timer/mobile typecheck`
- [x] `pnpm --filter @eclipse-timer/mobile lint`
- [x] `./gradlew :wear:assembleDebug` (from `apps/mobile/android`)

Phase 1 checks run (2026-02-21):

- [x] `pnpm --filter @eclipse-timer/shared test`
- [x] `pnpm --filter @eclipse-timer/shared typecheck`
- [x] `./gradlew :app:compileDebugKotlin :app:processDebugManifest` (from `apps/mobile/android`)
- [ ] `./gradlew :app:assembleDebug` is currently blocked by existing external CMake/prefab errors in `react-native-screens` / `expo-modules-core`.

CI/Pipeline gap (Wear OS):

- [x] Add explicit Wear build step in GitHub Actions (`eas build --profile production-wear --platform android --local`).
- [x] Define release pipeline strategy for Wear artifact packaging/distribution and add corresponding workflow validation.
- [x] Include Wear APK as a GitHub release asset.
- [x] Upload Wear APK to Google Play in the same internal-track release edit as the phone AAB.
- [x] Keep store submission target unchanged to internal testing track only.

## 6. Definition of Done

- [ ] Live mode implemented and verified on watch hardware.
- [ ] Preview mode implemented with rotary scrub and strict phone-preview gating.
- [ ] No scope creep beyond MVP non-goals.
- [ ] Automated tests added for critical logic and passing.
- [ ] Manual QA checklist completed.
- [ ] Docs updated for behavior and test scenarios:
  - [ ] `documents/testing-scenarios.md`
  - [ ] `documents/low-level/mobile-app-internals.md` (only if mobile integration behavior changes materially)

## 7. Suggested Execution Order (Small Team)

1. Phase 0 + Phase 1
2. Phase 2 + Phase 4 (live mode end-to-end)
3. Phase 3 + Phase 5 (preview mode end-to-end)
4. Phase 6 + Phase 7 (hardening and release readiness)
