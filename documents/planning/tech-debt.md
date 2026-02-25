# Tech Debt Tracker (Current State, Deep Audit)

> Last audited: 2026-02-25
> Scope: `apps/mobile`, `packages/*`, `.github/workflows`, root tooling/docs
> Audit method:
> - code walkthrough across app/engine/catalog/shared + native Android/Wear + workflows/docs
> - local checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`
> - dependency/security checks: `pnpm -r outdated`, `pnpm audit --prod --audit-level=high`
> - docs command validation: ran `pnpm build`, `pnpm dev`, `pnpm test:watch`, `pnpm clean` (all fail at root)
> - markdown link sweep: relative markdown links resolve; drift remains in plain-text path references

---

## 1. Finished (Verified)

### Engineering baseline
- Monorepo checks are green:
  - `pnpm typecheck` passes
  - `pnpm lint` passes
  - `pnpm test` passes
- Vitest is active across workspaces (`18` test files, `85` passing tests observed).
- Biome + Husky + lint-staged baseline is in place.
- Node is pinned via `.nvmrc` (`20`).

### Mobile architecture and behavior
- `App.tsx` is now bootstrap/error-boundary orchestration, not a monolith.
- Navigation/deep-link handling is centralized in `RootNavigator`.
- App preferences are persisted in `AppStateProvider` with AsyncStorage.
- Timer compute loop, contact timeline, alarm toggles, and preview route are implemented.
- Observer altitude is propagated into compute (`Observer.elevM`).

### Wear companion implementation
- Phone-side Data Layer bridge and listener service are implemented.
- Live flow exists: watch location -> phone compute -> watch payload render.
- Preview payload + two-way scrub sync are implemented.
- Native Wear renderer supports both live and preview with totality blending.
- Wear-specific regression tests exist and pass.

### Catalog/engine
- Engine has strong math/time/geo/circumstance regression coverage.
- Catalog scripts have integration tests for generated artifact sanity.
- Overlay decade chunking + lazy hydration are implemented.

### CI/CD and release automation
- PR CI runs typecheck/lint/test.
- `eas-build.yml` performs iOS/Android/Wear local artifact build and semver-based release gating.
- Screenshot workflows exist for iOS simulator, Android emulator, and Wear emulator.
- Wear listener manifest migration away from deprecated `BIND_LISTENER` is complete (`MESSAGE_RECEIVED` + path filter).

---

## 2. Add (Missing Capabilities)

These are not implemented yet and would add net-new capability.

| ID | Priority | Gap | Why it matters | Suggested addition |
|---|---|---|---|---|
| ADD-01 | High | No React Native UI/component test layer | Screen-level regressions are still mostly manual | Add React Native Testing Library smoke tests for `Landing`, `Timer`, `NotificationSettings`, `Preview` |
| ADD-02 | High | No E2E device-flow suite | Deep links, permission funnels, and map/watch interactions are not end-to-end verified | Add Detox or Maestro flows for Android + iOS, plus Wear handoff smoke flow |
| ADD-03 | High | No coverage thresholds/reporting | Test count can grow while meaningful coverage drops | Enable coverage in Vitest and enforce per-workspace minimum thresholds |
| ADD-04 | Medium | No runtime schema validation of catalog JSON | Type assertions currently hide runtime payload corruption risks | Add runtime decode/validation for `EclipseRecord` in catalog loader |
| ADD-05 | Medium | No geocoding/address search UX | Location selection is GPS/map only | Add geocoding search field with pin placement |
| ADD-06 | Medium | No share/export of computed eclipse summary | Users cannot share contact timing results | Add share-sheet + copy/export for contact timeline summary |
| ADD-07 | Medium | No offline-first preview media strategy | NASA GIF fetch remains network dependent | Add local fallback assets/cache policy for preview thumbnails |
| ADD-08 | Medium | No PR native release-smoke step | TS/lint/tests can pass while native release build fails | Add PR smoke gate (`:app:assembleRelease` or EAS local dry-run for changed native/mobile code) |
| ADD-09 | Medium | No dependency maintenance automation | Security and update drift accumulates silently | Add Dependabot/Renovate with grouped Expo/React Native update policy |
| ADD-10 | Medium | No docs command-validity automation | Docs drift is currently manual and recurring | Add docs CI check that validates referenced root scripts and key file paths |

---

## 3. Improve (Existing, Needs Better Quality)

### 3.1 Architecture and code organization

| ID | Priority | Area | Current state | Improvement |
|---|---|---|---|---|
| IMP-01 | High | Mobile module size concentration | Large files remain: `TimerScreen.tsx` (1523), `EclipsePreviewScreen.tsx` (884), `appState.tsx` (716), `RootNavigator.tsx` (623), `NotificationSettingsScreen.tsx` (582), `useTimerState.ts` (525) | Split by feature slices (compute adapter, map overlays, alarm controls, preview renderer, state reducers/selectors) |
| IMP-02 | High | Notifications API usage | `apps/mobile/src/services/notifications.ts` imports from `expo-notifications/build/*` internals | Move to public `expo-notifications` exports to reduce SDK break risk |
| IMP-03 | High | Native/app version consistency | `apps/mobile/android/app/build.gradle` hardcodes `versionCode 3`, `versionName "1.0.0"` while app package is `1.1.27` | Unify version source and remove conflicting hardcoded native values |
| IMP-04 | High | Observability configuration | Sentry values remain placeholders across app/native config (`App.tsx`, `app.json`, `android/sentry.properties`) | Move to env/secret-driven config with startup/build validation and docs |

### 3.2 Data contracts and engine correctness

| ID | Priority | Area | Current state | Improvement |
|---|---|---|---|---|
| IMP-05 | High | Catalog type contract mismatch | Catalog builder emits `kind` as single-letter (`T/A/P/H`) while shared type expects full enum; loader casts JSON to `EclipseRecord[]` | Normalize `kind` in build step and remove unsafe cast-based trust |
| IMP-06 | Medium | Catalog loader portability | `packages/catalog/src/index.ts` uses manual `require()` chunk map inside ESM package | Replace with ESM-safe dynamic import strategy and generated chunk index |
| IMP-07 | Medium | Runtime validation boundary | Engine/catalog boundary assumes valid runtime numbers/dates | Add lightweight validation/guard layer before compute path |
| IMP-08 | Low | Dead/placeholder code | `deltaTSecondsApprox` is placeholder with TODO and no integration; `evalElements` appears unused | Remove unused code or wire it with tests/docs intentionally |
| IMP-09 | Low | Comment correctness | `evalElements` JSDoc still says minutes while function argument is hours | Correct unit language to prevent future math misuse |
| IMP-10 | Low | Solver tunables | Contact solve constants are inlined in compute path | Extract named config with unit rationale and tuning notes |

### 3.3 Security and dependency health

| ID | Priority | Area | Current state | Improvement |
|---|---|---|---|---|
| IMP-11 | High | Dependency vulnerabilities | `pnpm audit --prod --audit-level=high` reports `6` vulnerabilities (`1 critical`, `5 high`), including `fast-xml-parser`, `tar`, `minimatch` chains | Prioritize Expo/RN dependency upgrades and lockfile overrides where safe |
| IMP-12 | High | Mobile dependency freshness | `pnpm -r outdated` shows major lag (Expo `54 -> 55`, React Native `0.81 -> 0.84`, Sentry `7 -> 8`, Vitest `2 -> 4`) | Plan staged upgrade track (SDK-first, then RN ecosystem, then tooling) with release checkpoints |
| IMP-13 | Medium | Deprecated Gradle/SDK surface | Build logs show Gradle 9 deprecation warnings and Expo property deprecation in `android/gradle.properties` (`expo.edgeToEdgeEnabled`) | Remove deprecated flags and keep Gradle/plugin surface compatible with next SDK |

### 3.4 Platform and release workflow quality

| ID | Priority | Area | Current state | Improvement |
|---|---|---|---|---|
| IMP-14 | High | Release signing safety (phone app) | `apps/mobile/android/app/build.gradle` release buildType still signs with debug config | Enforce real release signing config and fail hard when absent |
| IMP-15 | Medium | Wear Play upload pipeline | `eas-build.yml` still has TODO-commented Wear Play upload steps | Finalize Wear package submission path and re-enable upload stages |
| IMP-16 | Medium | iOS privacy manifest hygiene | `apps/mobile/app.json` has duplicated `NSPrivacyAccessedAPITypes`/`NSPrivacyCollectedDataTypes` entries (2->1 unique, 4->2 unique) | Deduplicate to single authoritative declaration per type |
| IMP-17 | Medium | Android manifest permissions | App manifest still declares `READ/WRITE_EXTERNAL_STORAGE` | Remove unnecessary legacy permissions for current target SDK behavior |
| IMP-18 | Medium | Workflow maintainability | Screenshot workflows are very large and heavily duplicated across iOS/Android/Wear | Extract reusable workflow/composite actions to reduce drift and review overhead |
| IMP-19 | Low | CI build resource tuning | Recent Android build logs show daemon metaspace exhaustion/restart warning | Tune Gradle JVM/metaspace settings for stable release build performance |

### 3.5 Tooling/documentation/config drift

| ID | Priority | Area | Current state | Improvement |
|---|---|---|---|---|
| IMP-20 | High | Documentation command drift | Multiple docs still instruct non-existent root scripts (`pnpm dev`, `pnpm build`, `pnpm test:watch`, `pnpm clean`) and these commands fail when executed | Update docs to current script surface and add docs command validation check |
| IMP-21 | Medium | Documentation path drift | Plain-text references still point to moved paths (for example root `README.md` references `documents/self-hosted-macos-runner.md`; release plan references old store docs paths) | Update stale paths to `documents/planning/*` and `documents/reference/*` |
| IMP-22 | Medium | Duplicate config sources | Root `app.json`/`eas.json` and `apps/mobile` config diverge (including bundle ID/CLI profile details) | Define single source of truth and deprecate duplicates |
| IMP-23 | Medium | Changelog source-of-truth drift | Both root `CHANGELOG.md` and `documents/reference/CHANGELOG.md` exist with divergent content/version history | Consolidate to one authoritative changelog location and update cross-links |
| IMP-24 | Low | Environment/tooling enforcement | `packageManager` is pinned, but no strict `engines`/Corepack enforcement gate | Add `engines` and optional install-time guard script |
| IMP-25 | Low | Editor consistency | No `.editorconfig` present | Add minimal `.editorconfig` aligned with Biome defaults |
| IMP-26 | Low | Dependency cleanup | `packages/engine` still includes `ts-node` in devDependencies without active usage | Remove unused dev dependency if no longer required |
| IMP-27 | Low | Test gating semantics | Global Vitest config uses `passWithNoTests: true`, allowing empty-scope test passes | Tighten policy or scope this behavior to explicit packages only |

---

## 4. Suggested Execution Order

### Phase A: Release and security correctness
1. IMP-11 dependency vulnerabilities
2. IMP-14 phone release signing safety
3. IMP-02 Expo notifications private imports
4. IMP-03 native/app version consistency
5. IMP-04 Sentry production config wiring
6. IMP-16 iOS privacy manifest dedupe
7. IMP-17 Android permission cleanup

### Phase B: Drift and maintainability
1. IMP-20 docs command drift
2. IMP-21 docs path drift
3. IMP-22 config source-of-truth cleanup
4. IMP-23 changelog source-of-truth cleanup
5. IMP-18 workflow deduplication
6. IMP-13 deprecated Gradle/SDK surface

### Phase C: Architecture and data contract hardening
1. IMP-01 module decomposition (`TimerScreen`, `useTimerState` first)
2. IMP-05 catalog kind normalization + cast removal
3. IMP-06 ESM-safe overlay chunk loader
4. IMP-07 runtime payload validation

### Phase D: Capability expansion
1. ADD-01 RN component/screen test layer
2. ADD-02 E2E suite
3. ADD-03 coverage thresholds
4. ADD-08 PR native release smoke
5. ADD-09 dependency automation
6. ADD-10 docs validation automation

---

## 5. Audit Notes

- Local baseline checks pass on 2026-02-25: `typecheck`, `lint`, `test`.
- Dependency audit on 2026-02-25 reports `6` production vulnerabilities (`1 critical`, `5 high`) in current tree.
- Outdated scan on 2026-02-25 shows significant major-version lag in Expo/React Native/tooling.
- Root script validation confirms `pnpm build`, `pnpm dev`, `pnpm test:watch`, and `pnpm clean` currently fail.
- Markdown link targets are mostly intact; remaining path drift is primarily in plain-text path references and duplicated docs sources.
