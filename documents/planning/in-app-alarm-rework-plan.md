# In-App Alarm Rework Plan (No Native Clock Export)

Last updated: 2026-02-27  
Status: Implemented in code; focused physical-device QA and final cleanup pending

## 1. Goal

Use a hybrid model:
- background local notifications for eclipse-level reminders (`T-1h`, `T-10m`)
- foreground in-app alarms for fast, second-level event countdown guidance (`a1`, `a2`)

## 1.1 Current Implementation Snapshot (2026-02-27)

Implemented:
1. `Notification Settings` rename to `Notification/Alarm Settings`.
2. Persisted `a1`/`a2` settings with range checks and `a2 < a1` validation.
3. Per-eclipse master toggle (`Enable alarms and reminders for this eclipse`) with per-event toggle preservation.
4. Foreground in-app alarm engine (`a1` phrase, `a2` countdown, terminal event phrase).
5. Fixed per-eclipse background reminders (`T-1h`, `T-10m`) anchored to first valid contact.
6. Automated regression coverage for alarm timing, in-app engine behavior, and reminder scheduling.

Still pending:
1. Full physical-device manual verification pass for the matrix in `## 10. Test Strategy`.
2. Final notification-layer hardening called out in tracker items (for example private `expo-notifications/build/*` import cleanup).

## 2. Requested Behavior

1. Per-eclipse alarm enable/disable toggle.
2. Per-event alarm toggles (C1, C2, MAX, C3, C4) for each eclipse.
3. No export to native phone clock/alarm apps.
4. If per-eclipse alarm toggle is enabled, pre-event notifications are sent once per eclipse:
   - `-1 hour` notification (enable/disable only).
   - `-10 minute` notification (enable/disable only).
   - Both reminders are anchored to the eclipse's first event time (earliest contact with a valid timestamp).
   - Timing for these two reminders is fixed and not user-configurable.
   - These reminders are background notifications and should be delivered even if the app is not open.
5. If a per-event alarm is enabled:
   - `a1` seconds before event: TTS says `"<a1> seconds to <Event>"`.
   - `a2` seconds before event: TTS countdown starts (`"5.. 4.. 3.. 2.. 1.. We're at <Event>"` by default).
   - These are in-app alarms and require the app to be running in foreground.
6. `a1` and `a2` are user-configurable from `Notification/Alarm Settings` (new name).
7. Existing notification mock timeline behavior must continue to work.
   - In mock mode, eclipse-level reminders and per-event alarms should still fire according to enabled toggles.
   - Required example: if `C1 IN (MIN)` is `11`, the `T-10m` reminder should fire in `10` minutes, and all 5 event alarms (C1, C2, MAX, C3, C4) should trigger if enabled.

## 3. Scope and Non-Goals

In scope:
- Data model and UI for per-eclipse + per-event alarm preferences.
- In-app foreground alarm engine for precise `a1` and `a2` voice prompts.
- Fixed lead-time background notifications at `-1 hour` and `-10 minutes`, once per eclipse.
- Preserve current mock timeline mode and make it compatible with the hybrid reminder/alarm model.
- Settings rename from `Notification Settings` to `Notification/Alarm Settings`.
- Migration from existing notification preferences.

Out of scope:
- Native clock/alarm export.
- Per-event second-level alarms while app is backgrounded or terminated.
- Server push notifications.

## 4. Platform Constraint (Important)

Per-event second-level accuracy is feasible only while the app is running in foreground.  
When app is backgrounded/terminated, OS policies can pause or delay JS timers and TTS delivery.

Eclipse-level reminders (`T-1h`, `T-10m`) use scheduled local notifications and are expected to work with the app closed.

Assumption for this plan:
- Precision countdown use case is during active eclipse observation with app open.

## 5. Proposed UX

### 5.1 Timer Screen

1. Add a master toggle for the active eclipse:
   - Label: `Enable alarms and reminders for this eclipse`.
2. Keep per-event toggles (C1, C2, MAX, C3, C4).
3. If master toggle is OFF:
   - Per-event toggles are visually disabled.
   - Existing per-event selections are preserved (not deleted), but not armed for in-app alarms or eclipse-level reminders.

### 5.2 Notification/Alarm Settings Screen (rename)

1. Rename title and menu entry:
   - `Notification Settings` -> `Notification/Alarm Settings`.
2. Add `Alarm Timing` section:
   - `a1 lead time (seconds)` default `10`.
   - `a2 countdown start (seconds)` default `5`.
3. Keep fixed reminder toggles:
   - `1 Hour Reminder` (on/off only).
   - `10 Minute Reminder` (on/off only).
   - No custom minute values for these reminders.
