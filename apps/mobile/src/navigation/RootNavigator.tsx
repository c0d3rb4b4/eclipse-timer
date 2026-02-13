import React, { useCallback, useMemo } from "react";
import { NavigationContainer, useFocusEffect, useIsFocused } from "@react-navigation/native";
import { createNativeStackNavigator, type NativeStackScreenProps } from "@react-navigation/native-stack";
import { enableScreens } from "react-native-screens";

import { loadCatalog } from "@eclipse-timer/catalog";
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

type TimerRouteProps = NativeStackScreenProps<RootStackParamList, "Timer"> & {
  catalog: EclipseRecord[];
};

function LandingRoute({ navigation, catalog }: LandingRouteProps) {
  const { state, actions } = useAppState();
  const isFocused = useIsFocused();
  const { landingEclipses, firstFutureIndex } = useLandingEclipses(catalog);
  const landingScroll = useLandingScroll({
    isFocused,
    selectedLandingId: state.selectedLandingId,
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
      firstFutureIndex={firstFutureIndex}
      scroll={landingScroll}
    />
  );
}

function TimerRoute({ catalog }: TimerRouteProps) {
  const { state } = useAppState();
  const activeEclipse = useMemo(
    () => catalog.find((e) => e.id === state.activeEclipseId) ?? null,
    [catalog, state.activeEclipseId]
  );
  const timerState = useTimerState(activeEclipse);

  useFocusEffect(
    useCallback(() => {
      timerState.resetForNewEclipse();
    }, [timerState.resetForNewEclipse, state.activeEclipseId])
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
        <Stack.Screen name="Timer">
          {(props) => <TimerRoute {...props} catalog={catalog} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
