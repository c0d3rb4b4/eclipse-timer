# Self-Hosted macOS Runner Setup (Mac mini)

This project can build both iOS and Android on your own Mac mini using GitHub Actions self-hosted runners.
The updated workflows run on the label set:

- `self-hosted`
- `macOS`
- `eclipse-timer`

Assumption: builds stay local (`eas build --local`) so they do not consume EAS cloud build quota.

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
3. Export SDK vars (for the runner user):
```bash
echo 'export ANDROID_HOME="$HOME/Library/Android/sdk"' >> ~/.zshrc
echo 'export ANDROID_SDK_ROOT="$HOME/Library/Android/sdk"' >> ~/.zshrc
echo 'export PATH="$ANDROID_SDK_ROOT/platform-tools:$ANDROID_SDK_ROOT/cmdline-tools/latest/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

Node and pnpm:

```bash
node -v
corepack enable
pnpm -v
```

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

If your org policy allows it, also set the Mac mini to auto-login and prevent sleep while plugged in for stable CI uptime.

## 4. Repo secrets needed

Set these in `Settings -> Secrets and variables -> Actions`:

1. `EXPO_TOKEN`
2. `GOOGLE_MAPS_ANDROID_API_KEY`

If you use automated submit:

1. Make sure EAS submit credentials are already configured for Apple and Google Play.
2. Keep `submit` job gated by the `production` environment approval in GitHub.

## 5. Workflow behavior after this change

- `.github/workflows/ci.yml`: runs typecheck/lint/test on self-hosted macOS runner.
- `.github/workflows/eas-build.yml`:
  - Runs CI checks on self-hosted macOS.
  - Builds locally with:
    - `eas build --local --platform ios`
    - `eas build --local --platform android`
  - Uploads local artifacts (`ios.ipa`, `android.aab`) to the workflow run.
  - Optional submit job sends those artifacts using `eas submit --path ...`.

## 6. First validation run

1. In GitHub Actions, run `Self-Hosted Mobile Build & Submit`.
2. Inputs:
   - `platform: ios` first, then `android`.
   - `submit: false`.
3. Confirm build artifacts are attached to the run.
4. Then run once with `submit: true` when store credentials are confirmed.

## 7. Common issues

1. Runner never picked:
   - Check runner is online and has label `eclipse-timer`.
2. iOS signing failures:
   - Re-check distribution cert/profile setup in your EAS credentials.
3. Android signing failures:
   - Re-check keystore credentials in EAS credentials.
4. Missing Maps key:
   - Ensure `GOOGLE_MAPS_ANDROID_API_KEY` is present in repository secrets.
