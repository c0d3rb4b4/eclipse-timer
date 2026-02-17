import type { ExpoConfig } from "expo/config";

const { expo } = require("./app.json") as { expo: ExpoConfig };

const googleMapsAndroidApiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim();

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
