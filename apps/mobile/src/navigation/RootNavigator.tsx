import { useCallback, useEffect, useMemo, useState } from "react";
import { NavigationContainer, useFocusEffect, useIsFocused } from "@react-navigation/native";
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { enableScreens } from "react-native-screens";
import { ActivityIndicator, InteractionManager, StyleSheet, Text, View } from "react-native";

import { loadCatalog, loadCatalogEntryWithOverlays } from "@eclipse-timer/catalog";
import type { Circumstances, EclipseRecord } from "@eclipse-timer/shared";

import LandingScreen from "../screens/LandingScreen";
import EclipsePreviewScreen, { type PreviewPayload } from "../screens/EclipsePreviewScreen";
import TimerScreen from "../screens/TimerScreen";
import { useLandingEclipses } from "../hooks/useLandingEclipses";
import { useLandingScroll } from "../hooks/useLandingScroll";
import { useTimerState } from "../hooks/useTimerState";
import { useAppState } from "../state/appState";

enableScreens();

type RootStackParamList = {
  Landing: undefined;
  Timer: undefined;
  Preview: { payload: PreviewPayload };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type LandingRouteProps = NativeStackScreenProps<RootStackParamList, "Landing"> & {
  catalog: EclipseRecord[];
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
        <ActivityIndicator />
        <Text style={styles.startupTitle}>Eclipse Timer</Text>
        <Text style={styles.startupSubtitle}>{message}</Text>
      </View>
    </View>
  );
}

function LandingRoute({ navigation, catalog }: LandingRouteProps) {
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
      scroll={landingScroll}
    />
  );
}

function TimerRoute({ navigation }: NativeStackScreenProps<RootStackParamList, "Timer">) {
  const { state } = useAppState();
  const [activeEclipse, setActiveEclipse] = useState<EclipseRecord | null>(null);
  const [isActiveEclipseLoading, setIsActiveEclipseLoading] = useState(false);

  useEffect(() => {
    const eclipseId = state.activeEclipseId;
    if (!eclipseId) {
      setActiveEclipse(null);
      setIsActiveEclipseLoading(false);
      return;
    }

    let didCancel = false;
    setIsActiveEclipseLoading(true);

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

  const timerState = useTimerState(activeEclipse);

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

  return (
    <TimerScreen
      activeEclipse={activeEclipse}
      isActiveEclipseLoading={isActiveEclipseLoading}
      timer={timerState}
      onOpenPreview={openPreview}
    />
  );
}

function PreviewRoute({ navigation, route }: NativeStackScreenProps<RootStackParamList, "Preview">) {
  return <EclipsePreviewScreen payload={route.params.payload} onBack={() => navigation.goBack()} />;
}

export default function RootNavigator() {
  const [catalog, setCatalog] = useState<EclipseRecord[] | null>(null);

  useEffect(() => {
    let didCancel = false;

    const task = InteractionManager.runAfterInteractions(() => {
      if (didCancel) return;
      const loaded = loadCatalog();
      if (didCancel) return;
      setCatalog(loaded);
    });

    return () => {
      didCancel = true;
      task.cancel();
    };
  }, []);

  if (!catalog) {
    return <StartupLoadingScreen message="Loading eclipse catalog..." />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Landing">
          {(props) => <LandingRoute {...props} catalog={catalog} />}
        </Stack.Screen>
        <Stack.Screen name="Timer">{(props) => <TimerRoute {...props} />}</Stack.Screen>
        <Stack.Screen name="Preview">{(props) => <PreviewRoute {...props} />}</Stack.Screen>
      </Stack.Navigator>
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
  startupTitle: {
    color: "white",
    fontSize: 20,
    fontWeight: "800",
  },
  startupSubtitle: {
    color: "#bdbdbd",
    fontSize: 13,
  },
});