4. Keep `Mock Contact Timeline` controls and behavior available for test acceleration.
5. Validation:
   - `a1` range: `2..60`.
   - `a2` range: `1..30`.
   - `a2 < a1` required.
6. Add preview copy:
   - Example: `At T-10s: "10 seconds to C1"; at T-5s: "5..4..3..2..1.. We're at C1".`
   - Example: `Also sends one background reminder at T-1h and one at T-10m for the eclipse (based on first event time), even if app is closed.`

## 6. Data Model Changes

Current persisted state uses notification-centric names. Keep migration safe and diff small.

Recommended evolution:

1. Keep existing `notificationEntries` structure for per-event selections (initially).
2. Add per-eclipse master state:
   - `disabledEclipseAlarmIds: string[]` (or `eclipseAlarmEnabledById: Record<string, boolean>`).
3. Extend settings with timing fields:
   - `alarmLeadSecondsA1: number` (default `10`)
   - `alarmCountdownStartSecondsA2: number` (default `5`)
4. Keep fixed reminder boolean flags:
   - `remindOneHourBefore: boolean`
   - `remindTenMinutesBefore: boolean`
5. Continue persisting with one preferences payload; bump storage version if needed.

Migration rules:

1. Existing users keep prior per-event entries.
2. New fields default to `a1=10`, `a2=5`.
3. All eclipses default to master enabled unless explicitly turned off.

## 7. Alarm Engine Design

Create a foreground alarm hook/service (for example `useInAppAlarmEngine`) plus eclipse reminder scheduler that:

1. Resolves the next enabled event from stored selections + current computed contact times.
2. Arms one-shot timers for in-app speech:
   - `a1` announcement (`T - a1`).
   - `a2` countdown start (`T - a2`).
3. Runs second-by-second countdown loop from `a2` to `1`.
4. Speaks final phrase at `T`:
   - `"We're at <Event>"`.
5. Schedules fixed eclipse-level background notifications once per eclipse (not per contact event):
   - `T - 60 minutes` when `1 Hour Reminder` is ON.
   - `T - 10 minutes` when `10 Minute Reminder` is ON.
   - `T` is the first event time for the eclipse (earliest valid contact).
   - These notifications must still fire if the app is closed at delivery time.
6. De-duplicates spoken prompts and reminder notifications with per-event (speech) and per-eclipse (reminder) state keys.
7. Re-arms foreground alarms when:
   - active eclipse changes,
   - contact times change due to pin movement/recompute,
    - toggles/settings change,
    - app returns to foreground.
8. Supports mock timeline as a first-class scheduling mode for both reminders and in-app alarms.
   - Required mock acceptance behavior: with `C1 IN (MIN) = 11`, schedule `T-10m` in 10 minutes and run all 5 event alarms if enabled.

Implementation detail:
- Use `Date.now()` to anchor event time and `setTimeout`/`setInterval` with drift correction each tick.
- Use scheduled local notifications for eclipse-level reminders so delivery does not depend on foreground runtime.

## 8. Minimal File Touchpoints

Primary files expected to change:

1. `apps/mobile/src/state/appState.tsx`
2. `apps/mobile/src/hooks/useTimerState.ts`
3. `apps/mobile/src/screens/TimerScreen.tsx`
4. `apps/mobile/src/screens/NotificationSettingsScreen.tsx`
5. `apps/mobile/src/navigation/SideMenu.tsx`
6. `apps/mobile/src/navigation/RootNavigator.tsx`
7. `apps/mobile/src/App.tsx`

Likely removals/refactors:

1. `apps/mobile/src/hooks/useNotificationScheduler.ts`
2. `apps/mobile/src/services/notifications.ts` (refactor to fixed-reminder-only if retained)

Likely new file:

1. `apps/mobile/src/services/inAppAlarmEngine.ts` (or hook in `apps/mobile/src/hooks`)

## 9. Implementation Phases

### Phase 1: Model + Settings + Rename

1. Add `a1`/`a2` settings fields and validation/clamping.
2. Add per-eclipse master enabled state.
3. Keep `1 hour` and `10 minute` reminder toggles as fixed on/off controls.
4. Rename user-facing labels to `Notification/Alarm Settings`.
5. Keep current behavior otherwise unchanged.

Exit criteria:
- Settings persist correctly.
- UI reflects new naming and fields.

### Phase 2: Foreground Alarm Engine

