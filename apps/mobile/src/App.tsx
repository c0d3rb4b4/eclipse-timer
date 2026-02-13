import React, { useMemo } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { loadCatalog } from "@eclipse-timer/catalog";

import LandingScreen from "./screens/LandingScreen";
import TimerScreen from "./screens/TimerScreen";
import { useLandingEclipses } from "./hooks/useLandingEclipses";
import { useLandingScroll } from "./hooks/useLandingScroll";
import { useTimerState } from "./hooks/useTimerState";
import { AppStateProvider, useAppState } from "./state/appState";

function AppContent() {
  const { state, actions } = useAppState();
  const { screen, selectedLandingId, activeEclipseId } = state;
  const catalog = useMemo(() => loadCatalog(), []);
  const { landingEclipses, firstFutureIndex } = useLandingEclipses(catalog);
  const landingScroll = useLandingScroll({ screen, selectedLandingId });

  const activeEclipse = useMemo(
    () => catalog.find((e) => e.id === activeEclipseId) ?? null,
    [catalog, activeEclipseId]
  );

  const timerState = useTimerState(activeEclipse);

  const goToTimer = () => {
    if (!selectedLandingId) return;
    landingScroll.didAutoScrollRef.current = true;
    timerState.resetForNewEclipse();
    actions.goToTimer();
  };

  const goToLanding = () => actions.goToLanding();

  return (
    <>
      {screen === "landing" ? (
        <LandingScreen
          eclipses={landingEclipses}
          selectedId={selectedLandingId}
          onSelect={actions.selectLanding}
          onGo={goToTimer}
          firstFutureIndex={firstFutureIndex}
          scroll={landingScroll}
        />
      ) : (
        <TimerScreen activeEclipse={activeEclipse} onBack={goToLanding} timer={timerState} />
      )}
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <AppContent />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
