export type OnboardingRouteName = "Landing" | "Timer" | "Settings";

export type OnboardingWalkthroughStep = {
  id: string;
  title: string;
  description: string;
  highlightLabel: string;
  route: OnboardingRouteName;
};

export const ONBOARDING_WALKTHROUGH_STEPS: OnboardingWalkthroughStep[] = [
  {
    id: "landing-search-select",
    title: "Pick Your Eclipse",
    description:
      "Search by year, date, kind, or ID and select one eclipse from the list before starting the timer.",
    highlightLabel: "Search bar and eclipse list",
    route: "Landing",
  },
  {
    id: "timer-map-results",
    title: "Check Local Circumstances",
    description:
      "Use the map or GPS on Timer to compute C1/C2/MAX/C3/C4 contact times for your exact location.",
    highlightLabel: "Map pin controls and timing cards",
    route: "Timer",
  },
  {
    id: "settings-reminders-theme",
    title: "Tune Alerts And Theme",
    description:
      "Open Settings to configure reminders, alarm timing, favorite locations, and the app theme.",
    highlightLabel: "Settings shortcuts",
    route: "Settings",
  },
];

export function onboardingRouteLabel(route: OnboardingRouteName) {
  if (route === "Landing") return "Eclipse List";
  if (route === "Timer") return "Timer";
  return "Settings";
}
