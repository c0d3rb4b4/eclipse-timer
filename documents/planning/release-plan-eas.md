# Eclipse Timer — Release Plan (Post v1.0.0)

> Scope: all releases after the first manual Android launch.
> Goal: use local/self-hosted build, submit, and OTA updates with a repeatable checklist.

---

## Current Baseline

- First public Android release is manual.
- Current mobile version source is `apps/mobile/package.json` (currently `1.1.40`).
- EAS project ID: `a29a7662-96be-4509-a79e-fbe4b5dac1ff`.
- Build profile for stores: `production` in `apps/mobile/eas.json` (`autoIncrement: true`).
- Runtime policy: `version` and `runtimeVersion` are derived in `apps/mobile/app.config.ts` from `apps/mobile/package.json`.
- GitHub workflow path for builds is self-hosted macOS (`.github/workflows/eas-build.yml`).
- Store submit job runs automatically only when `apps/mobile/package.json` semver is greater than the latest `vX.Y.Z` tag.

---

## Release Types

1. **Store binary release** (`eas build --local` + direct store upload): use when native code/config changes, SDK upgrades, permission changes, or store-required updates are included.
2. **OTA JavaScript/content release** (`eas update`): use when only JS/TS/assets change and no native/runtime-version change is required.

---

## Prerequisites (One-Time)

- `EXPO_TOKEN` is available for CI and local CLI login is valid (`eas whoami`).
- Self-hosted macOS runner is online with labels `self-hosted`, `macOS`, `eclipse-timer`.
- GitHub Actions secrets for store upload are configured:
  - `APPSTORE_ISSUER_ID`
  - `APPSTORE_API_KEY_ID`
  - `APPSTORE_API_PRIVATE_KEY`
  - `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- Optional GitHub Actions secret for EAS Submit fallback:
  - `EXPO_APPLE_ID` (only needed if you use Option C below for iOS submits)
- Where to get each secret (quick paths):
  - `EXPO_TOKEN`: Expo -> `Account Settings -> Access Tokens`.
  - `EXPO_APPLE_ID`: Apple ID email used for App Store Connect access (only for EAS Submit fallback).
  - `GOOGLE_MAPS_ANDROID_API_KEY`: Google Cloud -> `APIs & Services -> Credentials -> API key` (restrict to Android app package/SHA-1 and Maps SDK for Android API).
  - `APPSTORE_ISSUER_ID` / `APPSTORE_API_KEY_ID` / `APPSTORE_API_PRIVATE_KEY`: App Store Connect -> `Users and Access -> Integrations -> App Store Connect API` (Team API key; paste full `.p8` contents for private key).
  - `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`: Play Console -> `Setup -> API access` (link GCP project/service account) + Google Cloud service account JSON key.
- Detailed acquisition steps for every secret are documented in `documents/planning/self-hosted-macos-runner.md` under `## 5. Repo secrets needed`.
- GitHub Release publishing uses workflow `GITHUB_TOKEN` (`contents: write` permission configured in `.github/workflows/eas-build.yml`).
  - You do not create this token manually. GitHub injects it automatically for every workflow run.
  - In workflows it is available as `${{ secrets.GITHUB_TOKEN }}` (or `github.token` context).
  - If release creation fails with permission errors, check: `Settings -> Actions -> General -> Workflow permissions` and allow write access for the repository/organization policy.
  - Only use a PAT secret if org policy prevents write-capable `GITHUB_TOKEN`.
- Store listing metadata is kept current in:
  - `documents/reference/store-metadata.md`
  - `documents/reference/store-privacy-declarations.md`
- Required checks pass locally: `pnpm typecheck`, `pnpm lint`, `pnpm test`.

---

## Standard Store Release Flow

### 1) Prepare release content

- Update `CHANGELOG.md` with the new version section.
- Draft release notes from changelog (same structure as `What's New`).
- Confirm screenshots/feature graphic only if UI changed materially.

### 2) Versioning

