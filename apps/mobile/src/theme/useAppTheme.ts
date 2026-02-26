import { useColorScheme } from "react-native";

import { useAppState } from "../state/appState";
import { colorsForTheme } from "./colors";
import { resolveAppTheme } from "./resolveAppTheme";

export function useAppTheme() {
  const { state } = useAppState();
  const systemColorScheme = useColorScheme();
  const resolvedTheme = resolveAppTheme(state.themePreference, systemColorScheme);

  return {
    preference: state.themePreference,
    resolvedTheme,
    isDark: resolvedTheme === "dark",
    colors: colorsForTheme(resolvedTheme),
  };
}
