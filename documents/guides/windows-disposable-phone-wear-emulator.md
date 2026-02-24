# Windows Disposable Emulator Workflow (Phone + Wear OS)

Use this when Android native builds fail in your normal workspace because of long Windows paths.

This guide runs everything from a disposable copy at `C:\e`, then removes it at the end.

## Prerequisites

- Android Studio with:
  - Android Emulator
  - A phone AVD
  - A Wear OS AVD
- Node + pnpm available in PowerShell
- Source repo available at `C:\dev\apps\eclipse-timer`

## 0) Add more emulator profiles (phone and Wear)

Use Android Studio `Device Manager` to create more virtual devices.

1. Open Android Studio.
2. Go to `Tools` -> `Device Manager`.
3. Click `+` -> `Create Virtual Device`.

### Wear examples

- In `Device Manager`, switch to the `Wear OS` tab when choosing hardware.
- Good options:
  - `Pixel Watch` family profiles
  - `Pixel Watch 2` or `Pixel Watch 3` if available in your Android Studio version
- Choose a `Google APIs` system image (x86_64), preferably a recent API level.
- Name the AVD clearly, for example:
  - `Wear_Pixel_Watch_3_API_35`

### Phone examples

- In `Device Manager`, use a standard phone profile (for example `Pixel 8 Pro`) or create a custom profile.
- For a Samsung Galaxy S25 Ultra-like test device, create a custom hardware profile with approximate specs:
  - Name: `Galaxy_S25_Ultra_Approx_API_36`
  - Screen size: `6.9"`
  - Resolution: `1440 x 3120`
  - RAM/Storage: use practical emulator values supported by your machine
- Then pick a `Google APIs` system image and finish creation.

Notes:
- Stock Android Emulator does not emulate Samsung One UI behavior exactly.
- Use a real Samsung device for vendor-specific UI behavior and OEM features.
- You can list all created AVDs with:

```powershell
$env:ANDROID_SDK_ROOT="$env:LOCALAPPDATA\Android\Sdk"
$emu="$env:ANDROID_SDK_ROOT\emulator\emulator.exe"
& $emu -list-avds
```

## 1) Create a disposable copy at `C:\e`

Run in PowerShell:

```powershell
$src = "C:\dev\apps\eclipse-timer"
$dst = "C:\e"

if (Test-Path $dst) {
  Remove-Item $dst -Recurse -Force
}

New-Item -ItemType Directory -Path $dst | Out-Null

# Copy working files but skip heavy/generated folders.
robocopy $src $dst /E `
  /XD .git node_modules apps\mobile\android\build apps\mobile\android\.cxx apps\mobile\.expo

# Robocopy uses non-zero success codes. 0-7 are success.
if ($LASTEXITCODE -gt 7) {
  throw "robocopy failed with exit code $LASTEXITCODE"
}
```

## 2) Install dependencies in the disposable copy

```powershell
Set-Location C:\e

# Avoid deeply nested pnpm paths on Windows native Android builds.
"node-linker=hoisted" | Set-Content .npmrc

pnpm install --force
```

## 3) Start phone emulator (Terminal A)

```powershell
$env:ANDROID_SDK_ROOT="$env:LOCALAPPDATA\Android\Sdk"
$emu="$env:ANDROID_SDK_ROOT\emulator\emulator.exe"

& $emu -list-avds
& $emu -avd "Medium_Phone_API_36.1" -no-snapshot-load
```

Replace the sample AVD name with your exact name from `-list-avds`.

Keep this terminal open while the emulator runs.

## 4) Start Wear emulator (Terminal B)

```powershell
$env:ANDROID_SDK_ROOT="$env:LOCALAPPDATA\Android\Sdk"
$emu="$env:ANDROID_SDK_ROOT\emulator\emulator.exe"

& $emu -list-avds
& $emu -avd "Wear_OS_XL_Round" -no-snapshot-load
```

Replace the sample AVD name with your exact name from `-list-avds`.

Keep this terminal open while the emulator runs.

## 5) Capture emulator serials (Terminal C)

```powershell
$env:ANDROID_SDK_ROOT="$env:LOCALAPPDATA\Android\Sdk"
$adb="$env:ANDROID_SDK_ROOT\platform-tools\adb.exe"

& $adb devices -l
```

Set variables from the output, for example:

```powershell
$phone = "emulator-5554"
$watch = "emulator-5556"
```

## 6) Build and run phone app from `C:\e` (Terminal C)

```powershell
Set-Location C:\e

