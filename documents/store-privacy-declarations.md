# App Store & Play Store — Privacy Declarations

> Reference document for filling out the Apple App Privacy labels and Google Play Data Safety forms.
> Keep in sync with `PRIVACY_POLICY.md`.

---

## Apple App Store — App Privacy Labels

When submitting to App Store Connect, select the following in the **App Privacy** section:

### Data Types Collected

| Data Type | Category | Collected | Linked to Identity | Used for Tracking |
|-----------|----------|-----------|-------------------|-------------------|
| Precise Location | Location | ✅ Yes | ❌ No | ❌ No |
| Crash Data | Diagnostics | ✅ Yes | ❌ No | ❌ No |

### For each data type:

#### Precise Location
- **Usage purpose:** App Functionality
- **Linked to user identity:** No
- **Used for tracking:** No
- **Notes:** Location is used entirely on-device to compute eclipse contact times. It is never transmitted to any server or stored persistently.

#### Crash Data
- **Usage purpose:** App Functionality (bug fixing)
- **Linked to user identity:** No
- **Used for tracking:** No
- **Notes:** Crash reports are sent to Sentry and contain stack traces, device model, and OS version. No personally identifiable information is included.

### Data NOT Collected
Check "No" for all of the following categories:
- Contact Info (name, email, phone, address)
- Health & Fitness
- Financial Info
- Sensitive Info
- Contacts
- User Content
- Browsing History
- Search History
- Identifiers (user ID, device ID)
- Purchases
- Usage Data (only crash data, not usage analytics)
- Other Data

### iOS Privacy Manifest (`NSPrivacyAccessedAPITypes`)

The following API usage reasons are declared in `app.json` → `expo.ios.privacyManifests`:

| API Category | Reason Code | Justification |
|-------------|-------------|---------------|
| `NSPrivacyAccessedAPICategoryUserDefaults` | `CA92.1` | AsyncStorage uses UserDefaults to persist user preferences (notification settings, favorite locations). |

---

## Google Play Store — Data Safety Section

When filling out the **Data Safety** form in Google Play Console:

### Overview Answers
- **Does your app collect or share any of the required user data types?** Yes
- **Is all of the user data collected by your app encrypted in transit?** Yes (HTTPS for NASA GIF fetches and Sentry)
- **Do you provide a way for users to request that their data is deleted?** Not applicable — no personal data is stored on servers. On-device data is cleared by uninstalling the app.

### Data Types

#### Location → Approximate location
- **Collected:** No (precise location is used, see below)

#### Location → Precise location
- **Collected:** Yes
- **Shared with third parties:** No
- **Is this data processed ephemerally?** Yes — location is used in memory only, never stored
- **Is this data required for your app, or can users choose whether it's collected?** Optional — users can place a pin manually
- **Purpose:** App functionality

#### App info and performance → Crash logs
- **Collected:** Yes
- **Shared with third parties:** Yes — Sentry (crash reporting service provider)
- **Is this data processed ephemerally?** No — retained by Sentry per their retention policy (~90 days)
- **Is this data required for your app, or can users choose whether it's collected?** Required (automatic in production builds)
- **Purpose:** App functionality (bug fixing), Analytics (crash analysis)

#### Device or other IDs
- **Collected:** No

### Data NOT Collected or Shared
Select "No" for all of the following:
- Personal info (name, email, address, phone, etc.)
- Financial info
- Health info
- Messages
- Photos & videos
- Audio files
- Files & docs
- Calendar
- Contacts
- App activity (app interactions, search history, installed apps)
- Web browsing
- Device or other IDs

### Additional Disclosures
- The app does **not** use advertising libraries or advertising IDs.
- The app does **not** contain any ads.
- The app is **not** designed for children.
- The app does **not** share data with third parties except Sentry for crash reporting.
