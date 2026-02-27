import {
  loadCatalog,
  loadCatalogEntry,
  loadCatalogEntryWithOverlays,
} from "@eclipse-timer/catalog";
import { computeCircumstances } from "@eclipse-timer/engine";
import type {
  Circumstances,
  EclipseKindAtLocation,
  EclipseRecord,
  Observer,
} from "@eclipse-timer/shared";
import {
  type LinkingOptions,
  NavigationContainer,
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationLightTheme,
  type Theme as NavigationTheme,
  useFocusEffect,
  useIsFocused,
  useNavigationContainerRef,
} from "@react-navigation/native";
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from "@react-navigation/native-stack";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  InteractionManager,
  Linking,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { enableScreens } from "react-native-screens";
import { APP_LOGO } from "../assets/branding";
import { useInAppAlarmEngine } from "../hooks/useInAppAlarmEngine";
import { useLandingEclipses } from "../hooks/useLandingEclipses";
import { useLandingScroll } from "../hooks/useLandingScroll";
import { useNotificationScheduler } from "../hooks/useNotificationScheduler";
import { useTimerState } from "../hooks/useTimerState";
import AboutScreen from "../screens/AboutScreen";
import EclipsePreviewScreen, { type PreviewPayload } from "../screens/EclipsePreviewScreen";
import HelpScreen from "../screens/HelpScreen";
import LandingScreen from "../screens/LandingScreen";
import LocationSettingsScreen from "../screens/LocationSettingsScreen";
import NotificationSettingsScreen from "../screens/NotificationSettingsScreen";
import PhotographyGuideScreen, {
  type PhotographyGuidePayload,
} from "../screens/PhotographyGuideScreen";
import SettingsScreen from "../screens/SettingsScreen";
import ThemeSettingsScreen from "../screens/ThemeSettingsScreen";
import TimerScreen from "../screens/TimerScreen";
import {
  type IncomingExternalLink,
  normalizeSharePayloadToIncomingLinks,
  subscribeToIncomingExternalLinks,
} from "../services/shareIntake";
import useShareIntentBridge from "../services/useShareIntentBridge";
import { syncWearPreviewRouteState } from "../services/wearPreviewPublisher";
import { startWearLiveSync } from "../services/wearSync";
import { type FavoriteLocation, useAppState } from "../state/appState";
import { useAppTheme } from "../theme/useAppTheme";
import { localYmdNow } from "../utils/date";
import { kindCodeForRecord, kindLabelFromCode } from "../utils/eclipse";
import { type ParsedSharedMapLink, parseSharedMapLinkAsync } from "../utils/sharedMapLink";
import FirstRunOnboardingOverlay from "./FirstRunOnboardingOverlay";
import { ONBOARDING_WALKTHROUGH_STEPS, type OnboardingRouteName } from "./onboardingWalkthrough";
import SideMenu, { type MenuRouteName } from "./SideMenu";

enableScreens();

type RootStackParamList = {
  Landing: undefined;
  Timer: undefined;
  Preview: { payload: PreviewPayload };
  PhotographyGuide: { payload: PhotographyGuidePayload };
  Settings: undefined;
  About: undefined;
  Help: undefined;
  ThemeSettings: undefined;
  NotificationSettings: undefined;
  LocationSettings: undefined;
};

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["eclipsetimer://"],
  config: {
    screens: {
      Landing: "landing",
      Timer: "timer",
      PhotographyGuide: "photography-guide",
      Settings: "settings",
      About: "settings/about",
      Help: "settings/help",
      ThemeSettings: "settings/theme",
      NotificationSettings: "notifications",
      LocationSettings: "locations",
    },
  },
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type LandingRouteProps = NativeStackScreenProps<RootStackParamList, "Landing"> & {
  catalog: EclipseRecord[];
  onOpenMenu: () => void;
};

type TimerRouteProps = NativeStackScreenProps<RootStackParamList, "Timer"> & {
  catalog: EclipseRecord[];
  onOpenMenu: () => void;
  pendingSharedLocation: PendingSharedLocation | null;
  onConsumePendingSharedLocation: (id: string) => void;
};

type PreviewRouteProps = NativeStackScreenProps<RootStackParamList, "Preview"> & {
  onOpenMenu: () => void;
};

type PhotographyGuideRouteProps = NativeStackScreenProps<RootStackParamList, "PhotographyGuide"> & {
  onOpenMenu: () => void;
};