1. Implement in-app alarm scheduler for `a1`, `a2`, countdown, and final phrase.
2. Implement fixed background reminder scheduling for `T-1h` and `T-10m` as a single pair per eclipse (toggle-driven only).
3. Wire engine/scheduler to active eclipse contact items and user toggles.
4. Preserve and validate mock timeline behavior with the new scheduler/engine.
5. Ensure engine re-arms on recompute/pin change/settings change.

Exit criteria:
- On physical devices, foreground prompts fire in expected order.
- No duplicate speech for same event instance.
- On physical devices, `T-1h`/`T-10m` reminders still deliver with app closed.
- In mock mode, the required `C1 IN (MIN)=11` behavior is verified.

### Phase 3: Remove Notification-First Path

1. Remove only notification paths that are unrelated to fixed `-1h`/`-10m` reminders.
2. Remove test-notification UI and permission-dependent flows that are obsolete.
3. Keep reminder scheduling support required for fixed `-1h`/`-10m` behavior.
4. Keep or adapt vibration/sound toggles only if they are still meaningful in the final alarm/reminder model.

Exit criteria:
- No legacy notification-first flow remains beyond fixed `-1h`/`-10m` reminders.
- Alarm flow is foreground-only in-app for `a1`/`a2` countdown, with single-pair background eclipse reminders toggle-driven.

### Phase 4: Cleanup + Regression Docs

1. Remove dead code/imports.
2. Update `documents/testing-scenarios.md` for alarm-focused validation.
3. Add minimal tests around timing logic and settings validation.

Exit criteria:
- Lint/typecheck/tests pass.
- QA scenarios cover per-eclipse and per-event alarm behavior.

## 10. Test Strategy

Automated:

1. Unit tests for `a1`/`a2` validation and clamping.
2. Alarm engine tests with fake timers:
   - speaks at `T-a1`,
   - starts countdown at `T-a2`,
   - speaks terminal phrase at `T`.
3. Reminder scheduler tests:
   - schedules at `T-1h` only when enabled,
   - schedules at `T-10m` only when enabled,
   - emits only one `T-1h` and one `T-10m` reminder per eclipse even when multiple event alarms are enabled,
   - persists scheduled reminders so delivery does not require app foreground at trigger time.
4. Tests for master eclipse toggle gating both event alarms and fixed reminders.
5. Mock timeline tests:
   - preserves existing mock controls and scheduling mode,
   - verifies required scenario: `C1 IN (MIN)=11` triggers `T-10m` in 10 minutes,
   - verifies all five event alarms fire in mock mode when enabled.

Manual (physical devices):

1. Enable one eclipse, one event, set `a1=10`, `a2=5`, verify spoken order.
2. Change `a1/a2`, verify new behavior without relaunch.
3. Disable eclipse master toggle, verify no prompts.
4. Move map pin (changes contact times), verify engine re-arms to updated times.
5. Enable multiple event alarms for the same eclipse, verify reminders still fire only once at `T-1h` and once at `T-10m` for that eclipse.
6. Schedule reminders, fully close app, verify `T-1h`/`T-10m` reminders still deliver.
7. Enable mock timeline, set `C1 IN (MIN)=11`, verify `T-10m` reminder in 10 minutes and all five event alarms when enabled.

## 11. Acceptance Criteria

1. User can enable/disable alarms per eclipse.
2. User can enable/disable alarms per event.
3. User can configure `a1` and `a2` in `Notification/Alarm Settings`.
4. Foreground behavior for enabled event:
   - `a1` phrase once,
   - countdown from `a2` to `1`,
   - final `"We're at <Event>"` phrase once.
5. Per-event `a1`/`a2` alarms require app foreground runtime.
6. If eclipse master toggle is ON, exactly one `-1h` and one `-10m` background reminder are sent per eclipse (according to on/off flags), based on first event time, including when app is closed.
7. No native clock export flow exists.
8. Existing users migrate without losing existing per-event selections.
9. Mock timeline mode remains functional with the new hybrid model, including the required `C1 IN (MIN)=11` scenario.

## 12. Risks and Mitigations

1. Risk: Per-event second-level precision is not reliable in background/locked state.
   - Mitigation: Clearly label per-event alarms as in-app precision mode (foreground).
2. Risk: Some OS/device battery policies may delay background local notifications in edge cases.
   - Mitigation: Validate on target devices and surface guidance to disable aggressive battery optimization where relevant.
3. Risk: TTS latency can vary by device.
   - Mitigation: Keep message strings short and deterministic; avoid overlapping speech.
4. Risk: Recompute churn can cause duplicate timers.
   - Mitigation: Centralized timer lifecycle with explicit cancel/re-arm on dependency change.