# Clear mismatched signatures if needed.
& $adb -s $phone uninstall com.lallimaven.eclipsetimer 2>$null

pnpm -C apps/mobile android
```

`pnpm -C apps/mobile android` stays running because Metro stays attached. That is expected.

## 7) Build and install Wear app (Terminal D)

```powershell
$phone = "emulator-5554"
$watch = "emulator-5556"
$env:ANDROID_SDK_ROOT="$env:LOCALAPPDATA\Android\Sdk"
$adb="$env:ANDROID_SDK_ROOT\platform-tools\adb.exe"

Set-Location C:\e\apps\mobile\android
.\gradlew.bat :wear:assembleDebug

# Clear mismatched signatures if needed.
& $adb -s $watch uninstall com.lallimaven.eclipsetimer 2>$null

& $adb -s $watch install -r wear\build\outputs\apk\debug\wear-debug.apk
& $adb -s $watch shell am start -n com.lallimaven.eclipsetimer/com.lallimaven.eclipsetimer.wear.MainActivity
```

## 8) Pair phone and watch emulators in Android Studio

Use Android Studio's Wear OS pairing assistant.

1. Ensure both emulators are running and fully booted.
2. Open Android Studio -> `Tools` -> `Device Manager`.
3. On either device row (phone or watch), click the overflow menu (`...`) and choose `Pair Wearable`.
4. In the pairing assistant, select the matching device and click `Next`.
5. Wait while Android Studio prepares both emulators.
6. If prompted on the phone emulator, install/open the `Wear OS by Google` app from Play Store and complete setup prompts.
7. In the phone's Wear OS app, open the overflow menu and tap `Pair with emulator`.
8. Accept pairing/association prompts that appear on phone/watch.
9. Confirm pairing succeeded:
   - Device Manager shows paired-device indicators.
   - The watch and phone remain listed as paired after relaunch.

Recommended AVD compatibility for pairing assistant:
- Phone emulator: Android 11 (API 30) or newer, with Google Play image.
- Wear emulator: API 28 or newer.

## 9) Optional phone-watch bridge check

Reopen the watch app and verify status progresses from waiting text to a phone reply.

## Troubleshooting: `pnpm -C apps/mobile android` installs to Wear

If both phone and watch emulators are running, Expo may choose the wrong device unless you specify one.

Use explicit device targeting for the phone app:

```powershell
$env:ANDROID_SDK_ROOT="$env:LOCALAPPDATA\Android\Sdk"
$adb="$env:ANDROID_SDK_ROOT\platform-tools\adb.exe"

& $adb devices -l
# Example phone serial:
$phone = "emulator-5554"

pnpm -C apps/mobile android -- --device $phone
```

If `ANDROID_SERIAL` is set to a watch serial, clear it:

```powershell
Remove-Item Env:ANDROID_SERIAL -ErrorAction SilentlyContinue
```

If you want to force phone targeting for the current terminal session:

```powershell
$env:ANDROID_SERIAL = "emulator-5554"
pnpm -C apps/mobile android
```

Use this only for phone app runs. Clear/reset it before running watch-specific `adb -s <watch-serial> ...` commands.

## Troubleshooting: `react-native-screens:configureCMakeDebug[...]` fails with missing `prefab_command.bat`

If the error shows a `CreateProcess error=2` with a stale path under `C:\dev\apps\eclipse-timer\...`,
your disposable copy at `C:\e` is using an outdated React Native autolinking cache.

Regenerate autolinking from `C:\e`:

```powershell
Set-Location C:\e\apps\mobile\android
cmd /c del /f /q build\generated\autolinking\autolinking.json
.\gradlew.bat :app:generateAutolinkingPackageList
pnpm -C C:\e\apps\mobile android
```

If it still fails once, clear build outputs and retry:

```powershell
cmd /c rmdir /s /q C:\e\apps\mobile\android\build
cmd /c rmdir /s /q C:\e\node_modules\react-native-screens\android\build
pnpm -C C:\e\apps\mobile android
```

## 10) Cleanup and remove `C:\e`

After testing:

```powershell
$env:ANDROID_SDK_ROOT="$env:LOCALAPPDATA\Android\Sdk"
$adb="$env:ANDROID_SDK_ROOT\platform-tools\adb.exe"

# Stop Metro/Expo terminal first (Ctrl+C), then stop emulators.
& $adb -s $phone emu kill
& $adb -s $watch emu kill

Set-Location C:\dev\apps\eclipse-timer
Remove-Item C:\e -Recurse -Force
```

Any edits made inside `C:\e` are discarded by design.