type SettingsRouteProps = NativeStackScreenProps<RootStackParamList, "Settings"> & {
  onOpenMenu: () => void;
};

type ThemeSettingsRouteProps = NativeStackScreenProps<RootStackParamList, "ThemeSettings"> & {
  onOpenMenu: () => void;
};

type RouteWithMenuProps = {
  onOpenMenu: () => void;
};

function filterLandingEclipses(
  eclipses: ReturnType<typeof useLandingEclipses>["landingEclipses"],
  query: string,
) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return eclipses;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (!tokens.length) return eclipses;

  return eclipses.filter((e) => {
    const haystack = [
      e.id,
      e.dateYmd,
      e.kindLabel,
      e.isPast ? "past" : "upcoming",
      e.dateYmd.slice(0, 4),
    ]
      .join(" ")
      .toLowerCase();

    return tokens.every((token) => haystack.includes(token));
  });
}

function StartupLoadingScreen({
  message,
  colors,
}: {
  message: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View style={[styles.startupSafe, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.startupCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <Image source={APP_LOGO} style={styles.startupLogo} resizeMode="contain" />
        <ActivityIndicator />
        <Text style={[styles.startupTitle, { color: colors.textPrimary }]}>Eclipse Timer</Text>
        <Text style={[styles.startupSubtitle, { color: colors.textMuted }]}>{message}</Text>
      </View>
    </View>
  );
}

function toMenuRouteName(route: keyof RootStackParamList): MenuRouteName | null {
  if (route === "Landing") return "Landing";
  if (route === "Timer" || route === "PhotographyGuide") return "Timer";
  if (
    route === "Settings" ||
    route === "About" ||
    route === "Help" ||
    route === "ThemeSettings" ||
    route === "NotificationSettings" ||
    route === "LocationSettings"
  ) {
    return "Settings";
  }
  return null;
}

type FeaturedEclipseDeepLinkAction =
  | { type: "open_timer"; eclipseId: string }
  | { type: "open_preview"; eclipseId: string };

type PendingSharedLocation = ParsedSharedMapLink & {
  id: string;
};

const INCOMING_EXTERNAL_LINK_DEDUPE_WINDOW_MS = 5_000;
const MAX_TRACKED_INCOMING_EXTERNAL_LINKS = 20;

const FEATURED_ECLIPSE_BY_SLUG: Record<string, string> = {
  "2026-total": "2026-08-12T",
  "2027-total": "2027-08-02T",
  "2026-08-12": "2026-08-12T",
  "2027-08-02": "2027-08-02T",
};

function normalizeDeepLinkPath(url: string): string {
  const withoutScheme = url.replace(/^[A-Za-z][A-Za-z0-9+.-]*:\/\//, "");
  const pathOnly = withoutScheme.split(/[?#]/, 1)[0] ?? "";
  return pathOnly.replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();
}

function parseFeaturedEclipseDeepLink(url: string): FeaturedEclipseDeepLinkAction | null {
  const path = normalizeDeepLinkPath(url);
  if (!path.startsWith("eclipse/")) return null;

  const [, slug = "", action = ""] = path.split("/");
  const eclipseId = FEATURED_ECLIPSE_BY_SLUG[slug];
  if (!eclipseId) return null;

  if (!action) {
    return { type: "open_timer", eclipseId };
  }

  if (action === "preview") {
    return { type: "open_preview", eclipseId };
  }

  return null;
}

function fallbackKindAtLocationForRecord(record: EclipseRecord): EclipseKindAtLocation {
  const code = kindCodeForRecord(record);
  if (code === "T" || code === "H") return "total";
  if (code === "A") return "annular";
  return "partial";
}

function buildPreviewPayloadForFeaturedDeepLink(eclipseId: string): PreviewPayload | null {
  const record = loadCatalogEntry(eclipseId);
  if (!record) return null;

  const lat =
    typeof record.greatestEclipseLatDeg === "number" &&
    Number.isFinite(record.greatestEclipseLatDeg)
      ? record.greatestEclipseLatDeg
      : 0;
  const lon =
    typeof record.greatestEclipseLonDeg === "number" &&
    Number.isFinite(record.greatestEclipseLonDeg)
      ? record.greatestEclipseLonDeg
      : 0;

  const observer: Observer = { latDeg: lat, lonDeg: lon, elevM: 0 };

  let circumstances: Circumstances | null = null;
  try {
    circumstances = computeCircumstances(record, observer);
  } catch {
    circumstances = null;
  }

  return {
    eclipseId: record.id,
    eclipseDateYmd: record.dateYmd,
    kindAtLocation: circumstances?.kindAtLocation ?? fallbackKindAtLocationForRecord(record),
    magnitude: circumstances?.magnitude,
    c1Utc: circumstances?.c1Utc,
    c2Utc: circumstances?.c2Utc,
    maxUtc: circumstances?.maxUtc ?? record.greatestEclipseUtc,
    c3Utc: circumstances?.c3Utc,
    c4Utc: circumstances?.c4Utc,
  };
}

function LandingRoute({ navigation, catalog, onOpenMenu }: LandingRouteProps) {
  const { state, actions } = useAppState();
  const isFocused = useIsFocused();
  const [searchQuery, setSearchQuery] = useState("");
  const { landingEclipses } = useLandingEclipses(catalog);
  const filteredLandingEclipses = useMemo(
    () => filterLandingEclipses(landingEclipses, searchQuery),
    [landingEclipses, searchQuery],
  );
  const filteredFirstFutureIndex = useMemo(
    () => filteredLandingEclipses.findIndex((item) => !item.isPast),
    [filteredLandingEclipses],
  );
  const selectedIndex = useMemo(
    () =>
      state.selectedLandingId
        ? filteredLandingEclipses.findIndex((item) => item.id === state.selectedLandingId)
        : -1,
    [filteredLandingEclipses, state.selectedLandingId],
  );
  const landingScroll = useLandingScroll({
    isFocused,
    selectedIndex,
    firstFutureIndex: filteredFirstFutureIndex,
  });

  const goToTimer = () => {
    if (!state.selectedLandingId) return;
    landingScroll.didAutoScrollRef.current = true;
    actions.activateSelected();
    navigation.navigate("Timer");
  };

  return (
    <LandingScreen
      eclipses={filteredLandingEclipses}
      selectedId={state.selectedLandingId}
      searchQuery={searchQuery}
      filteredCount={filteredLandingEclipses.length}
      totalCount={landingEclipses.length}
      onSelect={actions.selectLanding}
      onSearchQueryChange={setSearchQuery}
      onGo={goToTimer}
      onOpenMenu={onOpenMenu}
      scroll={landingScroll}
    />
  );
}

function TimerRoute({
  navigation,
  catalog,
  onOpenMenu,
  pendingSharedLocation,
  onConsumePendingSharedLocation,
}: TimerRouteProps) {
  const { state, actions } = useAppState();
  const isFocused = useIsFocused();
  const lastAppliedSharedLocationIdRef = useRef<string | null>(null);
  const [activeEclipse, setActiveEclipse] = useState<EclipseRecord | null>(null);
  const [isActiveEclipseLoading, setIsActiveEclipseLoading] = useState(false);
  const todayYmd = useMemo(() => localYmdNow(), []);
  const eclipseOptions = useMemo(
    () =>
      [...catalog]
        .sort((a, b) => a.dateYmd.localeCompare(b.dateYmd))
        .map((record) => ({
          id: record.id,
          dateYmd: record.dateYmd,
          kindLabel: kindLabelFromCode(kindCodeForRecord(record)),
          isPast: record.dateYmd < todayYmd,
        })),
    [catalog, todayYmd],
  );

  useEffect(() => {
    const eclipseId = state.activeEclipseId;
    if (!eclipseId) {
      setActiveEclipse(null);
      setIsActiveEclipseLoading(false);
      return;
    }

    let didCancel = false;
    setIsActiveEclipseLoading(true);
    setActiveEclipse((prev) => (prev?.id === eclipseId ? prev : null));

    const task = InteractionManager.runAfterInteractions(() => {
      if (didCancel) return;
      const nextActive = loadCatalogEntryWithOverlays(eclipseId) ?? null;
      if (didCancel) return;
      setActiveEclipse(nextActive);
      setIsActiveEclipseLoading(false);
    });

    return () => {
      didCancel = true;
      task.cancel();
    };
  }, [state.activeEclipseId]);

  const isActiveEclipseAlarmEnabled = useMemo(() => {
    if (!state.activeEclipseId) return false;
    return !state.disabledEclipseAlarmIds.includes(state.activeEclipseId);
  }, [state.activeEclipseId, state.disabledEclipseAlarmIds]);

  const timerState = useTimerState(
    activeEclipse,
    state.notificationMockTimeline,
    state.notificationEntries,
    isActiveEclipseAlarmEnabled,
    actions.upsertNotificationEntry,
    actions.removeNotificationEntry,
    actions.upsertEclipseReminderAnchor,
    actions.removeEclipseReminderAnchor,
  );

  useEffect(() => {
    if (!pendingSharedLocation) return;
    if (lastAppliedSharedLocationIdRef.current === pendingSharedLocation.id) return;

    console.info("[share.debug] applying_pending_location", pendingSharedLocation);
    lastAppliedSharedLocationIdRef.current = pendingSharedLocation.id;
    timerState.jumpTo(pendingSharedLocation.lat, pendingSharedLocation.lon, 2);
    timerState.setStatusMessage("Location loaded from shared map link");
    onConsumePendingSharedLocation(pendingSharedLocation.id);
  }, [onConsumePendingSharedLocation, pendingSharedLocation, timerState]);

  useInAppAlarmEngine({
    isRouteFocused: isFocused,
    activeEclipseId: state.activeEclipseId,
    isActiveEclipseAlarmEnabled,
    notificationEntries: state.notificationEntries,
    alarmLeadSecondsA1: state.notificationSettings.alarmLeadSecondsA1,
    alarmCountdownStartSecondsA2: state.notificationSettings.alarmCountdownStartSecondsA2,
  });

  useFocusEffect(
    useCallback(() => {
      timerState.resetForNewEclipse();
    }, [timerState.resetForNewEclipse, state.activeEclipseId]),
  );

  const openPreview = useCallback(
    (result: Circumstances) => {
      const payload: PreviewPayload = {
        eclipseId: activeEclipse?.id ?? result.eclipseId,
        eclipseDateYmd: activeEclipse?.dateYmd ?? "",
        kindAtLocation: result.kindAtLocation,
        magnitude: result.magnitude,
        c1Utc: result.c1Utc,
        c2Utc: result.c2Utc,
        maxUtc: result.maxUtc,
        c3Utc: result.c3Utc,
        c4Utc: result.c4Utc,
        c1BearingDeg: result.c1BearingDeg,
        c2BearingDeg: result.c2BearingDeg,
        c3BearingDeg: result.c3BearingDeg,
        c4BearingDeg: result.c4BearingDeg,
      };

      navigation.navigate("Preview", { payload });
    },
    [activeEclipse?.dateYmd, activeEclipse?.id, navigation],
  );
  const openPhotographyGuide = useCallback(
    (result: Circumstances, observer: Observer) => {
      const payload: PhotographyGuidePayload = {
        eclipseId: activeEclipse?.id ?? result.eclipseId,
        eclipseDateYmd: activeEclipse?.dateYmd ?? "",
        visible: result.visible,
        kindAtLocation: result.kindAtLocation,
        magnitude: result.magnitude,
        c1Utc: result.c1Utc,
        c2Utc: result.c2Utc,
        maxUtc: result.maxUtc,
        c3Utc: result.c3Utc,
        c4Utc: result.c4Utc,
        c1BearingDeg: result.c1BearingDeg,
        c2BearingDeg: result.c2BearingDeg,
        c3BearingDeg: result.c3BearingDeg,
        c4BearingDeg: result.c4BearingDeg,
        observer,
      };

      navigation.navigate("PhotographyGuide", { payload });
    },
    [activeEclipse?.dateYmd, activeEclipse?.id, navigation],
  );

  const useFavoriteLocation = useCallback(
    (location: FavoriteLocation) => {
      timerState.jumpTo(location.lat, location.lon, 2);
      timerState.setStatusMessage(`Pin set to ${location.name}`);
    },
    [timerState],
  );
  const selectEclipse = useCallback(
    (eclipseId: string) => {
      const normalizedId = eclipseId.trim();
      if (!normalizedId || normalizedId === state.activeEclipseId) return;
      actions.selectLanding(normalizedId);
      actions.activateSelected();
    },
    [actions, state.activeEclipseId],
  );
  const setActiveEclipseAlarmEnabled = useCallback(
    (enabled: boolean) => {
      const activeId = state.activeEclipseId;
      if (!activeId) return;
      actions.setEclipseAlarmEnabled(activeId, enabled);
      timerState.setStatusMessage(
        enabled
          ? "Alarms/reminders enabled for this eclipse."
          : "Alarms/reminders disabled for this eclipse.",
      );
    },
    [actions, state.activeEclipseId, timerState],
  );

  return (
    <TimerScreen
      activeEclipse={activeEclipse}
      activeEclipseId={state.activeEclipseId}
      isActiveEclipseLoading={isActiveEclipseLoading}
      eclipseOptions={eclipseOptions}
      timer={timerState}
      isEclipseAlarmEnabled={isActiveEclipseAlarmEnabled}
      favoriteLocations={state.favoriteLocations}
      onSetEclipseAlarmEnabled={setActiveEclipseAlarmEnabled}
      onAddFavoriteLocation={actions.addFavoriteLocation}
      onUseFavoriteLocation={useFavoriteLocation}
      onSelectEclipse={selectEclipse}
      onOpenMenu={onOpenMenu}
      onOpenPreview={openPreview}
      onOpenPhotographyGuide={openPhotographyGuide}
    />
  );
}

function PreviewRoute({ navigation, route, onOpenMenu }: PreviewRouteProps) {
  return (
    <EclipsePreviewScreen
      payload={route.params.payload}
      onBack={() => navigation.goBack()}
      onOpenMenu={onOpenMenu}
    />
  );
}

function PhotographyGuideRoute({ navigation, route, onOpenMenu }: PhotographyGuideRouteProps) {
  return (
    <PhotographyGuideScreen
      payload={route.params.payload}
      onBack={() => navigation.goBack()}
      onOpenMenu={onOpenMenu}
    />
  );
}

function SettingsRoute({ navigation, onOpenMenu }: SettingsRouteProps) {
  return (
    <SettingsScreen
      onOpenMenu={onOpenMenu}
      onOpenAbout={() => navigation.navigate("About")}
      onOpenHelp={() => navigation.navigate("Help")}
      onOpenThemeSettings={() => navigation.navigate("ThemeSettings")}
      onOpenNotificationSettings={() => navigation.navigate("NotificationSettings")}
      onOpenLocationSettings={() => navigation.navigate("LocationSettings")}
    />
  );
}

function HelpRoute({ onOpenMenu }: RouteWithMenuProps) {
  return <HelpScreen onOpenMenu={onOpenMenu} />;
}

function AboutRoute({ onOpenMenu }: RouteWithMenuProps) {
  return <AboutScreen onOpenMenu={onOpenMenu} />;
}

function ThemeSettingsRoute({ onOpenMenu }: ThemeSettingsRouteProps) {
  const { state, actions } = useAppState();

  return (
    <ThemeSettingsScreen
      onOpenMenu={onOpenMenu}
      preference={state.themePreference}
      onSetThemePreference={actions.setThemePreference}
    />
  );
}

function NotificationSettingsRoute({ onOpenMenu }: RouteWithMenuProps) {
  const { state, actions } = useAppState();

  return (
    <NotificationSettingsScreen
      onOpenMenu={onOpenMenu}
      settings={state.notificationSettings}
      mockTimeline={state.notificationMockTimeline}
      onSetSetting={actions.setNotificationSetting}
      onSetAlarmTiming={actions.setAlarmTiming}
      onSetMockTimelineEnabled={actions.setNotificationMockTimelineEnabled}
      onSetMockTimelineOffsets={actions.setNotificationMockTimelineOffsets}
    />
  );
}

function LocationSettingsRoute({ onOpenMenu }: RouteWithMenuProps) {
  const { state, actions } = useAppState();

  return (
    <LocationSettingsScreen
      onOpenMenu={onOpenMenu}
      favoriteLocations={state.favoriteLocations}
      onAddFavoriteLocation={actions.addFavoriteLocation}
      onRemoveFavoriteLocation={actions.removeFavoriteLocation}
    />
  );
}

export default function RootNavigator() {
  const { state: appState, hasHydratedPreferences, actions } = useAppState();
  const { colors, resolvedTheme } = useAppTheme();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentBridge({
    debug: true,
    resetOnBackground: false,
  });
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const pendingFeaturedDeepLinkActionRef = useRef<FeaturedEclipseDeepLinkAction | null>(null);
  const sharedLocationSequenceRef = useRef(0);
  const recentIncomingExternalLinksRef = useRef<Array<{ value: string; receivedAtMs: number }>>([]);
  const [catalog, setCatalog] = useState<EclipseRecord[] | null>(null);
  const [pendingSharedLocation, setPendingSharedLocation] = useState<PendingSharedLocation | null>(
    null,
  );
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [onboardingStepIndex, setOnboardingStepIndex] = useState(0);
  const [currentRouteName, setCurrentRouteName] = useState<keyof RootStackParamList>("Landing");
  const navigationTheme = useMemo<NavigationTheme>(() => {
    const base = resolvedTheme === "light" ? NavigationLightTheme : NavigationDarkTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        border: colors.border,
        text: colors.textPrimary,
      },
    };
  }, [
    colors.background,
    colors.border,
    colors.primary,
    colors.surface,
    colors.textPrimary,
    resolvedTheme,
  ]);

  useNotificationScheduler(
    appState.notificationSettings,
    appState.eclipseReminderAnchors,
    appState.disabledEclipseAlarmIds,
  );

  useEffect(() => {
    const stopWearLiveSync = startWearLiveSync();
    return () => {
      stopWearLiveSync();
    };
  }, []);

  useEffect(() => {
    return () => {
      syncWearPreviewRouteState({ routeName: null, previewPayload: null });
    };
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const openMenu = useCallback(() => {
    setIsMenuOpen(true);
  }, []);

  const syncWearPreviewWithRoute = useCallback(() => {
    const route = navigationRef.getCurrentRoute();
    if (!route) return;

    setCurrentRouteName(route.name);

    if (route.name !== "Preview") {
      syncWearPreviewRouteState({ routeName: route.name, previewPayload: null });
      return;
    }

    const previewPayload =
      route.params && typeof route.params === "object" && "payload" in route.params
        ? (route.params.payload as PreviewPayload | undefined)
        : undefined;

    syncWearPreviewRouteState({
      routeName: route.name,
      previewPayload: previewPayload ?? null,
    });
  }, [navigationRef]);

  const activateEclipseById = useCallback(
    (eclipseId: string) => {
      actions.selectLanding(eclipseId);
      actions.activateSelected();
    },
    [actions],
  );

  const runFeaturedDeepLinkAction = useCallback(
    (action: FeaturedEclipseDeepLinkAction) => {
      activateEclipseById(action.eclipseId);
      closeMenu();

      if (!navigationRef.isReady()) {
        pendingFeaturedDeepLinkActionRef.current = action;
        return;
      }

      if (action.type === "open_timer") {
        navigationRef.navigate("Timer");
        return;
      }

      const payload = buildPreviewPayloadForFeaturedDeepLink(action.eclipseId);
      if (!payload) {
        navigationRef.navigate("Timer");
        return;
      }

      navigationRef.navigate("Preview", { payload });
    },
    [activateEclipseById, closeMenu, navigationRef],
  );

  const queuePendingSharedLocation = useCallback(
    (link: ParsedSharedMapLink) => {
      sharedLocationSequenceRef.current += 1;
      const pending: PendingSharedLocation = {
        ...link,
        id: `shared-location-${sharedLocationSequenceRef.current}`,
      };

      console.info("[share.debug] queue_pending_location", pending);
      setPendingSharedLocation(pending);
      closeMenu();

      if (!navigationRef.isReady()) return;
      navigationRef.navigate("Timer");
    },
    [closeMenu, navigationRef],
  );

  const consumePendingSharedLocation = useCallback((id: string) => {
    setPendingSharedLocation((current) => (current?.id === id ? null : current));
  }, []);

  const shouldProcessIncomingExternalLink = useCallback((value: string) => {
    const nowMs = Date.now();
    const cutoffMs = nowMs - INCOMING_EXTERNAL_LINK_DEDUPE_WINDOW_MS;
    const recent = recentIncomingExternalLinksRef.current.filter(
      (entry) => entry.receivedAtMs >= cutoffMs,
    );
    const isDuplicate = recent.some((entry) => entry.value === value);
    if (isDuplicate) {
      recentIncomingExternalLinksRef.current = recent;
      return false;
    }

    recent.push({ value, receivedAtMs: nowMs });
    if (recent.length > MAX_TRACKED_INCOMING_EXTERNAL_LINKS) {
      recent.splice(0, recent.length - MAX_TRACKED_INCOMING_EXTERNAL_LINKS);
    }
    recentIncomingExternalLinksRef.current = recent;
    return true;
  }, []);

  const handleIncomingUrl = useCallback(
    async (incoming: IncomingExternalLink) => {
      console.info("[share.debug] handle_incoming", incoming);
      if (!shouldProcessIncomingExternalLink(incoming.value)) {
        console.info("[share.debug] dropped_duplicate", incoming.value);
        return false;
      }

      const action = parseFeaturedEclipseDeepLink(incoming.value);
      if (action) {
        console.info("[share.debug] featured_deep_link", action);
        if (!navigationRef.isReady()) {
          pendingFeaturedDeepLinkActionRef.current = action;
          return true;
        }

        runFeaturedDeepLinkAction(action);
        return true;
      }

      const sharedMapLink = await parseSharedMapLinkAsync(incoming.value);
      if (!sharedMapLink) {
        console.info("[share.debug] map_parse_failed", incoming.value);
        return false;
      }

      console.info("[share.debug] map_parse_success", sharedMapLink);

      queuePendingSharedLocation(sharedMapLink);
      return true;
    },
    [
      navigationRef,
      queuePendingSharedLocation,
      runFeaturedDeepLinkAction,
      shouldProcessIncomingExternalLink,
    ],
  );

  const onNavigationReady = useCallback(() => {
    syncWearPreviewWithRoute();
    const pendingAction = pendingFeaturedDeepLinkActionRef.current;
    if (pendingAction) {
      pendingFeaturedDeepLinkActionRef.current = null;
      runFeaturedDeepLinkAction(pendingAction);
      return;
    }

    if (pendingSharedLocation) {
      closeMenu();
      navigationRef.navigate("Timer");
    }
  }, [
    closeMenu,
    navigationRef,
    pendingSharedLocation,
    runFeaturedDeepLinkAction,
    syncWearPreviewWithRoute,
  ]);

  const onNavigateFromMenu = useCallback(
    (route: MenuRouteName) => {
      closeMenu();
      if (!navigationRef.isReady()) return;
      const currentRoute = navigationRef.getCurrentRoute()?.name;
      if (currentRoute === route) return;
      navigationRef.navigate(route);
    },
    [closeMenu, navigationRef],
  );

  const activeMenuRoute = useMemo(() => toMenuRouteName(currentRouteName), [currentRouteName]);
  const onboardingStepCount = ONBOARDING_WALKTHROUGH_STEPS.length;
  const onboardingStep = ONBOARDING_WALKTHROUGH_STEPS[onboardingStepIndex] ?? null;
  const isFirstRunOnboardingVisible =
    hasHydratedPreferences && !appState.hasCompletedOnboarding && onboardingStepCount > 0;
  const isOnboardingStepRouteActive = onboardingStep
    ? currentRouteName === onboardingStep.route
    : false;

  const completeOnboarding = useCallback(() => {
    closeMenu();
    setOnboardingStepIndex(0);
    actions.setOnboardingCompleted(true);
  }, [actions, closeMenu]);

  const goToOnboardingStepRoute = useCallback(
    (route: OnboardingRouteName) => {
      closeMenu();
      if (!navigationRef.isReady()) return;
      const currentRoute = navigationRef.getCurrentRoute()?.name;
      if (currentRoute === route) return;
      navigationRef.navigate(route);
    },
    [closeMenu, navigationRef],
  );

  const goToNextOnboardingStep = useCallback(() => {
    if (!onboardingStepCount) {
      completeOnboarding();
      return;
    }
    if (onboardingStepIndex >= onboardingStepCount - 1) {
      completeOnboarding();
      return;
    }

    const nextStepIndex = onboardingStepIndex + 1;
    setOnboardingStepIndex(nextStepIndex);

    const nextStep = ONBOARDING_WALKTHROUGH_STEPS[nextStepIndex];
    if (!nextStep) return;
    goToOnboardingStepRoute(nextStep.route);
  }, [completeOnboarding, goToOnboardingStepRoute, onboardingStepCount, onboardingStepIndex]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      closeMenu();
      return true;
    });
    return () => subscription.remove();
  }, [closeMenu, isMenuOpen]);

  useEffect(() => {
    if (!isFirstRunOnboardingVisible) {
      setOnboardingStepIndex(0);
      return;
    }
    if (onboardingStepIndex >= onboardingStepCount) {
      setOnboardingStepIndex(Math.max(0, onboardingStepCount - 1));
    }
  }, [isFirstRunOnboardingVisible, onboardingStepCount, onboardingStepIndex]);

  useEffect(() => {
    if (!isFirstRunOnboardingVisible || !isMenuOpen) return;
    closeMenu();
  }, [closeMenu, isFirstRunOnboardingVisible, isMenuOpen]);

  useEffect(() => {
    let didCancel = false;

    const task = InteractionManager.runAfterInteractions(() => {
      if (didCancel) return;
      const loaded = loadCatalog();
      if (didCancel) return;
      setCatalog(loaded);
      void SplashScreen.hideAsync();
    });

    return () => {
      didCancel = true;
      task.cancel();
    };
  }, []);

  useEffect(() => {
    return subscribeToIncomingExternalLinks(
      (incoming) => {
        void handleIncomingUrl(incoming);
      },
      { linking: Linking },
    );
  }, [handleIncomingUrl]);

  useEffect(() => {
    if (!hasShareIntent) return;

    const shareIncomingLinks = normalizeSharePayloadToIncomingLinks({
      webUrl: shareIntent.webUrl,
      text: shareIntent.text,
      value: shareIntent.meta?.title,
    });
    console.info("[share.debug] share_payload", {
      hasShareIntent,
      text: shareIntent.text,
      webUrl: shareIntent.webUrl,
      title: shareIntent.meta?.title,
      type: shareIntent.type,
      fileCount: shareIntent.files?.length ?? 0,
      normalized: shareIncomingLinks.map((x) => x.value),
    });
    if (!shareIncomingLinks.length) {
      resetShareIntent();
      return;
    }

    void (async () => {
      for (const incoming of shareIncomingLinks) {
        await handleIncomingUrl(incoming);
      }
      resetShareIntent();
    })();
  }, [
    handleIncomingUrl,
    hasShareIntent,
    resetShareIntent,
    shareIntent.meta?.title,
    shareIntent.text,
    shareIntent.webUrl,
  ]);

  if (!catalog) {
    return <StartupLoadingScreen message="Loading eclipse catalog..." colors={colors} />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      theme={navigationTheme}
      onReady={onNavigationReady}
      onStateChange={syncWearPreviewWithRoute}
    >
      <View style={styles.navigationRoot}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Landing">
            {(props) => <LandingRoute {...props} catalog={catalog} onOpenMenu={openMenu} />}
          </Stack.Screen>
          <Stack.Screen name="Timer">
            {(props) => (
              <TimerRoute
                {...props}
                catalog={catalog}
                onOpenMenu={openMenu}
                pendingSharedLocation={pendingSharedLocation}
                onConsumePendingSharedLocation={consumePendingSharedLocation}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Preview">
            {(props) => <PreviewRoute {...props} onOpenMenu={openMenu} />}
          </Stack.Screen>
          <Stack.Screen name="PhotographyGuide">
            {(props) => <PhotographyGuideRoute {...props} onOpenMenu={openMenu} />}
          </Stack.Screen>
          <Stack.Screen name="Settings">
            {(props) => <SettingsRoute {...props} onOpenMenu={openMenu} />}
          </Stack.Screen>
          <Stack.Screen name="About">{() => <AboutRoute onOpenMenu={openMenu} />}</Stack.Screen>
          <Stack.Screen name="Help">{() => <HelpRoute onOpenMenu={openMenu} />}</Stack.Screen>
          <Stack.Screen name="ThemeSettings">
            {(props) => <ThemeSettingsRoute {...props} onOpenMenu={openMenu} />}
          </Stack.Screen>
          <Stack.Screen name="NotificationSettings">
            {() => <NotificationSettingsRoute onOpenMenu={openMenu} />}
          </Stack.Screen>
          <Stack.Screen name="LocationSettings">
            {() => <LocationSettingsRoute onOpenMenu={openMenu} />}
          </Stack.Screen>
        </Stack.Navigator>
        <SideMenu
          visible={isMenuOpen}
          activeRoute={activeMenuRoute}
          onClose={closeMenu}
          onNavigate={onNavigateFromMenu}
        />
        <FirstRunOnboardingOverlay
          visible={isFirstRunOnboardingVisible}
          step={onboardingStep}
          stepIndex={onboardingStepIndex}
          stepCount={onboardingStepCount}
          isStepRouteActive={isOnboardingStepRouteActive}
          onGoToStepRoute={goToOnboardingStepRoute}
          onNext={goToNextOnboardingStep}
          onSkip={completeOnboarding}
        />
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  startupSafe: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  startupCard: {
    width: "100%",
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 8,
  },
  startupLogo: {
    width: 52,
    height: 52,
  },
  startupTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  startupSubtitle: {
    fontSize: 13,
  },
  navigationRoot: {
    flex: 1,
  },
});
