export type ResolvedAppTheme = "light" | "dark";

export type AppThemeColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceElevated: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryMuted: string;
  primaryText: string;
  inputBackground: string;
  inputBorder: string;
  inputPlaceholder: string;
  dangerBackground: string;
  dangerBorder: string;
  dangerText: string;
  overlay: string;
};

const DARK_COLORS: AppThemeColors = {
  background: "#0b0b0b",
  surface: "#121212",
  surfaceMuted: "#171717",
  surfaceElevated: "#1b1b1b",
  border: "#2b2b2b",
  borderStrong: "#3a3a3a",
  textPrimary: "#ffffff",
  textSecondary: "#d5d5d5",
  textMuted: "#a8a8a8",
  primary: "#2c3cff",
  primaryMuted: "#1a2056",
  primaryText: "#ffffff",
  inputBackground: "#1b1b1b",
  inputBorder: "#2f2f2f",
  inputPlaceholder: "#6f6f6f",
  dangerBackground: "#351515",
  dangerBorder: "#7b2d2d",
  dangerText: "#ffb8b8",
  overlay: "rgba(0,0,0,0.58)",
};

const LIGHT_COLORS: AppThemeColors = {
  background: "#f3f5fa",
  surface: "#ffffff",
  surfaceMuted: "#f5f7fc",
  surfaceElevated: "#eef2fb",
  border: "#d8deed",
  borderStrong: "#c2cbdf",
  textPrimary: "#131827",
  textSecondary: "#2f3953",
  textMuted: "#566180",
  primary: "#3b5bff",
  primaryMuted: "#e5eaff",
  primaryText: "#ffffff",
  inputBackground: "#ffffff",
  inputBorder: "#ccd6eb",
  inputPlaceholder: "#8190b3",
  dangerBackground: "#fff1f1",
  dangerBorder: "#f0c2c2",
  dangerText: "#9d2e2e",
  overlay: "rgba(10, 15, 30, 0.22)",
};

export function colorsForTheme(theme: ResolvedAppTheme): AppThemeColors {
  return theme === "light" ? LIGHT_COLORS : DARK_COLORS;
}
