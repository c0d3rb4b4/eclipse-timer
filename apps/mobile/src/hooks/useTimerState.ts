import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Alert, Animated, InteractionManager, Vibration } from "react-native";
import type { MapPressEvent, Region } from "react-native-maps";
import type MapView from "react-native-maps";
import * as Location from "expo-location";

import { computeCircumstances } from "@eclipse-timer/engine";
import type { Circumstances, EclipseRecord, Observer } from "@eclipse-timer/shared";

import { buildContactItems, nextEventCountdown, type ContactItem, type ContactKey } from "../utils/contacts";
import { normalizeLongitude, overlayTuplesToCells, sanitizeDelta, sanitizeLatitude, sanitizeRegion } from "../utils/map";

type MapType3 = "standard" | "satellite" | "hybrid";

type AlarmState = Record<ContactKey, boolean>;

type Pin = { lat: number; lon: number };

const GIBRALTAR = { lat: 36.1408, lon: -5.3536 };

export type TimerState = {
  mapRef: RefObject<MapView | null>;
  pin: Pin;
  region: Region;
  mapType: MapType3;
  status: string;
  result: Circumstances | null;
  isComputing: boolean;
  didComputeFlash: boolean;
  resultFlash: Animated.Value;
  overlayVisiblePolygons: ReturnType<typeof overlayTuplesToCells>;
  overlayCentralPolygons: ReturnType<typeof overlayTuplesToCells>;
  hasOverlayData: boolean;
  alarmState: AlarmState;
  contactItems: ContactItem[];
  nextEventCountdownText: string;
  onRegionChangeComplete: (r: Region) => void;
  cycleMapType: () => void;
  jumpTo: (lat: number, lon: number, delta?: number) => void;
  onMapPress: (e: MapPressEvent) => void;
  onDragEnd: (e: any) => void;
  useGps: () => Promise<void>;
  runCompute: () => void;
  toggleAlarm: (key: ContactKey, enabled: boolean) => void;
  runAlarmTest: () => void;
  resetForNewEclipse: () => void;
  setStatusMessage: (msg: string) => void;
};

export function useTimerState(activeEclipse: EclipseRecord | null): TimerState {
  const mapRef = useRef<MapView>(null);
  const [pin, setPin] = useState<Pin>({ lat: GIBRALTAR.lat, lon: GIBRALTAR.lon });
  const [mapType, setMapType] = useState<MapType3>("standard");
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
  const computeTaskRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);
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
    [activeEclipse]
  );
  const overlayCentralPolygons = useMemo(
    () => overlayTuplesToCells(activeEclipse?.overlayCentralPolygons),
    [activeEclipse]
  );
  const hasOverlayData = overlayVisiblePolygons.length > 0 || overlayCentralPolygons.length > 0;

  const contactItems = useMemo(() => (result ? buildContactItems(result) : []), [result]);
  const nextEventCountdownText = useMemo(
    () => (result ? nextEventCountdown(result, countdownNowMs) : "No countdown available"),
    [result, countdownNowMs]
  );

  useEffect(() => {
    if (!result) return;
    setCountdownNowMs(Date.now());
    const intervalId = setInterval(() => setCountdownNowMs(Date.now()), 1000);
    return () => clearInterval(intervalId);
  }, [result]);

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
    [cancelPendingCompute]
  );

  const onRegionChangeComplete = (r: Region) => {
    setRegion((prev) => sanitizeRegion(r, prev));
  };

  const cycleMapType = () => {
    setMapType((m) => (m === "standard" ? "satellite" : m === "satellite" ? "hybrid" : "standard"));
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

  const onDragEnd = (e: any) => {
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

      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), timeoutMs)
      );

      const current = (await Promise.race([currentPromise, timeoutPromise])) as any;

      if (current?.coords) {
        jumpTo(current.coords.latitude, current.coords.longitude, 2);
        setStatus("Pin set from GPS");
      } else if (!last) {
        setStatus("GPS timed out (try again or move near a window)");
      }
    } catch (err: any) {
      setStatus(`GPS error: ${err?.message ?? String(err)}`);
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
      } catch (err: any) {
        if (computeRunTokenRef.current !== runToken) return;
        setStatus(`Compute error: ${err?.message ?? String(err)}`);
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
    if (!result) {
      setStatus("Compute first to test alarms");
      Alert.alert("Test Alarm", "Compute first to test alarms.");
      return;
    }

    const enabledItems = buildContactItems(result).filter((item) => alarmState[item.key]);
    if (!enabledItems.length) {
      setStatus("Alarm test skipped: no alarms enabled");
      Alert.alert("Test Alarm", "No alarms are enabled.");
      return;
    }

    const target = enabledItems.find((item) => !!item.iso) ?? enabledItems[0]!;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    setStatus(`Test alarm fired: ${target.label} at ${hh}:${mm}:${ss}`);
    Alert.alert("Test Alarm", `${target.label}\n${hh}:${mm}:${ss}`);
    Vibration.vibrate([0, 250, 120, 250]);
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
    status,
    result,
    isComputing,
    didComputeFlash,
    resultFlash,
    overlayVisiblePolygons,
    overlayCentralPolygons,
    hasOverlayData,
    alarmState,
    contactItems,
    nextEventCountdownText,
    onRegionChangeComplete,
    cycleMapType,
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
