import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Speech from "expo-speech";
import * as SplashScreen from "expo-splash-screen";
import * as Sentry from "@sentry/react-native";
import { addNotificationReceivedListener } from "expo-notifications/build/NotificationsEmitter";

import ErrorBoundary from "./components/ErrorBoundary";
import RootNavigator from "./navigation/RootNavigator";
import { configureNotificationPresentationHandler } from "./services/notifications";
import { AppStateProvider } from "./state/appState";

SplashScreen.preventAutoHideAsync();

Sentry.init({
  dsn: "__YOUR_SENTRY_DSN__",
  enabled: !__DEV__,
});

function AppInner() {
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

export default Sentry.wrap(function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
});
