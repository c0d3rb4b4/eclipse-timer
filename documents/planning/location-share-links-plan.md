# Location Share Links Plan

Last updated: 2026-02-27  
Status: Proposed

## 1. Goal

Add support for incoming shared map links so that:

1. A shared Google Maps or Apple Maps link is accepted by the app.
2. The app opens to `Timer`.
3. The timer map pin is set to the shared location coordinates.

## 2. Current Baseline

1. `apps/mobile/src/navigation/RootNavigator.tsx` already handles incoming URLs through `Linking` (`addEventListener("url")` + `getInitialURL()`).
2. Current custom URL handling only supports featured-eclipse deep links (`eclipsetimer://eclipse/...`).
3. `apps/mobile/src/hooks/useTimerState.ts` already exposes `jumpTo(lat, lon, delta, elevM?)` and `setStatusMessage(...)`, which are sufficient for applying a shared location from JS.
4. Android currently declares `VIEW` deep links for `eclipsetimer://` only. There is no `SEND` share-target intent filter.
5. iOS config currently has no share-extension setup.

## 3. Scope and Non-Goals

In scope (MVP):

1. Accept one shared URL payload from Google Maps or Apple Maps.
2. Extract latitude/longitude from supported URL patterns.
3. Navigate to `Timer` and move the map pin.
4. Keep behavior safe for cold start, warm start, and foreground app states.
5. Add parser-focused tests and manual verification steps.

Out of scope (MVP):

1. Importing full place metadata (name, address, photos, ratings).
2. Adding geocoding lookups for links without coordinates.
3. Supporting non-Apple/non-Google map providers.
4. Multi-link payloads or batch imports.

## 4. Product Behavior

### 4.1 Success path

1. User taps `Share` in Google Maps or Apple Maps and chooses Eclipse Timer.
2. Eclipse Timer opens to `Timer`.
3. Pin jumps to extracted coordinates with zoom delta `2`.
4. Status message shows `Location loaded from shared map link`.

### 4.2 No active eclipse selected

1. Location is still applied to the map.
2. Existing timer behavior remains: user can select an eclipse and compute afterward.

### 4.3 Unsupported/invalid payload

1. App does not crash.
2. Payload is ignored.
3. Existing deep-link behavior remains unchanged.

## 5. Supported URL Patterns (MVP)

Allow only trusted hosts + known coordinate fields.

### 5.1 Host allowlist

1. `maps.apple.com`
2. `maps.google.com`
3. `www.google.com` (maps paths only)
4. `google.com` (maps paths only)
5. `maps.app.goo.gl` (short links, if redirect expansion succeeds)

### 5.2 Coordinate extraction priority

1. Query params:
   - `ll=lat,lon`
   - `q=lat,lon`
   - `query=lat,lon`
   - `center=lat,lon`
   - `destination=lat,lon`
2. Google path token:
   - `@lat,lon` from paths like `/maps/place/.../@37.334,-122.009,15z`
3. If none of the above produce valid coordinates, reject payload.

### 5.3 Validation rules

1. `lat` and `lon` must both parse as finite numbers.
2. Normalize with existing map helpers:
   - `sanitizeLatitude(...)`
   - `normalizeLongitude(...)`
3. Reject payload if parsing fails after normalization.

## 6. Technical Design

### 6.1 New shared-link parser module

Add `apps/mobile/src/utils/sharedMapLink.ts`:

1. `extractFirstUrl(input: string): string | null`
2. `isSupportedMapHost(url: URL): boolean`
3. `parseSharedMapCoordinates(url: URL): { lat: number; lon: number } | null`
4. `parseSharedMapLink(input: string): ParsedSharedMapLink | null`
5. Optional: `expandShortMapUrl(url: string): Promise<string>` for `maps.app.goo.gl`

Suggested type:

```ts
export type ParsedSharedMapLink = {
  provider: "google" | "apple";
  lat: number;
  lon: number;
  rawUrl: string;
};
```

Keep this module pure except optional short-link expansion wrapper.

### 6.2 Share-intake abstraction

Add `apps/mobile/src/services/shareIntake.ts` that normalizes two intake sources:

1. Standard URL intake (`Linking` events + initial URL).
2. Share-target payload intake (OS share sheet text/URL payload).

The service should emit a single event type:

```ts
type IncomingExternalLink = { source: "linking" | "share"; value: string };
```

This avoids mixing parsing logic directly into navigator lifecycle code.

### 6.3 Root navigator integration

Update `apps/mobile/src/navigation/RootNavigator.tsx`:

1. Extend incoming URL handling to parse map links after featured-eclipse handling.
2. Add `pendingSharedLocation` state/ref with a unique `id` token.
3. On parsed map link:
   - queue `pendingSharedLocation`
   - close side menu
   - navigate to `Timer`
