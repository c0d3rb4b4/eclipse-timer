# Wearable Companion Requirements (Simplified MVP)

## Document Metadata

- Status: Draft v2 (scope reset)
- Date: 2026-02-20
- Target: Wear OS companion first
- Future: watchOS possible but out of this MVP
- Related app code:
  - `apps/mobile/src/screens/EclipsePreviewScreen.tsx`
  - `apps/mobile/src/navigation/RootNavigator.tsx`
  - `packages/engine/src/circumstances/compute.ts`
  - `packages/shared/src/types.ts`

## 1. Direct Feasibility Answer

Yes, this is possible with the current product stack, with two constraints:

- The Wear OS watch app will be native Android/Wear code (not pure Expo/React Native only).
- For reliable eclipse-now detection, the phone should remain compute source-of-truth in MVP, while watch supplies its own GPS.

## 2. Product Scope (Only What Was Requested)

MVP has only two modes.

### 2.1 Mode A: Live Now (default)

- Watch gets its own GPS location.
- Watch always shows sun centered.
- If an eclipse is happening right now at watch location, draw moon overlay at current phase.
- If no eclipse is happening right now, show sun only.

### 2.2 Mode B: Preview Mode (conditional)

- Preview mode is available only when Preview screen is open on phone.
- Watch can enter preview mode and scrub progress using rotary hardware input (crown/bezel/rotary encoder, depending on device).
- No extra controls beyond scrub.
- When phone preview closes, watch exits preview mode back to Live Now.

## 3. Explicit Non-Goals

- No watch-side eclipse picker.
- No watch-side map.
- No watch-side notification/alarm controls.
- No watch complications/widgets.
- No historical browsing list on watch.
- No haptics feature in MVP.

## 4. Functional Requirements

### 4.1 Live Now mode

- FR-001: On app launch, watch requests location permission and obtains current GPS fix.
- FR-002: Watch sends location updates to phone when:
  - app starts,
  - location changed meaningfully,
  - manual refresh is triggered (internal/debug only).
- FR-003: Phone computes whether eclipse is active at current UTC for watch location.
- FR-004: Phone sends minimal render state:
  - `showMoon` boolean,
  - moon geometry values if `showMoon=true`.
- FR-005: Watch renders:
  - sun always,
  - moon only when `showMoon=true`.

### 4.2 Preview mode

- FR-010: Phone publishes preview payload only while Preview screen is active.
- FR-011: Watch enters preview mode only if preview payload is currently available.
- FR-012: Rotary input changes preview progress on watch.
- FR-013: Progress is clamped to `[0,1]`.
- FR-014: When preview payload becomes unavailable, watch exits preview mode automatically.

### 4.3 Error handling

- FR-020: If watch location permission denied, app still renders sun-only fallback.
- FR-021: If phone not reachable, app renders last known live state if available, else sun-only fallback.
- FR-022: Invalid payload fields must be ignored safely (no crash).

## 5. Visual Requirements

- VR-001: Sun fixed at center.
- VR-002: Full sun must remain visible.
- VR-003: Minimal corona.
- VR-004: Moon overlay style should visually match current preview style (dark disk).
- VR-005: In Live Now mode, moon overlay position corresponds to current UTC time phase, not simulated loop.

## 6. Acceptance Criteria

- AC-001: With valid GPS and no active eclipse now, watch shows sun only.
- AC-002: During an active eclipse window at watch location (between C1 and C4), watch shows moon overlay.
- AC-003: Moon overlay updates over time without user interaction.
- AC-004: Opening Preview on phone makes preview mode available on watch within acceptable sync delay.
- AC-005: Rotary input on watch scrubs preview progress correctly.
- AC-006: Closing Preview on phone exits watch preview mode.
- AC-007: Permission/network/sync failures never crash app; sun-only fallback remains visible.

## 7. Simplified Data Contracts (Product Level)

### 7.1 Live render state

- `mode = "live"`
- `generatedAtUtc`
- `location` (watch lat/lon source metadata)
- `showMoon`
- `moonGeometry` (optional when `showMoon=true`)

### 7.2 Preview render state

- `mode = "preview"`
- `previewSessionId`
- `timelineStartUtc`
- `timelineEndUtc`
- geometry constants matching preview semantics
- initial progress

## 8. Risks and Mitigations

- Risk: Watch cannot compute eclipse-now state independently in MVP.
  - Mitigation: phone computes; watch supplies GPS.
- Risk: intermittent connectivity affects preview availability.
  - Mitigation: preview mode strictly conditional on live preview payload.
- Risk: rotary input behavior varies by OEM hardware.
  - Mitigation: support standard Wear rotary event APIs and test on crown + bezel devices.

## 9. Delivery Plan (Small)

- Phase 1: Live Now mode only (GPS, sun, conditional moon overlay).
- Phase 2: Preview mode gating + rotary scrub.

## 10. References

- Wear OS Data Layer overview: https://developer.android.com/training/wearables/data/overview
- Wear OS Data Layer events: https://developer.android.com/training/wearables/data/events
- Compose for Wear OS: https://developer.android.com/training/wearables/compose
- Rotary input in Compose (Android): https://developer.android.com/develop/ui/compose/touch-input/pointer-input/scroll
