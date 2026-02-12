# Mobile App Internals

## Source File

- `apps/mobile/src/App.tsx`

## Component Role

`App` is a single-screen controller/view that:
- Loads one eclipse record from catalog.
- Manages map/pin/gps interaction.
- Calls engine compute and stores result.
- Renders status and output cards.

## Local Helpers

- `fmtUtc(iso?)`
  - Displays UTC strings without `.000` milliseconds suffix.
- `fmtDur(seconds?)`
  - Converts seconds to `Xm YYs`.
- `nextEventCountdown(circumstances)`
  - Builds event list from C1/C2/MAX/C3/C4.
  - Picks nearest future event and renders live-style countdown text.

## State Model

Key state in `App`:
- `pin`
  - Observer coordinates for engine input and marker.
- `region`
  - Map viewport region.
- `mapType`
  - `"standard" | "satellite" | "hybrid"`.
- `status`
  - User-facing status line for permission, compute, and errors.
- `result`
  - `Circumstances | null`.
- `isComputing`
  - Compute button disabled/loading state.
- `didComputeFlash`
  - Short-lived post-success button label (`Done`).
- `resultFlash` (`Animated.Value`)
  - Drives temporary visual emphasis on results card.

## Map Interaction Handlers

- `cycleMapType()`
  - Rotates map type through standard/satellite/hybrid.
- `jumpTo(lat, lon, delta?)`
  - Updates pin and region and calls `animateToRegion` for immediate viewport update.
- `setPinAndRegion(...)`
  - Updates pin and optionally zoom deltas.
- `movePinKeepZoom(...)`
  - Moves pin without changing zoom.
- `onMapPress(...)`
  - Sets pin from pressed coordinate.
- `onDragEnd(...)`
  - Sets pin from draggable marker final coordinate.

## GPS Flow (`useGps`)

1. Request foreground permission via `expo-location`.
2. Attempt `getLastKnownPositionAsync()` for fast initial pin update.
3. Attempt `getCurrentPositionAsync()` with balanced accuracy.
4. Race current fix against 5-second timeout.
5. Update status text for success, denial, timeout, or exception.

## Compute Flow (`runCompute`)

1. Validate eclipse record exists.
2. Build `Observer` from pin coordinates and `elevM: 0`.
3. Set loading states.
4. Call `computeCircumstances`.
5. On success:
  - Store result.
  - Set status to `Computed`.
  - Run result card animation.
  - Briefly set button label to `Done`.
6. On error:
  - Set `Compute error: ...` status.
  - Clear result.
7. Always clear loading state.

## Rendering Structure

- Header card with title and eclipse metadata.
- Map section with marker and map-type overlay button.
- Control section with GPS/preset/compute buttons.
- Status row.
- Scrollable results:
  - Selected pin card.
  - Results card with visibility/kind/magnitude/duration/contacts/countdown/debug.

## Current MVP Assumptions

- Uses only the first eclipse in catalog (`catalog[0]`).
- No explicit memoization of computed results by location.
- Result list is informational and does not persist across app relaunches.
