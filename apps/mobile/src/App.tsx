import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import RootNavigator from "./navigation/RootNavigator";
import { configureNotificationPresentationHandler } from "./services/notifications";
import { AppStateProvider } from "./state/appState";

export default function App() {
  useEffect(() => {
    configureNotificationPresentationHandler();
  }, []);

  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <RootNavigator />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
