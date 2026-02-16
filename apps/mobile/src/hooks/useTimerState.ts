import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Alert, Animated, InteractionManager } from "react-native";
import type { Details, MapPressEvent, Region } from "react-native-maps";
import type MapView from "react-native-maps";
import * as Location from "expo-location";

import { computeCircumstances } from "@eclipse-timer/engine";
import type { Circumstances, EclipseRecord, Observer } from "@eclipse-timer/shared";

import {
  buildContactItems,
  nextEventCountdown,
  type ContactItem,
  type ContactKey,
} from "../utils/contacts";
import {
  normalizeLongitude,
  overlayTuplesToCells,
  sanitizeDelta,
  sanitizeLatitude,
  sanitizeRegion,
} from "../utils/map";
import type { NotificationSettings } from "../state/appState";
import {
  cancelManagedScheduledNotificationsAsync,
  rescheduleEclipseNotificationsAsync,
  scheduleTestNotificationAsync,
  type NotificationSchedulingSettings,
} from "../services/notifications";

type MapType3 = "standard" | "satellite" | "hybrid";

type AlarmState = Record<ContactKey, boolean>;

type Pin = { lat: number; lon: number };
type MarkerDragEndEvent = {
  nativeEvent: {
    coordinate: {
      latitude: number;
      longitude: number;
    };
  };
};

const GIBRALTAR = { lat: 36.1408, lon: -5.3536 };
const MIN_REGION_DIFF = 0.00001;

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function hasMeaningfulRegionChange(prev: Region, next: Region): boolean {
  return (
    Math.abs(prev.latitude - next.latitude) > MIN_REGION_DIFF ||
    Math.abs(prev.longitude - next.longitude) > MIN_REGION_DIFF ||
    Math.abs(prev.latitudeDelta - next.latitudeDelta) > MIN_REGION_DIFF ||
    Math.abs(prev.longitudeDelta - next.longitudeDelta) > MIN_REGION_DIFF
  );
}

export type TimerState = {
  mapRef: RefObject<MapView | null>;
  pin: Pin;
  region: Region;
  mapType: MapType3;
  showVisibleOverlay: boolean;
  showCentralOverlay: boolean;
  showDirectionsOverlay: boolean;
  status: string;
  result: Circumstances | null;
  isComputing: boolean;
  didComputeFlash: boolean;
  resultFlash: Animated.Value;
  overlayVisiblePolygons: ReturnType<typeof overlayTuplesToCells>;
  overlayCentralPolygons: ReturnType<typeof overlayTuplesToCells>;
  hasVisibleOverlayData: boolean;
  hasCentralOverlayData: boolean;
  alarmState: AlarmState;
  notificationsEnabled: boolean;
  contactItems: ContactItem[];
  nextEventCountdownText: string;
  onRegionChangeComplete: (r: Region, details?: Details) => void;
  cycleMapType: () => void;
  toggleVisibleOverlay: () => void;
  toggleCentralOverlay: () => void;
  toggleDirectionsOverlay: () => void;
  jumpTo: (lat: number, lon: number, delta?: number) => void;
  onMapPress: (e: MapPressEvent) => void;
  onDragEnd: (e: MarkerDragEndEvent) => void;
  useGps: () => Promise<void>;
  runCompute: () => void;
  toggleAlarm: (key: ContactKey, enabled: boolean) => void;
  runAlarmTest: () => void;
  resetForNewEclipse: () => void;
  setStatusMessage: (msg: string) => void;
};

function toSchedulingSettings(settings: NotificationSettings): NotificationSchedulingSettings {
  return {
    countdownAlerts: settings.countdownAlerts,
    vibrationEnabled: settings.vibrationEnabled,
    soundEnabled: settings.soundEnabled,
    remindOneHourBefore: settings.remindOneHourBefore,
    remindTenMinutesBefore: settings.remindTenMinutesBefore,
  };
}

