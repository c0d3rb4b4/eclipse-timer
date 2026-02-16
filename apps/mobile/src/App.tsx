import { SafeAreaProvider } from "react-native-safe-area-context";

import RootNavigator from "./navigation/RootNavigator";
import { AppStateProvider } from "./state/appState";

export default function App() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <RootNavigator />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
