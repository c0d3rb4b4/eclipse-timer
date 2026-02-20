# Wearable Companion Technical Design (Simplified MVP)

## Document Metadata

- Status: Draft v2 (scope reset)
- Date: 2026-02-20
- Companion product doc: `documents/high-level/wearable-companion-requirements.md`

## 1. Technical Feasibility

Yes, this build is technically feasible now.

Why:

- Watch can read its own GPS using Wear OS location APIs.
- Phone can compute eclipse state at watch coordinates using existing engine.
- Watch can render sun/moon overlay using simple canvas primitives.
- Wear OS supports rotary hardware input events for preview scrubbing.

Main implementation caveat:

- Needs native Android/Wear module(s); this is not a pure Expo-managed feature.

## 2. Final MVP Behavior

Only two runtime modes:

- `live`: default; watch GPS-driven, sun always visible, moon only if eclipse active right now.
- `preview`: available only while phone Preview screen is open; watch scrubs progress with rotary input.

No other watch features are implemented.

## 3. System Architecture (Minimal)

### 3.1 Components

- Watch app (Wear OS):
  - Location collector (watch GPS)
  - Renderer (sun + optional moon)
  - Preview scrub controller (rotary input)
  - Data Layer client
- Phone app (existing React Native app + native bridge/service):
  - Receives watch location
  - Computes eclipse-now state from current UTC and watch coordinates
  - Emits live render payload
  - Emits preview payload only while preview screen is open

### 3.2 Data direction

- Watch -> Phone:
  - watch location updates
  - optional preview scrub updates (only if we want phone preview to mirror watch scrub)
- Phone -> Watch:
  - live render payload (sun-only or sun+moon)
  - preview payload while preview screen is open

## 4. Live Mode Compute Flow

1. Watch gets current location.
2. Watch sends location to phone over Data Layer.
3. Phone selects candidate eclipses near now and computes `Circumstances` for watch location.
4. Phone checks active condition:
  - active if `c1Utc <= nowUtc <= c4Utc` (and both exist).
5. Phone sends minimal payload:
  - `showMoon=false` if inactive.
  - `showMoon=true` with moon geometry if active.
6. Watch renders frame continuously from latest payload.

Fallback:

- If no valid compute result: render sun-only.

## 5. Preview Mode Flow

1. User opens Preview on phone.
2. Phone publishes preview payload to watch and marks preview session active.
3. Watch switches to preview mode.
4. Rotary input adjusts normalized progress `[0..1]`.
5. Watch re-renders moon position based on scrub progress.
6. Phone closes preview -> payload unavailable -> watch exits to live mode.

MVP decision:

- Scrub can be watch-local only.
- Optional later: send scrub progress back to phone to keep both screens synchronized.

## 6. Payload Contracts (MVP)

### 6.1 `LiveRenderPayloadV1`

```ts
type LiveRenderPayloadV1 = {
  version: 1;
  mode: "live";
  generatedAtUtc: string;
  watchLatDeg: number;
  watchLonDeg: number;
  showMoon: boolean;
  moon?: {
    radiusNorm: number;
    centerXNorm: number;
    centerYNorm: number;
  };
};
```

Notes:

- Sun is implicit and always rendered.
- Norm coordinates are relative to watch viewport (`0..1`).

### 6.2 `PreviewRenderPayloadV1`

```ts
type PreviewRenderPayloadV1 = {
  version: 1;
  mode: "preview";
  previewSessionId: string;
  eclipseId: string;
  timelineStartUtc: string;
  timelineEndUtc: string;
  initialProgress: number;
  visual: {
    sunRadiusNorm: number;
    moonRadiusNorm: number;
    moonClosestOffsetNorm: number;
    moonTravelHalfSpanNorm: number;
  };
};
```

## 7. Rendering Rules

### 7.1 Sun rendering

- Always render centered sun.
- Full disk visible on all screens.
- Minimal corona opacity.

### 7.2 Moon rendering

- Render moon only when:
  - mode is preview, or
  - mode is live and `showMoon=true`.
- In live mode, moon geometry comes directly from payload.
- In preview mode, moon geometry is derived from scrubbed progress and preview constants.

## 8. Rotary Input (Wear OS)

- Use Wear-compatible rotary event APIs in Compose.
- Convert delta to progress increment:
  - `progress += delta * sensitivity`
  - clamp to `[0,1]`.
- Ignore rotary events when not in preview mode.

Device variability:

- Crown and bezel devices emit different input granularity; keep sensitivity configurable.

## 9. Sync Protocol (Data Layer)

Proposed paths:

- Watch -> Phone location:
  - `/wear/live/location/v1`
- Phone -> Watch live payload:
  - `/wear/live/render/v1`
- Phone -> Watch preview payload:
  - `/wear/preview/render/v1`
- Optional watch -> phone scrub sync:
  - `/wear/preview/scrub/v1`

Transport:

- DataClient for latest state snapshots.
- MessageClient optional for immediate nudges.

## 10. Error and Fallback Handling

- Location denied:
  - Render sun-only.
  - Do not block app.
- Phone disconnected:
  - Keep last payload briefly.
  - Revert to sun-only if stale timeout exceeded.
- Invalid payload:
  - Drop payload.
  - Keep previous valid state.
- Preview payload disappears:
  - Exit preview mode immediately.

## 11. Minimal File-Level Implementation Plan

Phone additions:

- `apps/mobile/src/services/wearLiveCompute.ts`
- `apps/mobile/src/services/wearSync.ts`
- `apps/mobile/src/services/wearPreviewPublisher.ts`

Shared additions:

- `packages/shared/src/wearable.ts` (payload types only)

Watch native additions (new module):

- location service
- Data Layer sync client
- renderer screen
- preview rotary input handler

## 12. Test Plan

Unit tests (phone):

- active eclipse detection from contact windows
- payload sanitization and clamping

Instrumented/manual watch tests:

- GPS available + no eclipse now -> sun-only
- GPS available + active eclipse now -> moon overlay visible
- open phone preview -> watch preview available
- rotary scrub changes preview position
- close phone preview -> watch returns to live mode
- disconnected phone -> fallback behavior works

## 13. Effort Estimate (Simplified Scope)

- Live mode MVP: 1.5 to 2.5 weeks
- Preview mode + rotary scrub: 1 to 1.5 weeks
- QA hardening: 1 week

Total: about 4 to 5 weeks for one engineer plus device QA.

## 14. References

- Wear OS Data Layer overview: https://developer.android.com/training/wearables/data/overview
- Wear OS Data Layer events: https://developer.android.com/training/wearables/data/events
- Compose for Wear OS: https://developer.android.com/training/wearables/compose
- Compose input/scroll (rotary integration basis): https://developer.android.com/develop/ui/compose/touch-input/pointer-input/scroll
