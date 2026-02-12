import React, { useMemo, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { loadCatalog } from "@eclipse-timer/catalog";

import LandingScreen from "./screens/LandingScreen";
import TimerScreen from "./screens/TimerScreen";
import { useLandingEclipses } from "./hooks/useLandingEclipses";
import { useLandingScroll } from "./hooks/useLandingScroll";
import { useTimerState } from "./hooks/useTimerState";

type AppScreen = "landing" | "timer";

export default function App() {
  const [screen, setScreen] = useState<AppScreen>("landing");
  const [selectedLandingId, setSelectedLandingId] = useState<string | null>(null);
  const [activeEclipseId, setActiveEclipseId] = useState<string | null>(null);

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
    setActiveEclipseId(selectedLandingId);
    setScreen("timer");
  };

  const goToLanding = () => setScreen("landing");

  return (
    <SafeAreaProvider>
      {screen === "landing" ? (
        <LandingScreen
          eclipses={landingEclipses}
          selectedId={selectedLandingId}
          onSelect={setSelectedLandingId}
          onGo={goToTimer}
          firstFutureIndex={firstFutureIndex}
          scroll={landingScroll}
        />
      ) : (
        <TimerScreen activeEclipse={activeEclipse} onBack={goToLanding} timer={timerState} />
      )}
    </SafeAreaProvider>
  );
}
