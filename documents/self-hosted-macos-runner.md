# Self-Hosted macOS Runner Setup (Mac mini)

This project can build both iOS and Android on your own Mac mini using GitHub Actions self-hosted runners.
The updated workflows run on the label set:

- `self-hosted`
- `macOS`
- `eclipse-timer`

Assumption: builds stay local (`eas build --local`) so they do not consume EAS cloud build quota.

## 0. Runner requirements from workflow files

The current workflows require this exact label set in `runs-on`:

- `self-hosted`
- `macOS`
- `eclipse-timer`

Where this is used:

- `.github/workflows/ci.yml`
- `.github/workflows/eas-build.yml` (all jobs)

If a workflow is queued and never picked up, first check in GitHub UI:

1. `Settings -> Actions -> Runners`.
2. Open your runner.
3. Confirm labels include all three values above, especially custom label `eclipse-timer`.
4. Confirm the runner group is allowed for this repository.

## 1. One-time machine prerequisites

Run these on the Mac mini:

```bash
xcode-select -p
xcodebuild -version
```

If needed:

1. Install full Xcode.
2. Accept license and first-launch setup:
```bash
sudo xcodebuild -license accept
sudo xcodebuild -runFirstLaunch
```

Android toolchain:

1. Install Android Studio.
2. Install SDK Platform, Build-Tools, Command-line Tools, and Platform Tools.
3. Workflow fallback: `.github/workflows/eas-build.yml` also runs `android-actions/setup-android@v3` and installs `platforms;android-36`, `build-tools;36.0.0`, and `ndk;27.1.12297006` automatically for Android builds.
4. Ensure JDK 17 is available for Gradle:
```bash
brew install temurin@17
/usr/libexec/java_home -V
```
5. Optional for shell profile (if Java is still not detected):
```bash
echo 'export JAVA_HOME=$(/usr/libexec/java_home -v 17)' >> ~/.zshrc
echo 'export PATH="$JAVA_HOME/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```
6. Export SDK vars (for the runner user):
```bash
echo 'export ANDROID_HOME="$HOME/Library/Android/sdk"' >> ~/.zshrc
echo 'export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"' >> ~/.zshrc
echo 'export PATH="$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Keep `apps/mobile/android/local.properties` out of git (machine-specific path). The workflow writes it dynamically for Android builds.

Node and pnpm:

```bash
node -v
npm -v
npm install -g pnpm@9
pnpm -v
```

Notes:

1. Node 25 may not include `corepack` by default.
2. Workflow jobs use Node 20 (`actions/setup-node@v4` with `node-version: 20`), so using Node 20 on the Mac mini keeps behavior closest to CI.

## 2. Create the self-hosted runner

In GitHub:

1. Open `Settings -> Actions -> Runners -> New self-hosted runner`.
2. Choose macOS and copy the generated commands.
3. On the Mac mini, run them in a dedicated folder, for example:

```bash
mkdir -p ~/actions-runner && cd ~/actions-runner
# Paste GitHub-provided download/config commands here.
```

Important while configuring:

1. Runner group: your default or dedicated group.
2. Labels: include `eclipse-timer` (keep default labels too).

## 3. Install runner as a service

From `~/actions-runner`:

```bash
./svc.sh install
./svc.sh start
./svc.sh status
```

Headless caveat:

1. On some headless setups, `svc.sh` (LaunchAgent) may fail to load without an active GUI user session.
2. If that happens, use foreground mode (`./run.sh`) or the background fallback below.

## 4. Headless fallback (works without LaunchAgent)

Start in background (from `~/actions-runner`):

```bash
cd ~/actions-runner
nohup ./run.sh > runner.log 2>&1 &
echo $! > runner.pid
disown
```

Check status/log:

```bash
cd ~/actions-runner
ps -p "$(cat runner.pid)" -o pid,command
tail -n 100 runner.log
```

Stop runner:

```bash
cd ~/actions-runner
if [ -f runner.pid ]; then
  kill "$(cat runner.pid)" || true
  rm -f runner.pid
fi
pkill -f "Runner.Listener run" || true
```

## 5. Repo secrets needed

Set these in `Settings -> Secrets and variables -> Actions`:

1. `EXPO_TOKEN`
2. `GOOGLE_MAPS_ANDROID_API_KEY`
3. `APPSTORE_ISSUER_ID`
4. `APPSTORE_API_KEY_ID`
5. `APPSTORE_API_PRIVATE_KEY` (full `.p8` content)
6. `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` (full JSON content)

### How to get each secret

1. `EXPO_TOKEN`
   - Open Expo account settings: `https://expo.dev/accounts/<your-account>/settings/access-tokens`
   - Create a new access token.
   - Save token value as GitHub secret `EXPO_TOKEN`.
   - Verify token locally: `pnpm -C apps/mobile exec eas whoami`.

