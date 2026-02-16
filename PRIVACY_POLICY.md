# Privacy Policy

**Eclipse Timer**
**Effective Date:** February 16, 2026
**Last Updated:** February 16, 2026

Eclipse Timer ("the App") is developed by lallimaven. This Privacy Policy explains what data the App accesses, how it is used, and your choices.

---

## 1. Information We Collect

### 1.1 Location Data

The App requests access to your device's location **only when you choose** to use the "Use GPS" feature. Your geographic coordinates (latitude and longitude) are used **entirely on-device** to compute eclipse contact times for your location.

- **Your location is never transmitted to any server.**
- **Your location is never stored persistently.** It is held in memory only while the App is running.
- You can use the App without granting location permission by manually placing a pin on the map.

### 1.2 Crash and Diagnostic Data

The App uses [Sentry](https://sentry.io) to collect crash reports and error diagnostics **in production builds only** (not during development). This data may include:

- Device model, operating system version, and app version
- Stack traces and error messages
- General device state at the time of a crash (e.g., available memory)

Crash data **does not include** your location, personal information, or any content you create in the App. Sentry's privacy practices are described at [https://sentry.io/privacy/](https://sentry.io/privacy/).

### 1.3 Network Requests

The App loads eclipse preview images (animated GIFs) directly from NASA's public Eclipse website (`https://eclipse.gsfc.nasa.gov`). These are standard HTTP image requests. The App does not send any personal data, location data, or device identifiers in these requests.

### 1.4 Notifications

The App can schedule **local notifications** to remind you of upcoming eclipse events. These notifications are created and delivered entirely on your device. No notification data is sent to any server.

### 1.5 User Preferences

Your settings (notification preferences, favorite locations) are stored **on-device only** using AsyncStorage. This data is never transmitted off your device.

---

## 2. Information We Do NOT Collect

- **No personal information:** The App does not collect your name, email address, phone number, or any account credentials.
- **No analytics or tracking:** The App does not use analytics SDKs, advertising identifiers, or tracking pixels.
- **No advertising:** The App contains no ads and does not share data with advertising networks.
- **No user accounts:** The App does not require or support user registration or login.
- **No third-party data sharing:** Beyond Sentry crash diagnostics (see section 1.2), no data leaves your device.

---

## 3. Data Retention

- **Location data** is not stored. It exists in memory only during active use.
- **User preferences** remain on your device until you clear the App's data or uninstall it.
- **Crash reports** are retained by Sentry according to their data retention policy (typically 90 days).

---

## 4. Children's Privacy

The App does not knowingly collect any personal information from children under 13 (or the applicable age in your jurisdiction). The App does not require any personal information to function.

---

## 5. Your Choices

- **Location:** You can deny or revoke location permission at any time in your device's Settings. The App functions fully without location access.
- **Notifications:** You can disable notifications in your device's Settings or within the App's Notification Settings screen.
- **Crash reporting:** Crash reports are only sent in production builds. There is no opt-out toggle at this time, but crash data contains no personally identifiable information.

---

## 6. Changes to This Policy

If we update this Privacy Policy, we will revise the "Last Updated" date at the top. Continued use of the App after changes constitutes acceptance of the updated policy.

---

## 7. Contact

If you have questions about this Privacy Policy, you can reach us at:

- **GitHub:** [https://github.com/lallimaven/eclipse-timer](https://github.com/lallimaven/eclipse-timer)

---

## 8. Summary Table

| Data Type | Collected? | Transmitted Off-Device? | Purpose |
|-----------|-----------|------------------------|---------|
| Location (lat/lon) | At runtime, in memory only | ❌ No | Compute eclipse times for your position |
| Crash diagnostics | Yes (production only) | ✅ Yes (to Sentry) | Fix bugs and improve stability |
| NASA preview images | Fetched from NASA servers | N/A (read-only fetch) | Display eclipse preview animations |
| Notification schedule | Created locally | ❌ No | Remind you of eclipse events |
| User preferences | Stored on-device | ❌ No | Remember your settings between sessions |
| Personal information | ❌ No | ❌ No | — |
| Advertising/tracking IDs | ❌ No | ❌ No | — |
