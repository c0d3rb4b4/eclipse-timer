import * as Speech from "expo-speech";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import {
  createInAppAlarmEngine,
  type InAppAlarmEngine,
  type InAppAlarmEvent,
} from "../services/inAppAlarmEngine";
import type { NotificationEntry } from "../state/appState";

type UseInAppAlarmEngineInput = {
  isRouteFocused: boolean;
  activeEclipseId: string | null;
  isActiveEclipseAlarmEnabled: boolean;
  notificationEntries: NotificationEntry[];
  alarmLeadSecondsA1: number;
  alarmCountdownStartSecondsA2: number;
};

function buildEventEntries(
  activeEclipseId: string | null,
  notificationEntries: NotificationEntry[],
): InAppAlarmEvent[] {
  if (!activeEclipseId) return [];

  return notificationEntries
    .filter((entry) => entry.eclipseId === activeEclipseId)
    .map((entry) => {
      const eventMs = Date.parse(entry.iso);
      if (!Number.isFinite(eventMs)) return null;
      return {
        id: entry.id,
        eclipseId: entry.eclipseId,
        contactKey: entry.contactKey,
        contactLabel: entry.contactLabel,
        eventIso: entry.iso,
        eventMs,
      } as InAppAlarmEvent;
    })
    .filter((entry): entry is InAppAlarmEvent => !!entry);
}

export function useInAppAlarmEngine({
  isRouteFocused,
  activeEclipseId,
  isActiveEclipseAlarmEnabled,
  notificationEntries,
  alarmLeadSecondsA1,
  alarmCountdownStartSecondsA2,
}: UseInAppAlarmEngineInput) {
  const [isAppActive, setIsAppActive] = useState(() => AppState.currentState === "active");
  const engineRef = useRef<InAppAlarmEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = createInAppAlarmEngine({
      speak: (text) => void Speech.speak(text),
    });
  }

  const events = useMemo(
    () => buildEventEntries(activeEclipseId, notificationEntries),
    [activeEclipseId, notificationEntries],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      setIsAppActive(nextState === "active");
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const enabled = isRouteFocused && isAppActive && isActiveEclipseAlarmEnabled;
    engineRef.current?.arm({
      enabled,
      events,
      alarmLeadSecondsA1,
      alarmCountdownStartSecondsA2,
    });
  }, [
    alarmCountdownStartSecondsA2,
    alarmLeadSecondsA1,
    events,
    isActiveEclipseAlarmEnabled,
    isAppActive,
    isRouteFocused,
  ]);

  useEffect(
    () => () => {
      engineRef.current?.dispose();
      void Speech.stop();
    },
    [],
  );
}
