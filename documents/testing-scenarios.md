# Eclipse Timer - Tester Instructions and Scenarios

Last updated: 2026-02-18
Target app version: 1.0.0

## 1. Access and credentials

- Login required: No
- Test account: Not needed
- Username/password: N/A
- OTP/MFA: N/A
- Backend environment setup for testers: None

All eclipse calculations run on-device. There are no user accounts.

## 2. Test setup

- Platforms: iOS and Android preview builds (`eas build --profile preview`)
- Device type: Physical devices preferred (GPS and notifications are part of scope)
- Required permissions to test key flows:
  - Location (When in Use)
  - Notifications
- Network:
  - Online for NASA GIF preview validation
  - Offline mode should also be tested (preview fallback behavior)

## 3. Areas to focus on

- Eclipse selection and search behavior on the landing screen
- Map pin interactions and auto-recompute behavior
- Result correctness presentation (UTC + local times, countdown, contact list)
- Notification setup and scheduling behavior (including test notification)
- Favorite locations and persistence across app relaunch
- Preview timeline interaction (play/pause/scrub)

## 4. Recommended test scenarios

### TS-01: App launch and landing load

1. Launch the app.
2. Wait for startup loading to complete.
3. Confirm the eclipse list appears.

Expected:
- App reaches the `Eclipse List` screen without crash.
- Search bar and list are visible.
- List contains eclipse records.

### TS-02: Landing search and selection

1. In search, enter `2026 total`.
2. Verify filtered results update.
3. Select `2026-08-12T`.
4. Tap `GO`.

Expected:
- Filter count updates (`x of y`).
- Selected row is highlighted.
- Timer screen opens with selected eclipse ID/date in header subtitle.

### TS-03: Map interaction and auto-compute

1. On Timer, tap a new point on the map.
2. Drag the observer marker to another location.
3. Watch status text and result card.

Expected:
- Status changes to a recompute state and returns to `Computed`.
- Result card updates for the new pin.
- Countdown text updates and continues ticking.

### TS-04: GPS permission and pin from device location

1. Tap the GPS button.
2. Validate rationale dialog appears before OS permission prompt.
3. Test both flows:
   - Deny permission
   - Allow permission

Expected:
- Deny path shows a clear status message.
- Allow path updates pin from last known/current GPS and recomputes.

### TS-05: Overlay and map controls

1. Cycle map type (`Standard -> Satellite -> Hybrid`).
2. Toggle `Eclipse Visible` overlay.
3. Toggle `Central/Totality/Annularity Path` overlay.
4. If computed, toggle `Directions`.

Expected:
- Map type changes each tap.
- Overlay visibility switches On/Off correctly.
- Direction lines/markers appear only when data is available.

### TS-06: Greatest Eclipse jump and favorites from timer

1. Tap `Greatest Eclipse`.
2. Tap `Add to Favorites`.
3. Save with default name.
4. Tap the favorite chip to return to that location.

Expected:
- Pin jumps to greatest eclipse coordinates.
- Favorite is saved and appears as a chip.
- Selecting chip moves pin and recomputes.

### TS-07: Location Settings validation

1. Open side menu -> `Location Settings`.
2. Try adding with empty name.
3. Try invalid coordinates (lat > 90, lon > 180).
4. Add a valid location.
5. Remove the location.

Expected:
- Validation errors appear for invalid input.
- Valid favorite is added and listed.
- Remove deletes it immediately.

### TS-08: Contact alarms and notification entry list

1. Compute a result on Timer.
2. Enable alarm toggles for at least two contacts (for example `C1`, `MAX`).
3. Open side menu -> `Notification Settings`.

Expected:
- Enabled contact alarms appear in `Enabled Event Notifications`.
- Removing an entry from settings clears it.

### TS-09: Notification settings matrix and test alert

1. In `Notification Settings`, toggle:
   - `Eclipse Event Alerts`
   - `Countdown Reminders`
   - `Vibration`
   - `Sound`
   - `Voice (TTS)`
   - `1 Hour Reminder`
   - `10 Minute Reminder`
2. Confirm `Sound` is disabled when `Voice (TTS)` is enabled.
3. Tap `Send Test Notification`.

Expected:
- Toggles persist and reflect dependency rules.
- Test notification schedules successfully when permissions are granted.
- Permission-denied path shows actionable alert text.

### TS-10: Preview screen interaction

1. From Timer result card, tap `Preview`.
2. Use `Play/Pause`.
3. Tap timeline track to seek.
4. Verify phase label and timeline marker behavior.

Expected:
- Playback advances over time.
- Seeking updates displayed local/UTC times.
- C1/C2/MAX/C3/C4 markers align on timeline.

### TS-11: Persistence across relaunch

1. Enable at least one contact alarm.
2. Add at least one favorite location.
3. Change a few notification settings.
4. Fully close and relaunch app.

Expected:
- Favorites, notification settings, and enabled notification entries remain persisted.

### TS-12: Offline NASA preview fallback

1. Disable network connectivity.
2. On landing, select an eclipse and wait for preview area.
3. Re-enable network and tap `Retry` if shown.

Expected:
- Preview failure state is handled gracefully (no crash).
- Retry recovers once network is restored.

## 5. Known issues / limitations to communicate to testers

- No login/account system exists. All data is local to the device.
- NASA GIF preview depends on network connectivity; offline fallback is expected.
- Timer screen does not provide in-place eclipse switching; switch eclipses from `Eclipse List`.
- Address/geocoding search is not implemented; location entry is map/GPS/manual coordinates.
- App is portrait-only.
- Overlay differentiation relies heavily on color; accessibility patterns are limited.
- `Voice (TTS)` is currently foreground-focused behavior.

## 6. Suggested regression set for each build

- TS-02 (selection/search)
- TS-03 (map + auto-compute)
- TS-08 (alarm entry management)
- TS-09 (notification settings + test alert)
- TS-11 (persistence)

