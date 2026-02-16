import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Speech from "expo-speech";
import { addNotificationReceivedListener } from "expo-notifications/build/NotificationsEmitter";

import RootNavigator from "./navigation/RootNavigator";
import { configureNotificationPresentationHandler } from "./services/notifications";
import { AppStateProvider } from "./state/appState";

export default function App() {
  useEffect(() => {
    configureNotificationPresentationHandler();
  }, []);

  useEffect(() => {
    const subscription = addNotificationReceivedListener((notification) => {
      const rawData = notification.request.content.data;
      if (typeof rawData !== "object" || !rawData || !("audioMode" in rawData)) return;

      const audioMode = rawData.audioMode;
      if (audioMode !== "tts") return;

      const ttsText = typeof rawData.ttsText === "string" ? rawData.ttsText.trim() : "";
      if (!ttsText) return;

      void Speech.stop();
      void Speech.speak(ttsText);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <RootNavigator />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