- Bump `apps/mobile/package.json` -> `version` (for example: `1.1.41`).
- Do not set `expo.version` or `expo.runtimeVersion` in `apps/mobile/app.json`; both are derived from package version in `apps/mobile/app.config.ts`.
- Release workflow enforcement (`submit` job):
  - Version must be valid `x.y.z`.
  - `apps/mobile/app.json` must not define `expo.version` or `expo.runtimeVersion`.
  - New version must be greater than the latest Git tag in `vX.Y.Z` format.
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
pnpm -C apps/mobile exec eas build --profile production --platform ios --local --non-interactive
pnpm -C apps/mobile exec eas build --profile production --platform android --local --non-interactive
pnpm -C apps/mobile exec eas build --profile production-apk --platform android --local --non-interactive
pnpm -C apps/mobile exec eas build --profile production-wear --platform android --local --non-interactive
pnpm -C apps/mobile exec eas build --profile production-wear-apk --platform android --local --non-interactive
```

Android-only:

```bash
pnpm -C apps/mobile exec eas build --profile production --platform android --local --non-interactive
pnpm -C apps/mobile exec eas build --profile production-apk --platform android --local --non-interactive
pnpm -C apps/mobile exec eas build --profile production-wear --platform android --local --non-interactive
pnpm -C apps/mobile exec eas build --profile production-wear-apk --platform android --local --non-interactive
```

### 5) Submit binaries to stores

Option A: via GitHub Actions submit job (default)
- Push release commit to `main` (or run `workflow_dispatch`) after version bump.
- The submit job uploads:
  - iOS `.ipa` to App Store Connect via `apple-actions/upload-testflight-build@v3`
  - Android `.aab` to Google Play via `r0adkll/upload-google-play@v1`
  - Wear OS `.aab` to Google Play internal track (non-blocking; pipeline continues if this upload fails)
- The same job also creates a GitHub Release `vX.Y.Z` and attaches generated artifacts (`ios.ipa`, phone `android.aab` + `android.apk`, wear `wear.aab` + `wear.apk`).

Option B: manual direct upload from local machine
- iOS: upload `.ipa` with Transporter or `xcrun altool`.
- Android: upload `.aab` in Play Console or with Fastlane `supply`.

Option C: EAS Submit (optional fallback)
- Use only if you intentionally prefer EAS submit queue/credentials flow.
- For iOS via CI, pass Apple ID via GitHub Actions secret (`EXPO_APPLE_ID`) instead of committing `appleId` in `eas.json`.
```bash
EXPO_APPLE_ID="$EXPO_APPLE_ID" pnpm -C apps/mobile exec eas submit --platform ios --path /absolute/path/to/ios.ipa
pnpm -C apps/mobile exec eas submit --platform android --path /absolute/path/to/android.aab
```

### 6) Play Console/App Store rollout

- Set release notes from changelog-derived text.
- For Android production, use staged rollout first when risk is medium/high.
- Monitor crash-free users, ANR, and fatal issues before full rollout.

### 7) Preferred automation path (GitHub Actions)

- Use `.github/workflows/eas-build.yml` for repeatable release execution.
- Workflow runs on your self-hosted macOS runner.
- Build job runs on every push to `main` and on `workflow_dispatch`.
- Submit job runs automatically when release gate detects `apps/mobile/package.json` version > latest `vX.Y.Z` tag.
- Use `workflow_dispatch` for dry-run validation; without a version bump, submit is skipped.
- Keep required secrets configured:
  - `EXPO_TOKEN` for build
  - `APPSTORE_ISSUER_ID`, `APPSTORE_API_KEY_ID`, `APPSTORE_API_PRIVATE_KEY` for iOS upload
  - `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` for Android + Wear uploads
- Optional for EAS Submit fallback:
  - `EXPO_APPLE_ID` (iOS only)

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
- [ ] Version updated (`apps/mobile/package.json`)
- [ ] Typecheck/lint/test passed
- [ ] Local build completed
- [ ] Store upload completed (iOS + Android, and Wear where applicable)
- [ ] GitHub Release created with downloadable artifacts
- [ ] Release notes entered in store consoles
- [ ] Rollout started and monitored
- [ ] Post-release verification done on physical Android + iOS devices (and Wear device when applicable)
