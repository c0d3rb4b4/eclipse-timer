export type HelpFaqItem = {
  question: string;
  answer: string;
};

export type HelpTroubleshootingItem = {
  title: string;
  resolution: string;
};

export type HelpDocLink = {
  title: string;
  description: string;
  url: string;
};

const REPO_BLOB_BASE_URL = "https://github.com/c0d3rb4b4/eclipse-timer/blob/main";

export const HELP_FAQ_ITEMS: HelpFaqItem[] = [
  {
    question: "Do eclipse times change when I move the map pin?",
    answer:
      "Yes. Eclipse Timer recomputes contact times for your exact latitude/longitude, so moving the pin changes results.",
  },
  {
    question: "Can I use the app offline?",
    answer:
      "Core computations work offline. NASA preview animations and external documentation links need an internet connection.",
  },
  {
    question: "How do reminders and alarms work?",
    answer:
      "Background reminders are sent at one hour and ten minutes before first contact. Foreground voice alarms use your configured a1/a2 timing.",
  },
  {
    question: "Where is my data stored?",
    answer:
      "Preferences and favorites are stored on-device. The app does not upload your location history or personal profile data.",
  },
];

export const HELP_TROUBLESHOOTING_ITEMS: HelpTroubleshootingItem[] = [
  {
    title: "GPS location is unavailable",
    resolution:
      "Enable location permission for Eclipse Timer in system settings, then retry the GPS action on Timer.",
  },
  {
    title: "No reminder arrived",
    resolution:
      "Verify Notification/Alarm Settings toggles, notification permission, and any battery optimization restrictions.",
  },
  {
    title: "Wear preview sync looks stale",
    resolution:
      "Keep phone and watch connected, open Eclipse Timer on both devices, and return to Preview to trigger a fresh sync payload.",
  },
];

export const HELP_DOC_LINKS: HelpDocLink[] = [
  {
    title: "Documentation Map",
    description: "Browse all project docs and guides.",
    url: `${REPO_BLOB_BASE_URL}/documents/README.md`,
  },
  {
    title: "Troubleshooting Guide",
    description: "Step-by-step fixes for common setup and runtime issues.",
    url: `${REPO_BLOB_BASE_URL}/documents/guides/troubleshooting.md`,
  },
  {
    title: "Setup & Development",
    description: "Detailed local setup steps for mobile and Wear workflows.",
    url: `${REPO_BLOB_BASE_URL}/documents/guides/setup-and-development.md`,
  },
  {
    title: "Privacy Policy",
    description: "Data handling and privacy details.",
    url: `${REPO_BLOB_BASE_URL}/PRIVACY_POLICY.md`,
  },
];

export function isHttpsDocLink(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}