2. `GOOGLE_MAPS_ANDROID_API_KEY`
   - In Google Cloud Console, select the project used by the app.
   - Ensure billing is enabled and `Maps SDK for Android` is enabled in `APIs & Services`.
   - Go to `APIs & Services -> Credentials -> Create credentials -> API key`.
   - Restrict the key:
     - Application restriction: `Android apps`
     - Package: `com.lallimaven.eclipsetimer`
     - Certificate fingerprint: your signing SHA-1
     - API restriction: `Maps SDK for Android`
   - Save key value as GitHub secret `GOOGLE_MAPS_ANDROID_API_KEY`.

3. `APPSTORE_ISSUER_ID`, `APPSTORE_API_KEY_ID`, `APPSTORE_API_PRIVATE_KEY`
   - Open App Store Connect: `Users and Access -> Integrations -> App Store Connect API`.
   - Create a Team API key (role with release permissions, typically `Admin` or `App Manager`).
   - Copy:
     - `Issuer ID` -> GitHub secret `APPSTORE_ISSUER_ID`
     - `Key ID` -> GitHub secret `APPSTORE_API_KEY_ID`
   - Download the `.p8` key file (download is one-time).
   - Paste the full file content into GitHub secret `APPSTORE_API_PRIVATE_KEY`, including:
     - `-----BEGIN PRIVATE KEY-----`
     - `-----END PRIVATE KEY-----`

4. `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
   - In Google Play Console: `Setup -> API access`.
   - Link the Play Console to a Google Cloud project.
   - Create/select a service account and grant app permissions for `com.lallimaven.eclipsetimer` (track/release permissions needed for your workflow target).
   - In Google Cloud Console: `IAM & Admin -> Service Accounts -> <service account> -> Keys -> Add key -> Create new key -> JSON`.
   - Copy the full JSON content into GitHub secret `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`.

Notes:

1. `EXPO_TOKEN` is required for local `eas build --local` in CI.
2. Store upload credentials are injected via GitHub secrets; no credential files need to live on the runner filesystem for pipeline submit.
3. Keep `submit` job gated by the `production` environment approval in GitHub.
4. GitHub Release creation uses `GITHUB_TOKEN` with `contents: write` permission (set in `.github/workflows/eas-build.yml`).
   - You do not add `GITHUB_TOKEN` as a repo secret; GitHub provides it automatically per workflow run.
   - It is available as `${{ secrets.GITHUB_TOKEN }}` (or `github.token` context).
   - If release creation fails due to permissions, check `Settings -> Actions -> General -> Workflow permissions`.
   - Use a PAT secret only if org/repo policy disallows write access for `GITHUB_TOKEN`.

## 6. Workflow behavior after this change

- `.github/workflows/ci.yml`: runs typecheck/lint/test on self-hosted macOS runner.
- `.github/workflows/eas-build.yml`:
  - Runs CI checks on self-hosted macOS.
  - Builds locally with:
    - `eas build --local --platform ios`
    - `eas build --local --platform android`
  - Uploads local artifacts (`ios.ipa`, `android.aab`) to the workflow run.
  - Optional submit job uploads:
    - iOS via `apple-actions/upload-testflight-build@v3`
    - Android via `r0adkll/upload-google-play@v1`
  - Submit job also:
    - Enforces release version bump (`apps/mobile/package.json` `version` must be greater than latest `vX.Y.Z` tag)
    - Creates a GitHub Release and attaches uploaded artifacts (`ios.ipa`/`android.aab`)

Trigger conditions:

1. `ci.yml` runs only on:
   - pull request targeting `main`
2. `eas-build.yml` runs on:
   - every push to `main`
   - manual `workflow_dispatch`

## 7. iOS certificate + local build setup (headless)

Use this when iOS local build fails in credential/setup phases.

### A. Create/sync iOS credentials in EAS

From the repo:

```bash
cd apps/mobile
npx -y eas-cli@latest credentials -p ios
```

Recommended menu path:

1. Select profile: `production`.
2. `Build Credentials: Manage everything needed to build your project`.
3. `All: Set up all the required credentials to build your project`.
4. Reuse existing cert only if known good; otherwise remove and recreate cert + provisioning profile.

Optional (for local verification):

1. In credentials menu, download credentials to `credentials.json`.
2. Keep `credentials.json` out of git.

### B. Verify cert import in headless keychain

If `jq` is missing, install it (`brew install jq`) or copy cert path/password manually from `credentials.json`.

```bash
cd apps/mobile

