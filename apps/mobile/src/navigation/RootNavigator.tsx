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
import EclipsePreviewScreen, { type PreviewPayload } from "../screens/EclipsePreviewScreen";
import LandingScreen from "../screens/LandingScreen";
import LocationSettingsScreen from "../screens/LocationSettingsScreen";
import NotificationSettingsScreen from "../screens/NotificationSettingsScreen";
import TimerScreen from "../screens/TimerScreen";
import { type FavoriteLocation, useAppState } from "../state/appState";
import { localYmdNow } from "../utils/date";
import { kindCodeForRecord, kindLabelFromCode } from "../utils/eclipse";
import SideMenu, { type MenuRouteName } from "./SideMenu";

enableScreens();

type RootStackParamList = {
  Landing: undefined;
  Timer: undefined;
  Preview: { payload: PreviewPayload };
  NotificationSettings: undefined;
  LocationSettings: undefined;
};

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["eclipsetimer://"],
  config: {
    screens: {
      Landing: "landing",
      Timer: "timer",
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
};

type PreviewRouteProps = NativeStackScreenProps<RootStackParamList, "Preview"> & {
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

function StartupLoadingScreen({ message }: { message: string }) {
  return (
    <View style={styles.startupSafe}>
      <View style={styles.startupCard}>
        <Image source={APP_LOGO} style={styles.startupLogo} resizeMode="contain" />
        <ActivityIndicator />
        <Text style={styles.startupTitle}>Eclipse Timer</Text>
        <Text style={styles.startupSubtitle}>{message}</Text>
      </View>
    </View>
  );
}

function toMenuRouteName(route: keyof RootStackParamList): MenuRouteName | null {
  if (route === "Landing" || route === "Timer") return route;
  if (route === "NotificationSettings" || route === "LocationSettings") return route;
  return null;
}

type FeaturedEclipseDeepLinkAction =
  | { type: "open_timer"; eclipseId: string }
  | { type: "open_preview"; eclipseId: string };

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

function TimerRoute({ navigation, catalog, onOpenMenu }: TimerRouteProps) {
  const { state, actions } = useAppState();
  const isFocused = useIsFocused();
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
      };

      navigation.navigate("Preview", { payload });
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
  const { state: appState, actions } = useAppState();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const pendingFeaturedDeepLinkActionRef = useRef<FeaturedEclipseDeepLinkAction | null>(null);
  const [catalog, setCatalog] = useState<EclipseRecord[] | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentRouteName, setCurrentRouteName] = useState<keyof RootStackParamList>("Landing");

  useNotificationScheduler(
    appState.notificationSettings,
    appState.eclipseReminderAnchors,
    appState.disabledEclipseAlarmIds,
  );

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const openMenu = useCallback(() => {
    setIsMenuOpen(true);
  }, []);

  const updateRouteName = useCallback(() => {
    const routeName = navigationRef.getCurrentRoute()?.name;
    if (!routeName) return;
    setCurrentRouteName(routeName);
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

  const handleIncomingUrl = useCallback(
    (url: string) => {
      const action = parseFeaturedEclipseDeepLink(url);
      if (!action) return false;

      if (!navigationRef.isReady()) {
        pendingFeaturedDeepLinkActionRef.current = action;
        return true;
      }

      runFeaturedDeepLinkAction(action);
      return true;
    },
    [navigationRef, runFeaturedDeepLinkAction],
  );

  const onNavigationReady = useCallback(() => {
    updateRouteName();
    const pendingAction = pendingFeaturedDeepLinkActionRef.current;
    if (!pendingAction) return;
    pendingFeaturedDeepLinkActionRef.current = null;
    runFeaturedDeepLinkAction(pendingAction);
  }, [runFeaturedDeepLinkAction, updateRouteName]);

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

  useEffect(() => {
    if (!isMenuOpen) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      closeMenu();
      return true;
    });
    return () => subscription.remove();
  }, [closeMenu, isMenuOpen]);

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
    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleIncomingUrl(url);
    });

    void Linking.getInitialURL()
      .then((url) => {
        if (!url) return;
        handleIncomingUrl(url);
      })
      .catch(() => {
        // Ignore URL parsing failures and allow default linking behavior.
      });

    return () => {
      subscription.remove();
    };
  }, [handleIncomingUrl]);

  if (!catalog) {
    return <StartupLoadingScreen message="Loading eclipse catalog..." />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      onReady={onNavigationReady}
      onStateChange={updateRouteName}
    >
      <View style={styles.navigationRoot}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Landing">
            {(props) => <LandingRoute {...props} catalog={catalog} onOpenMenu={openMenu} />}
          </Stack.Screen>
          <Stack.Screen name="Timer">
            {(props) => <TimerRoute {...props} catalog={catalog} onOpenMenu={openMenu} />}
          </Stack.Screen>
          <Stack.Screen name="Preview">
            {(props) => <PreviewRoute {...props} onOpenMenu={openMenu} />}
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
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  startupSafe: {
    flex: 1,
    backgroundColor: "#0b0b0b",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  startupCard: {
    width: "100%",
    borderRadius: 14,
    backgroundColor: "#121212",
    borderWidth: 1,
    borderColor: "#2b2b2b",
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
    color: "white",
    fontSize: 20,
    fontWeight: "800",
  },
  startupSubtitle: {
    color: "#bdbdbd",
    fontSize: 13,
  },
  navigationRoot: {
    flex: 1,
  },
});
