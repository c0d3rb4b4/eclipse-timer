# User Flow And Product Behavior

## Product Intent (MVP)

The app answers one question for a chosen point on Earth:
"For this eclipse record, what contact times and eclipse type occur at this location?"

## Main Screen Behavior

Single-screen workflow in `apps/mobile/src/App.tsx`:
- Header with app title and selected eclipse ID/date.
- Interactive map with draggable observer marker.
- Control buttons for GPS and quick presets.
- `Compute` button to execute the eclipse engine.
- Results cards showing location, computed circumstances, and optional debug JSON.

## Location Selection Paths

- Map press sets the observer pin while preserving zoom.
- Marker drag end updates the pin.
- `Use GPS`:
  - Requests foreground permission.
  - Tries last known position first for quick feedback.
  - Then races current position against a 5-second timeout.
- Presets:
  - `Gibraltar`
  - `Central 10:00` (predefined coordinates)

## Compute Interaction

- Button enters loading state (`Computing...`) while engine runs.
- On success:
  - Status updates to `Computed`.
  - Result card flashes briefly.
  - Button briefly shows `Done`.
- On failure:
  - Status text shows `Compute error: ...`
  - Previous result is cleared.

## Result Presentation

- Visibility: `true/false`
- Eclipse kind at location: `none | partial | total | annular`
- Magnitude and totality/annularity duration (if available)
- Contact times (C1/C2/MAX/C3/C4) in UTC ISO format
- Dynamic countdown to the next upcoming contact
- Debug block when `_debug` exists

## Known Product Limits

- Only first catalog eclipse is used.
- UI is optimized for MVP correctness and inspectability, not final design polish.
- No persisted history, offline caching, or multi-eclipse picker yet.