P12_PATH="$(jq -r '.ios.distributionCertificate.path' credentials.json)"
P12_PASS="$(jq -r '.ios.distributionCertificate.password' credentials.json)"
KEYCHAIN="$HOME/eas-debug.keychain-db"
KEYCHAIN_PASS='TempKeychainPass123!'

security delete-keychain "$KEYCHAIN" 2>/dev/null || true
security create-keychain -p "$KEYCHAIN_PASS" "$KEYCHAIN"
security set-keychain-settings -lut 21600 "$KEYCHAIN"
security unlock-keychain -p "$KEYCHAIN_PASS" "$KEYCHAIN"
security import "$P12_PATH" -k "$KEYCHAIN" -P "$P12_PASS" -f pkcs12 -T /usr/bin/codesign -T /usr/bin/security
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASS" "$KEYCHAIN"
security find-identity -v -p codesigning "$KEYCHAIN"
```

Expected output:

- `1 valid identities found` (or more)

If you see `0 valid identities found`, regenerate iOS credentials in EAS and retry.

### C. Ensure Xcode iOS platform is installed

If build logs show `iOS 26.2 is not installed`, run:

```bash
sudo xcode-select -s /Applications/Xcode-26.2.0.app/Contents/Developer
sudo xcodebuild -license accept
sudo xcodebuild -runFirstLaunch
sudo xcodebuild -downloadPlatform iOS
xcodebuild -showsdks | grep -E 'iphoneos|iphonesimulator'
```

### D. Run a manual local iOS build test

```bash
cd apps/mobile
EXPO_NO_KEYCHAIN=1 EXPO_DEBUG=1 EAS_LOCAL_BUILD_SKIP_CLEANUP=1 npx -y eas-cli@latest build --profile production --platform ios --local
```

If this passes, GitHub workflow `eas-build.yml` should pass on the same runner host.

## 8. First validation run

1. In GitHub Actions, run `Self-Hosted Mobile Build & Submit`.
2. Inputs:
   - `platform: ios` first, then `android`.
   - `submit: false`.
3. Confirm build artifacts are attached to the run.
4. Then run once with `submit: true` after all four store-upload secrets are set:
   - `APPSTORE_ISSUER_ID`
   - `APPSTORE_API_KEY_ID`
   - `APPSTORE_API_PRIVATE_KEY`
   - `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
5. Verify a GitHub Release was created with attached mobile artifacts.

## 9. Common issues

1. Runner never picked:
   - Check runner is online.
   - Check labels include `self-hosted`, `macOS`, and `eclipse-timer`.
   - Check runner group permissions include this repository.
   - If `svc.sh` mode fails on headless macOS, run with `nohup ./run.sh ...`.
2. iOS signing failures:
   - Re-check distribution cert/profile setup in your EAS credentials.
   - If cert import succeeds but `find-identity` returns `0 valid identities found`, recreate cert/profile and retest manual keychain import.
3. iOS archive fails with `Unable to find a destination ... iOS <version> is not installed`:
   - Install iOS platform components for the selected Xcode (`xcodebuild -downloadPlatform iOS`).
4. `expo doctor` failed checks during local build:
   - Usually advisory unless followed by a hard build error.
   - Fix app config mismatches (`app.json` vs `app.config.ts`) once signing/build blockers are resolved.
5. Android signing failures:
   - Re-check keystore credentials in EAS credentials.
6. Missing Maps key:
   - Ensure `GOOGLE_MAPS_ANDROID_API_KEY` is present in repository secrets.
7. Android build fails with `Unable to locate a Java Runtime`:
   - Install JDK 17 on the runner (`brew install temurin@17`).
   - Or rely on workflow-managed Java setup (`actions/setup-java@v4`) and rerun.
8. Submit job fails with missing secret:
   - Verify required secrets exist and are available to the selected environment (`production`).
   - For iOS, ensure `APPSTORE_API_PRIVATE_KEY` is the raw `.p8` key content, not a file path.
9. Submit job fails on Google Play permissions:
   - Ensure the service account in `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` has access to app `com.lallimaven.eclipsetimer` and the target track.
10. Submit job fails version enforcement:
   - Bump `apps/mobile/package.json` -> `version` to a higher semver than latest tag.