4. Pass pending payload into `TimerRoute` and clear it after consumption.

Suggested payload shape:

```ts
type PendingSharedLocation = {
  id: string;
  provider: "google" | "apple";
  lat: number;
  lon: number;
  rawUrl: string;
};
```

### 6.4 Timer route consumption

Update `TimerRoute` inside `RootNavigator.tsx`:

1. Watch `pendingSharedLocation.id` changes via `useEffect`.
2. Apply coordinates with `timerState.jumpTo(lat, lon, 2)`.
3. Set status: `Location loaded from shared map link`.
4. Call `onConsumePendingSharedLocation(id)` to avoid repeat application.

This keeps location application near existing timer state APIs and avoids adding unrelated global state.

### 6.5 Platform integration

#### Android

1. Add share-target intake for text/URL payloads (`ACTION_SEND`, `text/plain`) through chosen Expo/RN integration.
2. Ensure singleTask launch mode keeps one app instance behavior.
3. Verify share into cold-started app and warm app.

#### iOS

1. Add share-extension integration via chosen Expo-compatible approach.
2. Ensure share payload reaches JS on cold start and foreground states.

Implementation note: platform integration should be done via a maintained Expo-compatible package/config plugin to avoid hand-maintained native extension code where possible.

## 7. File Touchpoints (Planned)

1. `apps/mobile/src/navigation/RootNavigator.tsx`
2. `apps/mobile/src/utils/sharedMapLink.ts` (new)
3. `apps/mobile/src/services/shareIntake.ts` (new)
4. `apps/mobile/tests/shared-map-link.test.ts` (new)
5. `apps/mobile/tests/share-intake.test.ts` (new, optional if intake service has pure helpers)
6. `apps/mobile/package.json` (share-intake dependency if needed)
7. `apps/mobile/app.json` (share-intake plugin/config if needed)
8. `apps/mobile/android/app/src/main/AndroidManifest.xml` (if plugin does not fully manage manifest entries)

## 8. Delivery Phases

### Phase 1: Parser and unit tests

1. Build `sharedMapLink` parser with deterministic URL coverage.
2. Add unit tests for valid/invalid Google/Apple URLs.

Exit criteria:
1. Parser test suite covers all supported URL patterns and rejects invalid cases.

### Phase 2: Navigator integration

1. Wire parser into existing URL handling pipeline.
2. Queue/apply pending shared location into `TimerRoute`.

Exit criteria:
1. Direct map link opening (where app receives URL) navigates to `Timer` and moves pin.
2. Existing featured-eclipse links still work.

### Phase 3: Share-target integration (platform)

1. Integrate share-intake package/plugin for Android + iOS.
2. Pipe share payloads into the same parser and navigator path.

Exit criteria:
1. Share from Google Maps and Apple Maps opens Eclipse Timer and applies location on both platforms.

### Phase 4: Validation and hardening

1. Manual matrix across cold/warm/foreground states.
2. Validate no crashes on malformed payloads.
3. Validate no regressions in existing deep-link flows.

Exit criteria:
1. Manual matrix passes for Android + iOS.
2. `pnpm --filter @eclipse-timer/mobile test`, `typecheck`, and `lint` pass.

## 9. Test Plan

Automated:

1. `shared-map-link.test.ts`:
   - Apple `ll` parse
   - Google `q` parse
   - Google `@lat,lon` path parse
   - invalid host rejection
   - malformed coordinate rejection
2. `share-intake` helper tests (if service contains pure mappers):
   - linking event normalization
   - share payload normalization
3. Existing tests continue to pass.

Manual:

1. Android:
   - Google Maps share -> Eclipse Timer -> Timer pin moved
   - Apple Maps URL pasted/shared (if installed/browser path) -> same outcome
2. iOS:
   - Apple Maps share -> Eclipse Timer -> Timer pin moved
   - Google Maps share -> Eclipse Timer -> Timer pin moved
3. Cold-start and warm-start flows for both platforms.
4. Unsupported URL share should be ignored without crash.

## 10. Risks and Mitigations

1. Risk: share-intake package compatibility with Expo SDK version.
   - Mitigation: spike package compatibility first and lock package/plugin version before coding parser integration.
2. Risk: short links (`maps.app.goo.gl`) may require network redirect resolution.
   - Mitigation: support explicit-coordinate URLs first; add short-link expansion with timeout fallback.
3. Risk: duplicate processing (initial payload + event listener) on cold start.
   - Mitigation: dedupe using `rawUrl + timestamp window` or processed id cache.

## 11. Assumptions

1. "Accept sharing links" means handling OS share-sheet payloads, not only custom-scheme deep links.
2. MVP is coordinate-based import only.
3. Existing timer behavior for eclipse selection remains unchanged in this feature.
