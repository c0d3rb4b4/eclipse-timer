# Photography Guide Page Plan

Last updated: 2026-02-26  
Status: In progress (`Phase 1-3` complete, `Phase 4` partially complete)

## 1. Goal

Add a new `Photography Guide` page that gives users a shot schedule (time + generated preview) and a landscape composite simulation so they can plan eclipse photos from the timer flow.

## 1.1 Current Implementation Status (2026-02-26)

Completed:
1. Timer action row now exposes equal-width `Preview` and `Photo Guide` buttons.
2. New `PhotographyGuide` route is wired from timer with active eclipse + observer context payload.
3. Guide screen computes schedules for `3/5/7/9` on load/change and shows out-of-eclipse disabled state (`Must be within eclipse area`).
4. Schedule table is rendered with shot index, UTC/local times, phase bucket, and generated preview thumbnails.
5. `Show landscape composite` opens a modal rendering a 24mm-style composite with fixed `MAX` anchor, per-shot placement, moon-only occlusion rendering, and clamped-edge indicators.
6. Unit tests exist for distribution logic, invalid visibility state, and landscape composite anchor/clamp behavior.

Pending:
1. Dedicated React Native screen/component tests for Photography Guide UI behavior (falls under `ADD-01` test-layer backlog).
2. Manual verification pass for timer -> photo guide -> schedule -> composite flow on target devices.

## 2. Entry Point and Navigation

1. Timer screen action row becomes two equal-width buttons:
   - Left: `Preview`
   - Right: `Photo Guide`
2. Tapping `Photo Guide` opens a new `Photography Guide` route using the active eclipse and current observer circumstances from `Timer`.
3. The two-button row should reuse the current `Preview` button footprint (same vertical space, split 50/50).

## 3. Page UX Requirements

1. Top control: dropdown `Total pictures` with options `3`, `5`, `7`, `9`.
2. Default value: `5`, auto-calculated immediately on page load.
3. If user changes the dropdown, recalculate immediately.
4. If user is outside eclipse visibility:
   - dropdown is disabled/greyed out
   - show text: `Must be within eclipse area`
   - do not render a schedule table
5. When schedule calculation succeeds, show:
   - table of calculated times
   - generated preview image for each time (same visual model used by timer `MAX View`)
   - button under table: `Show landscape composite`

## 4. Distribution Rules

Given selected `n` in `{3,5,7,9,11}`:

1. `n` is odd and always includes one photo at `MAX`.
2. Let `k = (n - 3) / 2`.
3. Place `k` photos on each side of `MAX`:
   - left interval:
     - total/annular: between `C1 -> C2`
     - partial: between `C1 -> MAX`
   - right interval:
     - total/annular: between `C3 -> C4`
     - partial: between `MAX -> C4`
4. Distribution formula for any interval `[start, end]` with `k` points:
   - point `i` (1-based): `start + (i / (k + 1)) * (end - start)`
5. Add one extra photo before `C1` and one extra photo after `C4`:
   - if the first two scheduled times are `t1 < t2`, pre-`C1` photo is `t1 - (t2 - t1)`
   - if the last two scheduled times are `t(n-1) < tn`, post-`C4` photo is `tn + (tn - t(n-1))`
   - this keeps the outer gap equal to the adjacent inner gap
6. Final table order:
   - pre-`C1` photo
   - left interval times (chronological)
   - `MAX`
   - right interval times (chronological)
   - post-`C4` photo

## 5. Table Content

Each row should include:

1. shot index (`1..n`)
2. UTC time
3. local time
4. phase bucket (`pre-MAX`, `MAX`, `post-MAX`)
5. generated preview thumbnail (same moon/sun geometry rendering approach as timer `MAX View`)

## 6. Landscape Composite Requirements

1. Button label: `Show landscape composite`.
2. Opens a full-width visualization panel/modal.
3. Simulate a `24mm` landscape composition:
   - framing does not depend on horizon position
   - place `MAX` at horizontal center and at the `2/3` vertical point in the frame
4. Place all scheduled sun positions in one frame relative to the fixed `MAX` anchor.
5. Only show moon disk when it occludes sun at that shot time.
6. If a shot falls outside the simulated frame bounds, clamp to edge and flag with subtle indicator.

## 7. Proposed File Touchpoints

1. `apps/mobile/src/screens/TimerScreen.tsx` (split Preview row into two buttons, add `onOpenPhotographyGuide`)
2. `apps/mobile/src/navigation/RootNavigator.tsx` (new route + params wiring)
3. `apps/mobile/src/screens/PhotographyGuideScreen.tsx` (new screen)
4. `apps/mobile/src/utils/photographyGuide.ts` (new distribution and row-building helpers)
5. `apps/mobile/src/utils/previewGeometry.ts` or existing preview helpers (reuse `MAX View` rendering math for row previews)

## 8. Implementation Phases

### Phase 1: Navigation + UI shell (`Complete`)

1. Add `PhotographyGuide` route.
2. Add `Photo Guide` button next to `Preview`.
3. Build new screen shell with dropdown and placeholder states.

Exit criteria:
- Timer screen shows both buttons in equal widths.
- New route opens with active eclipse context.

### Phase 2: Schedule compute + table (`Complete`)

1. Implement distribution helper for total/annular vs partial rules.
2. Auto-compute with default `5` on mount.
3. Recompute on dropdown change.
4. Implement out-of-eclipse disabled state and required message text.
5. Render schedule table and generated preview thumbnails.

Exit criteria:
- All option counts (`3/5/7/9`) produce stable rows with `MAX` centered in order.

### Phase 3: Landscape composite (`Complete`)

1. Add `Show landscape composite` action shown only when table exists.
2. Render 24mm simulation with horizon and all shot placements.
3. Center horizontal framing on `MAX`.

Exit criteria:
- Composite matches schedule count and placement logic.

### Phase 4: Tests and regression checks (`Partially complete`)

1. Unit tests for distribution logic (total/annular and partial). (`Complete`)
2. Unit tests for invalid visibility state. (`Complete`)
3. Unit tests for landscape composite anchor/clamp behavior. (`Complete`)
4. Screen tests for:
   - default `5` computed on entry
   - recalc on dropdown change
   - disabled dropdown + info text when out of eclipse area
   Status: `Pending`
5. Manual verification on timer -> guide -> preview/composite flow.
   Status: `Pending`

## 9. Assumptions

1. `Show landscape composite)` in request is treated as label `Show landscape composite` (without trailing `)`).
2. “Evenly distributed between” means interior sample points (excluding interval endpoints) via `i/(k+1)`.
3. Annular eclipses follow the same interval strategy as total (`C1->C2` and `C3->C4`).
