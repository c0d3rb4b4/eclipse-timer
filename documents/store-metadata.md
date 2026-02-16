# App Store & Play Store — Metadata & Assets

> Reference document for App Store Connect and Google Play Console listing.
> Keep in sync with actual app features.

---

## App Name

**Eclipse Timer**

---

## Short Description (≤80 characters)

```
Precise eclipse contact times and countdowns for any location on Earth.
```

(71 characters)

---

## Full Description (≤4 000 characters)

```
Eclipse Timer computes precise contact times for solar eclipses at any location you choose — down to the second.

Pick an eclipse from a catalog spanning 1900 to 2100, drop a pin on the map or use your GPS, and instantly see when each phase of the eclipse begins and ends at your exact location.

FEATURES

• Browse 200+ solar eclipses from 1900 to 2100 — total, annular, partial, and hybrid — with search and filtering by year, date, type, or catalog ID.

• Tap the map, drag a pin, or use GPS to set your observer location. The engine computes results for your precise coordinates.

• View all five contact times (C1, C2, Greatest Eclipse, C3, C4) in both UTC and your local time zone. See eclipse type, magnitude, and duration of totality or annularity at your chosen spot.

• Live countdown timer shows days, hours, minutes, and seconds until the next eclipse event for the selected eclipse.

• Set notification reminders for eclipse contacts — one hour before, ten minutes before, or at the moment of each event. Choose between system sounds, vibration, or spoken voice (TTS) alerts.

• Interactive map overlays show the eclipse's visible path and central line so you can see where totality or annularity occurs.

• NASA preview animations let you visualize each eclipse before it happens.

• Save favorite locations for quick access across different eclipses.

HOW IT WORKS

Eclipse Timer uses the classical Besselian elements method — the same mathematical framework used by professional astronomers — to compute local eclipse circumstances. The engine evaluates polynomial shadow geometry at your observer coordinates to determine exactly when the moon's penumbral and umbral shadows reach your location.

All computation happens on your device. Your location is never sent to any server.

PRIVACY

Eclipse Timer requests location access only when you choose to use GPS. Your coordinates stay on your device and are used solely to compute eclipse times. The app contains no ads, no analytics, no tracking, and no user accounts. See our full privacy policy for details.

Whether you're planning a trip to see totality, checking if a partial eclipse will be visible from your backyard, or exploring historical eclipses — Eclipse Timer gives you the precise timing data you need.
```

(1 753 characters)

---

## Keywords (≤100 characters, comma-separated, iOS only)

```
eclipse,solar eclipse,totality,annular,eclipse timer,contact times,astronomy
```

(78 characters)

---

## What's New — v1.0.0

```
Initial release of Eclipse Timer.

• Browse 200+ solar eclipses from 1900 to 2100
• Compute precise contact times (C1/C2/Max/C3/C4) for any location
• Live countdown timer to next eclipse event
• Notification reminders with sound, vibration, or voice alerts
• Interactive map with eclipse path overlays
• NASA preview animations
• Favorite locations
• Dark theme UI
```

---

## Category

- **Primary:** Weather (iOS) / Weather (Android)
- **Secondary:** Education (iOS) / Education (Android)

> Note: There is no "Astronomy" category on either store. Weather or Education are the closest fits. Reference or Tools are alternatives.

---

## Content Rating

### Apple App Store — Age Rating Questionnaire

Answer **No** to all of the following:
- Cartoon or Fantasy Violence — No
- Realistic Violence — No
- Sexual Content or Nudity — No
- Profanity or Crude Humor — No
- Alcohol, Tobacco, or Drug Use or References — No
- Simulated Gambling — No
- Horror/Fear Themes — No
- Medical/Treatment Information — No
- Mature/Suggestive Themes — No
- Unrestricted Web Access — No (the app only loads NASA GIF images, not arbitrary web content)

**Expected rating: 4+**

### Google Play — Content Rating Questionnaire (IARC)

Answer **No** to all content categories:
- Violence — No
- Sexual Content — No
- Language — No
- Controlled Substance — No
- User Interaction — No (no user-generated content, no social features)
- Shares Location — No (location is used on-device only, never shared)
- Contains Ads — No
- Digital Purchases — No

**Expected rating: Everyone / PEGI 3 / USK 0**

---

## Icon Assets — Status & Requirements

### Current State

