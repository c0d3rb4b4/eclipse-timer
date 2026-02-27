import type { ExpoConfig } from "expo/config";

const { expo } = require("./app.json") as { expo: ExpoConfig };
const pkg = require("./package.json") as { version?: string };

const googleMapsAndroidApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();
const packageVersion = pkg.version;

if (typeof packageVersion !== "string" || !/^\d+\.\d+\.\d+(?:-SNAPSHOT)?$/.test(packageVersion)) {
  throw new Error(
    `[app.config] apps/mobile/package.json version must be x.y.z or x.y.z-SNAPSHOT. Found: ${JSON.stringify(packageVersion)}`,
  );
}

expo.version = packageVersion;
expo.runtimeVersion = packageVersion;
expo.extra = {
  ...expo.extra,
  googleMapsAndroidApiKeyConfigured: Boolean(googleMapsAndroidApiKey),
};

if (!googleMapsAndroidApiKey) {
  console.warn(
    "[app.config] GOOGLE_MAPS_ANDROID_API_KEY is not set. Android MapView will crash until a key is provided.",
  );
} else {
  expo.android = {
    ...expo.android,
    config: {
      ...expo.android?.config,
      googleMaps: {
        apiKey: googleMapsAndroidApiKey,
      },
    },
  };
}

export default expo;
