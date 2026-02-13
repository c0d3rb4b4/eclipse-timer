import { useCallback, useMemo } from "react";
import { NavigationContainer, useFocusEffect, useIsFocused } from "@react-navigation/native";
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { enableScreens } from "react-native-screens";

import { loadCatalog, loadCatalogEntryWithOverlays } from "@eclipse-timer/catalog";
import type { EclipseRecord } from "@eclipse-timer/shared";

import LandingScreen from "../screens/LandingScreen";
import TimerScreen from "../screens/TimerScreen";
import { useLandingEclipses } from "../hooks/useLandingEclipses";
import { useLandingScroll } from "../hooks/useLandingScroll";
import { useTimerState } from "../hooks/useTimerState";
import { useAppState } from "../state/appState";

enableScreens();

type RootStackParamList = {
  Landing: undefined;
  Timer: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type LandingRouteProps = NativeStackScreenProps<RootStackParamList, "Landing"> & {
  catalog: EclipseRecord[];
};

function LandingRoute({ navigation, catalog }: LandingRouteProps) {
  const { state, actions } = useAppState();
  const isFocused = useIsFocused();
  const { landingEclipses, firstFutureIndex } = useLandingEclipses(catalog);
  const selectedIndex = useMemo(
    () =>
      state.selectedLandingId
        ? landingEclipses.findIndex((item) => item.id === state.selectedLandingId)
        : -1,
    [landingEclipses, state.selectedLandingId],
  );
  const landingScroll = useLandingScroll({
    isFocused,
    selectedIndex,
    firstFutureIndex,
  });

  const goToTimer = () => {
    if (!state.selectedLandingId) return;
    landingScroll.didAutoScrollRef.current = true;
    actions.activateSelected();
    navigation.navigate("Timer");
  };

  return (
    <LandingScreen
      eclipses={landingEclipses}
      selectedId={state.selectedLandingId}
      onSelect={actions.selectLanding}
      onGo={goToTimer}
      scroll={landingScroll}
    />
  );
}

function TimerRoute(_props: NativeStackScreenProps<RootStackParamList, "Timer">) {
  const { state } = useAppState();
  const activeEclipse = useMemo(
    () =>
      state.activeEclipseId ? (loadCatalogEntryWithOverlays(state.activeEclipseId) ?? null) : null,
    [state.activeEclipseId],
  );
  const timerState = useTimerState(activeEclipse);

  useFocusEffect(
    useCallback(() => {
      timerState.resetForNewEclipse();
    }, [timerState.resetForNewEclipse, state.activeEclipseId]),
  );

  return <TimerScreen activeEclipse={activeEclipse} timer={timerState} />;
}

export default function RootNavigator() {
  const catalog = useMemo(() => loadCatalog(), []);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Landing">
          {(props) => <LandingRoute {...props} catalog={catalog} />}
        </Stack.Screen>
        <Stack.Screen name="Timer">{(props) => <TimerRoute {...props} />}</Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