| Asset | Path | Dimensions | Format | Status |
|-------|------|-----------|--------|--------|
| `icon.png` | `apps/mobile/assets/icon.png` | 1024×1024 | 32-bit ARGB | ⚠️ Has alpha channel — iOS requires **no transparency** |
| `adaptive-icon.png` | `apps/mobile/assets/adaptive-icon.png` | 1024×1024 | 32-bit ARGB | ✅ Size OK for Android adaptive icon foreground |
| `splash-icon.png` | `apps/mobile/assets/splash-icon.png` | 1024×1024 | 32-bit ARGB | ✅ OK |
| `favicon.png` | `apps/mobile/assets/favicon.png` | 256×256 | 32-bit ARGB | ✅ OK for web |

### Required Actions

1. **iOS App Store icon (1024×1024, no alpha):**
   - Export `icon.png` with a solid background (no transparency). Use the app's dark background (`#0b0b0b`) to fill alpha.
   - The App Store will reject submissions if the icon contains an alpha channel.
   - Tool: `convert icon.png -background "#0b0b0b" -flatten icon-no-alpha.png` (ImageMagick) or re-export from source SVG.

2. **Android adaptive icon:**
   - Current `adaptive-icon.png` at 1024×1024 is acceptable (Expo scales it). The recommended foreground size is 432×432 within a 108dp safe zone, but Expo handles the masking.

3. **Feature Graphic (Android, required):**
   - Google Play requires a 1024×500 "feature graphic" banner image.
   - This is not an app icon — it's a promotional banner shown at the top of the Play Store listing.
   - Create a 1024×500 PNG or JPEG with the app name, logo, and a visual related to eclipses.

---

## Screenshots — Requirements

### Apple App Store

| Device Class | Required Size (pixels) | Minimum Count |
|-------------|----------------------|---------------|
| iPhone 6.7" (iPhone 15 Pro Max) | 1290 × 2796 | 3 |
| iPhone 6.5" (iPhone 11 Pro Max) | 1242 × 2688 | 3 (or use 6.7" if only supporting newer) |
| iPad 12.9" (3rd gen+) | 2048 × 2732 | 3 (only if iPad is listed as supported) |

### Google Play Store

| Device Class | Required Size | Minimum Count |
|-------------|--------------|---------------|
| Phone | 16:9 or 9:16, min 320px, max 3840px per side | 2 (recommended 4–8) |
| 7" Tablet | Same ratio rules | 0 (recommended if tablet-optimized) |
| 10" Tablet | Same ratio rules | 0 (recommended if tablet-optimized) |

### Recommended Screens to Capture

1. **Landing screen** — eclipse list with search visible, an eclipse selected, NASA preview showing
2. **Timer screen — map view** — map with pin placed, eclipse overlay paths visible
3. **Timer screen — results** — computed contact times card with countdown, showing all C1–C4 times
4. **Notification settings** — notification toggles and scheduled event list
5. **Timer screen — full view** — map + results together showing the complete experience

### How to Capture

```bash
# Build a preview APK/IPA
eas build --profile preview --platform all

# Install on physical devices or simulators at the required resolutions
# Use device screenshot (Power + Volume Up on iOS, Power + Volume Down on Android)
# Or use Xcode Simulator: File > Save Screen, Android Studio emulator: camera icon
```

---

## Account Verification

### Apple Developer Account
- Ensure the Expo owner `lallimaven` maps to an Apple Developer account ($99/year).
- The `bundleIdentifier` (`com.lallimaven.eclipse-timer`) must be registered in the Apple Developer portal under Identifiers.
- EAS Build can manage provisioning profiles and signing certificates automatically.

### Google Play Console
- Ensure a Google Play Developer account exists ($25 one-time fee).
- The `android.package` (`com.lallimaven.eclipsetimer`) will be permanently associated with this account after first upload.
- EAS Build generates a signed AAB for upload.

---

## Submission Checklist

```
Before submitting:
├── [ ] icon.png re-exported without alpha channel
├── [ ] Feature graphic (1024×500) created for Google Play
├── [ ] Screenshots captured for all required device classes
├── [ ] Short description entered in both store consoles
├── [ ] Full description entered in both store consoles
├── [ ] Keywords set (iOS only)
├── [ ] "What's New" text entered
├── [ ] Content rating questionnaires completed
├── [ ] Privacy policy URL set in both listings
├── [ ] Category selected
├── [ ] Apple Developer account verified
├── [ ] Google Play Console account verified
└── [ ] App builds successfully with `eas build --profile production`
```
