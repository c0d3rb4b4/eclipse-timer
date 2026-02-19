import type { ExpoConfig } from "expo/config";

const { expo } = require("./app.json") as { expo: ExpoConfig };
const pkg = require("./package.json") as { version?: string };

const googleMapsAndroidApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();
const packageVersion = pkg.version;

if (typeof packageVersion !== "string" || !/^\d+\.\d+\.\d+$/.test(packageVersion)) {
  throw new Error(
    `[app.config] apps/mobile/package.json version must be x.y.z. Found: ${JSON.stringify(packageVersion)}`,
  );
}

expo.version = packageVersion;
expo.runtimeVersion = { policy: "appVersion" };

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
