import * as Sentry from "@sentry/react-native";
import { addNotificationReceivedListener } from "expo-notifications/build/NotificationsEmitter";
import * as Speech from "expo-speech";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import ErrorBoundary from "./components/ErrorBoundary";
import RootNavigator from "./navigation/RootNavigator";
import { configureNotificationPresentationHandler } from "./services/notifications";
import { AppStateProvider } from "./state/appState";

SplashScreen.preventAutoHideAsync();

const sentryDsn = "__YOUR_SENTRY_DSN__".trim();
const isValidSentryDsn = /^https?:\/\/.+/.test(sentryDsn);
const isSentryEnabled = !__DEV__ && isValidSentryDsn;

if (isSentryEnabled) {
  Sentry.init({
    dsn: sentryDsn,
    enabled: true,
  });
}

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

function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}

export default isSentryEnabled ? Sentry.wrap(App) : App;
