# Eclipse Timer — Release Plan (Post v1.0.0)

> Scope: all releases after the first manual Android launch.
> Goal: use local/self-hosted build, submit, and OTA updates with a repeatable checklist.

---

## Current Baseline

- First public Android release is manual.
- App version: `1.0.0`.
- EAS project ID: `a29a7662-96be-4509-a79e-fbe4b5dac1ff`.
- Build profile for stores: `production` in `apps/mobile/eas.json` (`autoIncrement: true`).
- Runtime policy: `runtimeVersion` is tied to app version in `apps/mobile/app.json`.
- GitHub workflow path for builds is self-hosted macOS (`.github/workflows/eas-build.yml`).

---

## Release Types

1. **Store binary release** (`eas build` + `eas submit`): use when native code/config changes, SDK upgrades, permission changes, or store-required updates are included.
2. **OTA JavaScript/content release** (`eas update`): use when only JS/TS/assets change and no native/runtime-version change is required.

---

## Prerequisites (One-Time)

- `EXPO_TOKEN` is available for CI and local CLI login is valid (`eas whoami`).
- Self-hosted macOS runner is online with labels `self-hosted`, `macOS`, `eclipse-timer`.
- Google Play service account is configured for submit in `apps/mobile/eas.json` (or provided via EAS credentials).
- Store listing metadata is kept current in:
  - `documents/store-metadata.md`
  - `documents/store-privacy-declarations.md`
- Required checks pass locally: `pnpm typecheck`, `pnpm lint`, `pnpm test`.

---

## Standard Store Release Flow

### 1) Prepare release content

- Update `CHANGELOG.md` with the new version section.
- Draft release notes from changelog (same structure as `What's New`).
- Confirm screenshots/feature graphic only if UI changed materially.

### 2) Versioning

- Bump app version in `apps/mobile/app.json` and `apps/mobile/package.json` (for example: `1.0.1`).
- Keep `android.versionCode` and `ios.buildNumber` managed by EAS `production.autoIncrement` unless a manual override is needed.

### 3) Run quality gates

```bash
pnpm typecheck
pnpm lint
pnpm test
```

### 4) Build production binaries locally

From repo root:

```bash
pnpm -C apps/mobile exec eas build --profile production --platform ios --local
pnpm -C apps/mobile exec eas build --profile production --platform android --local
```

Android-only:

```bash
pnpm -C apps/mobile exec eas build --profile production --platform android --local
```

### 5) Submit via EAS

Submit local artifacts:

```bash
pnpm -C apps/mobile exec eas submit --platform ios --path /absolute/path/to/ios.ipa
pnpm -C apps/mobile exec eas submit --platform android --path /absolute/path/to/android.aab
```

Android-only:

```bash
pnpm -C apps/mobile exec eas submit --platform android --path /absolute/path/to/android.aab
```

### 6) Play Console/App Store rollout

- Set release notes from changelog-derived text.
- For Android production, use staged rollout first when risk is medium/high.
- Monitor crash-free users, ANR, and fatal issues before full rollout.

### 7) Preferred automation path (GitHub Actions)

- Use `.github/workflows/eas-build.yml` for repeatable release execution.
- Workflow runs on your self-hosted macOS runner.
- Trigger `workflow_dispatch` with:
  - `platform: android` or `all`
  - `submit: true` when ready to upload automatically after build
- Keep `EXPO_TOKEN` and store credentials configured before using non-interactive submit.

---

## OTA Release Flow (No Native Changes)

Use only when native modules/config do not change and runtime remains compatible.

```bash
pnpm -C apps/mobile exec eas update --branch production --message "vX.Y.Z: short summary"
```

Rules:
- Do not use OTA for permission changes, Expo SDK upgrades, new native libs, or config requiring a rebuild.
- If `runtimeVersion` must change, perform a full store binary release.

---

## Suggested Cadence

1. **Patch releases (`x.y.Z`)**: OTA first when safe; binary only if native fix is required.
2. **Minor releases (`x.Y.0`)**: prefer full binary release for predictable rollout.
3. **Major releases (`X.0.0`)**: full binary release with staged rollout and explicit release checklist signoff.

---

## Rollback / Hotfix

1. If OTA issue: publish a corrective OTA update immediately to `production`.
2. If binary issue in staged rollout: halt rollout in Play Console/App Store Connect.
3. If binary issue after full rollout: prepare hotfix version bump and run standard store release flow.
4. Document incident in `CHANGELOG.md` and internal notes.

---

## Quick Checklist (Per Release)

- [ ] Changelog updated
- [ ] Version updated (`app.json`, `package.json`)
- [ ] Typecheck/lint/test passed
- [ ] Local build completed
- [ ] EAS submit completed
- [ ] Release notes entered in store consoles
- [ ] Rollout started and monitored
- [ ] Post-release verification done on physical Android + iOS devices