export function useTimerState(
  activeEclipse: EclipseRecord | null,
  notificationSettings: NotificationSettings,
): TimerState {
  const mapRef = useRef<MapView>(null);
  const [pin, setPin] = useState<Pin>({ lat: GIBRALTAR.lat, lon: GIBRALTAR.lon });
  const [mapType, setMapType] = useState<MapType3>("standard");
  const [showVisibleOverlay, setShowVisibleOverlay] = useState(true);
  const [showCentralOverlay, setShowCentralOverlay] = useState(true);
  const [showDirectionsOverlay, setShowDirectionsOverlay] = useState(true);
  const [region, setRegion] = useState<Region>({
    latitude: sanitizeLatitude(pin.lat),
    longitude: normalizeLongitude(pin.lon),
    latitudeDelta: 8,
    longitudeDelta: 8,
  });
  const [status, setStatus] = useState("Ready");
  const [result, setResult] = useState<Circumstances | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [didComputeFlash, setDidComputeFlash] = useState(false);
  const [countdownNowMs, setCountdownNowMs] = useState(() => Date.now());
  const resultFlash = useRef(new Animated.Value(0)).current;
  const computeTaskRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(
    null,
  );
  const computeRunTokenRef = useRef(0);
  const [alarmState, setAlarmState] = useState<AlarmState>({
    c1: true,
    c2: true,
    max: true,
    c3: true,
    c4: true,
  });

  const overlayVisiblePolygons = useMemo(
    () => overlayTuplesToCells(activeEclipse?.overlayVisiblePolygons),
    [activeEclipse],
  );
  const overlayCentralPolygons = useMemo(
    () => overlayTuplesToCells(activeEclipse?.overlayCentralPolygons),
    [activeEclipse],
  );
  const hasVisibleOverlayData = overlayVisiblePolygons.length > 0;
  const hasCentralOverlayData = overlayCentralPolygons.length > 0;

  const contactItems = useMemo(() => (result ? buildContactItems(result) : []), [result]);
  const schedulingSettings = useMemo(
    () => toSchedulingSettings(notificationSettings),
    [notificationSettings],
  );
  const notificationsEnabled = notificationSettings.eclipseAlerts;
  const nextEventCountdownText = useMemo(
    () => (result ? nextEventCountdown(result, countdownNowMs) : "No countdown available"),
    [result, countdownNowMs],
  );

  useEffect(() => {
    if (!result) return;
    setCountdownNowMs(Date.now());
    const intervalId = setInterval(() => setCountdownNowMs(Date.now()), 1000);
    return () => clearInterval(intervalId);
  }, [result]);

  useEffect(() => {
    let didCancel = false;

    const syncNotifications = async () => {
      if (!notificationSettings.eclipseAlerts) {
        await cancelManagedScheduledNotificationsAsync();
        return;
      }
      if (!activeEclipse || !result) return;

      const outcome = await rescheduleEclipseNotificationsAsync({
        eclipseId: activeEclipse.id,
        eclipseDateYmd: activeEclipse.dateYmd,
        settings: schedulingSettings,
        contacts: contactItems.map((item) => ({
          key: item.key,
          label: item.label,
          iso: item.iso,
          enabled: alarmState[item.key],
        })),
      });

      if (didCancel) return;
      if (!outcome.permissionGranted) {
        setStatus("Notification permission denied");
      }
    };

    void syncNotifications();

    return () => {
      didCancel = true;
    };
  }, [
    activeEclipse,
    alarmState,
    contactItems,
    notificationSettings.eclipseAlerts,
    result,
    schedulingSettings,
  ]);

  const cancelPendingCompute = useCallback(() => {
    computeRunTokenRef.current += 1;
    const task = computeTaskRef.current;
    computeTaskRef.current = null;
    task?.cancel();
  }, []);

  useEffect(
    () => () => {
      cancelPendingCompute();
    },
    [cancelPendingCompute],
  );

  const onRegionChangeComplete = useCallback((r: Region, details?: Details) => {
    if (details?.isGesture === false) return;
    setRegion((prev) => {
      const next = sanitizeRegion(r, prev);
      return hasMeaningfulRegionChange(prev, next) ? next : prev;
    });
  }, []);

  const cycleMapType = () => {
    setMapType((m) => (m === "standard" ? "satellite" : m === "satellite" ? "hybrid" : "standard"));
  };
  const toggleVisibleOverlay = () => {
    setShowVisibleOverlay((prev) => !prev);
  };
  const toggleCentralOverlay = () => {
    setShowCentralOverlay((prev) => !prev);
  };
  const toggleDirectionsOverlay = () => {
    setShowDirectionsOverlay((prev) => !prev);
  };

  const jumpTo = (lat: number, lon: number, delta = 3) => {
    const safeLat = sanitizeLatitude(lat);
    const safeLon = normalizeLongitude(lon);
    const safeDelta = sanitizeDelta(delta, 3);
    const nextRegion: Region = {
      latitude: safeLat,
      longitude: safeLon,
      latitudeDelta: safeDelta,
      longitudeDelta: safeDelta,
    };

    setPin({ lat: safeLat, lon: safeLon });
    setRegion((r) => sanitizeRegion(nextRegion, r));

    mapRef.current?.animateToRegion(nextRegion, 450);
  };

  const movePinKeepZoom = (lat: number, lon: number) => {
    const safeLat = sanitizeLatitude(lat);
    const safeLon = normalizeLongitude(lon);
    setPin({ lat: safeLat, lon: safeLon });
    setRegion((r) => ({ ...sanitizeRegion(r), latitude: safeLat, longitude: safeLon }));
  };

  const onMapPress = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    movePinKeepZoom(latitude, longitude);
  };

  const onDragEnd = (e: MarkerDragEndEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    movePinKeepZoom(latitude, longitude);
  };

  const useGps = async () => {
    try {
      setStatus("Requesting location permission...");
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setStatus("Location permission denied");
        return;
      }

      setStatus("Getting location...");

      const last = await Location.getLastKnownPositionAsync();
      if (last?.coords) {
        jumpTo(last.coords.latitude, last.coords.longitude, 2);
        setStatus("Pin set from last known location");
      }

      const timeoutMs = 5000;

      const currentPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const timeoutPromise: Promise<null> = new Promise((resolve) =>
        setTimeout(() => resolve(null), timeoutMs),
      );

      const current = await Promise.race<Location.LocationObject | null>([
        currentPromise,
        timeoutPromise,
      ]);

      if (current?.coords) {
        jumpTo(current.coords.latitude, current.coords.longitude, 2);
        setStatus("Pin set from GPS");
      } else if (!last) {
        setStatus("GPS timed out (try again or move near a window)");
      }
    } catch (err: unknown) {
      setStatus(`GPS error: ${getErrorMessage(err)}`);
    }
  };

  const runCompute = () => {
    if (!activeEclipse) {
      setStatus("Select an eclipse from the landing page first");
      return;
    }

    const observer: Observer = { latDeg: pin.lat, lonDeg: pin.lon, elevM: 0 };

    cancelPendingCompute();
    const runToken = computeRunTokenRef.current;

    setIsComputing(true);
    setDidComputeFlash(false);
    setStatus(`Queueing compute for ${pin.lat.toFixed(4)}, ${pin.lon.toFixed(4)}...`);

    computeTaskRef.current = InteractionManager.runAfterInteractions(() => {
      if (computeRunTokenRef.current !== runToken) return;
      setStatus(`Computing for ${pin.lat.toFixed(4)}, ${pin.lon.toFixed(4)}...`);

      try {
        const out = computeCircumstances(activeEclipse, observer);
        if (computeRunTokenRef.current !== runToken) return;

        setResult(out);
        setStatus("Computed");

        resultFlash.setValue(0);
        Animated.sequence([
          Animated.timing(resultFlash, { toValue: 1, duration: 160, useNativeDriver: true }),
          Animated.timing(resultFlash, { toValue: 0, duration: 420, useNativeDriver: true }),
        ]).start();

        setDidComputeFlash(true);
        setTimeout(() => setDidComputeFlash(false), 800);
      } catch (err: unknown) {
        if (computeRunTokenRef.current !== runToken) return;
        setStatus(`Compute error: ${getErrorMessage(err)}`);
        setResult(null);
      } finally {
        if (computeRunTokenRef.current !== runToken) return;
        computeTaskRef.current = null;
        setIsComputing(false);
      }
    });
  };

  const toggleAlarm = (key: ContactKey, enabled: boolean) => {
    setAlarmState((prev) => ({ ...prev, [key]: enabled }));
  };

  const runAlarmTest = () => {
    if (!notificationSettings.eclipseAlerts) {
      setStatus("Enable Eclipse Event Alerts in Notification Settings first");
      Alert.alert("Test Alarm", "Enable Eclipse Event Alerts in Notification Settings first.");
      return;
    }

    void scheduleTestNotificationAsync(schedulingSettings)
      .then((outcome) => {
        if (!outcome.ok) {
          if (outcome.reason === "permission_denied") {
            setStatus("Notification permission denied");
            Alert.alert(
              "Test Alarm",
              "Notifications are blocked by system permissions. Enable them in device settings.",
            );
            return;
          }

          setStatus("Failed to schedule test notification");
          Alert.alert("Test Alarm", "Failed to schedule a test notification.");
          return;
        }

        const hh = String(outcome.fireDate.getHours()).padStart(2, "0");
        const mm = String(outcome.fireDate.getMinutes()).padStart(2, "0");
        const ss = String(outcome.fireDate.getSeconds()).padStart(2, "0");
        setStatus(`Test notification scheduled for ${hh}:${mm}:${ss}`);
        Alert.alert("Test Alarm", `Notification scheduled for ${hh}:${mm}:${ss}.`);
      })
      .catch(() => {
        setStatus("Failed to schedule test notification");
        Alert.alert("Test Alarm", "Failed to schedule a test notification.");
      });
  };

  const resetForNewEclipse = useCallback(() => {
    cancelPendingCompute();
    setIsComputing(false);
    setDidComputeFlash(false);
    resultFlash.setValue(0);
    setResult(null);
    setStatus("Ready");
  }, [cancelPendingCompute, resultFlash]);

  const setStatusMessage = useCallback((msg: string) => {
    setStatus(msg);
  }, []);

  return {
    mapRef,
    pin,
    region,
    mapType,
    showVisibleOverlay,
    showCentralOverlay,
    showDirectionsOverlay,
    status,
    result,
    isComputing,
    didComputeFlash,
    resultFlash,
    overlayVisiblePolygons,
    overlayCentralPolygons,
    hasVisibleOverlayData,
    hasCentralOverlayData,
    alarmState,
    notificationsEnabled,
    contactItems,
    nextEventCountdownText,
    onRegionChangeComplete,
    cycleMapType,
    toggleVisibleOverlay,
    toggleCentralOverlay,
    toggleDirectionsOverlay,
    jumpTo,
    onMapPress,
    onDragEnd,
    useGps,
    runCompute,
    toggleAlarm,
    runAlarmTest,
    resetForNewEclipse,
    setStatusMessage,
  };
}
