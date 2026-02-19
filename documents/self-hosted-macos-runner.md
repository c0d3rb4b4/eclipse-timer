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

If you use automated submit:

1. Make sure EAS submit credentials are already configured for Apple and Google Play.
2. Keep `submit` job gated by the `production` environment approval in GitHub.

## 6. Workflow behavior after this change

- `.github/workflows/ci.yml`: runs typecheck/lint/test on self-hosted macOS runner.
- `.github/workflows/eas-build.yml`:
  - Runs CI checks on self-hosted macOS.
  - Builds locally with:
    - `eas build --local --platform ios`
    - `eas build --local --platform android`
  - Uploads local artifacts (`ios.ipa`, `android.aab`) to the workflow run.
  - Optional submit job sends those artifacts using `eas submit --path ...`.

Trigger conditions:

1. `ci.yml` runs only on:
   - push to `main`
   - pull request targeting `main`
2. `eas-build.yml` runs on:
   - every push to `main`
   - manual `workflow_dispatch`

## 7. First validation run

1. In GitHub Actions, run `Self-Hosted Mobile Build & Submit`.
2. Inputs:
   - `platform: ios` first, then `android`.
   - `submit: false`.
3. Confirm build artifacts are attached to the run.
4. Then run once with `submit: true` when store credentials are confirmed.

## 8. Common issues

1. Runner never picked:
   - Check runner is online.
   - Check labels include `self-hosted`, `macOS`, and `eclipse-timer`.
   - Check runner group permissions include this repository.
   - If `svc.sh` mode fails on headless macOS, run with `nohup ./run.sh ...`.
2. iOS signing failures:
   - Re-check distribution cert/profile setup in your EAS credentials.
3. Android signing failures:
   - Re-check keystore credentials in EAS credentials.
4. Missing Maps key:
   - Ensure `GOOGLE_MAPS_ANDROID_API_KEY` is present in repository secrets.
