import type { AppThemePreference } from "../state/appState";
import type { ResolvedAppTheme } from "./colors";

export type SystemColorScheme = "light" | "dark" | null | undefined;

export function resolveAppTheme(
  preference: AppThemePreference,
  systemColorScheme: SystemColorScheme,
): ResolvedAppTheme {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  return systemColorScheme === "light" ? "light" : "dark";
}
