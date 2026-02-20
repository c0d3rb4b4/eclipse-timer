import { computeCircumstances } from "@eclipse-timer/engine";
import type { Circumstances, EclipseRecord, Observer } from "@eclipse-timer/shared";
import * as Location from "expo-location";
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, InteractionManager } from "react-native";
import type MapView from "react-native-maps";
import type { Details, MapPressEvent, Region } from "react-native-maps";
import {
  type NotificationEntry,
  type NotificationMockTimeline,
  type NotificationSettings,
  notificationEntryId,
} from "../state/appState";
import {
  applyMockContactTimeline,
  buildContactItems,
  type ContactItem,
  type ContactKey,
  nextEventCountdownFromItems,
} from "../utils/contacts";
import {
  normalizeLongitude,
  overlayTuplesToCells,
  sanitizeDelta,
  sanitizeLatitude,
  sanitizeRegion,
} from "../utils/map";

type MapType3 = "standard" | "satellite" | "hybrid";

type AlarmState = Record<ContactKey, boolean>;

type Pin = { lat: number; lon: number; elevM: number };
type MarkerDragEndEvent = {
  nativeEvent: {
    coordinate: {
      latitude: number;
      longitude: number;
    };
  };
};

const GIBRALTAR: Pin = { lat: 36.1408, lon: -5.3536, elevM: 0 };
const MIN_REGION_DIFF = 0.00001;
const MIN_PIN_DIFF = 0.000001;
const EMPTY_ALARM_STATE: AlarmState = {
  c1: false,
  c2: false,
  max: false,
  c3: false,
  c4: false,
};

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

function hasMeaningfulPinChange(prev: Pin, next: Pin): boolean {
  return (
    Math.abs(prev.lat - next.lat) > MIN_PIN_DIFF || Math.abs(prev.lon - next.lon) > MIN_PIN_DIFF
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
  isResultCurrentForPin: boolean;
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
  resetForNewEclipse: () => void;
  setStatusMessage: (msg: string) => void;
};

export function useTimerState(
  activeEclipse: EclipseRecord | null,
  notificationSettings: NotificationSettings,
  notificationMockTimeline: NotificationMockTimeline,
  notificationEntries: NotificationEntry[],
  upsertNotificationEntry: (entry: NotificationEntry) => void,
  removeNotificationEntry: (id: string) => void,
): TimerState {
  const mapRef = useRef<MapView>(null);
  const [pin, setPin] = useState<Pin>({ lat: GIBRALTAR.lat, lon: GIBRALTAR.lon, elevM: 0 });
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
  const [resultPin, setResultPin] = useState<Pin | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [didComputeFlash, setDidComputeFlash] = useState(false);
  const [countdownNowMs, setCountdownNowMs] = useState(() => Date.now());
  const [mockTimelineAnchorMs, setMockTimelineAnchorMs] = useState(() => Date.now());
  const resultFlash = useRef(new Animated.Value(0)).current;
  const computeTaskRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(
    null,
  );
  const computeRunTokenRef = useRef(0);
  const lastAutoComputeKeyRef = useRef("");

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

  const contactItems = useMemo(() => {
    if (!result) return [];

    return applyMockContactTimeline(
      buildContactItems(result),
      notificationMockTimeline,
      mockTimelineAnchorMs,
    );
  }, [mockTimelineAnchorMs, notificationMockTimeline, result]);
  const notificationsEnabled = notificationSettings.eclipseAlerts;
  const nextEventCountdownText = useMemo(
    () =>
      contactItems.length
        ? nextEventCountdownFromItems(contactItems, countdownNowMs)
        : "No countdown available",
    [contactItems, countdownNowMs],
  );
  const autoComputeKey = useMemo(() => {
    if (!activeEclipse) return "";
    return `${activeEclipse.id}:${pin.lat.toFixed(6)}:${pin.lon.toFixed(6)}`;
  }, [activeEclipse, pin.lat, pin.lon]);
  const isResultCurrentForPin = useMemo(() => {
    if (!result || !resultPin) return false;
    return !hasMeaningfulPinChange(resultPin, pin);
  }, [pin, result, resultPin]);
  const alarmState = useMemo<AlarmState>(() => {
    if (!activeEclipse) return EMPTY_ALARM_STATE;
    const nextState: AlarmState = { ...EMPTY_ALARM_STATE };

    for (const entry of notificationEntries) {
      if (entry.eclipseId !== activeEclipse.id) continue;
      const key = entry.contactKey as ContactKey;
      if (!(key in nextState)) continue;
      nextState[key] = true;
    }

    return nextState;
  }, [activeEclipse, notificationEntries]);

  useEffect(() => {
    if (!result) return;
    setCountdownNowMs(Date.now());
    const intervalId = setInterval(() => setCountdownNowMs(Date.now()), 1000);
    return () => clearInterval(intervalId);
  }, [result]);

  useEffect(() => {
    setMockTimelineAnchorMs(Date.now());
  }, [
    activeEclipse?.id,
    notificationMockTimeline.enabled,
    notificationMockTimeline.firstContactOffsetMinutes,
    notificationMockTimeline.subsequentContactGapMinutes,
    result?.eclipseId,
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

  const jumpTo = (lat: number, lon: number, delta = 3, elevM = 0) => {
    const safeLat = sanitizeLatitude(lat);
    const safeLon = normalizeLongitude(lon);
    const safeDelta = sanitizeDelta(delta, 3);
    const nextPin: Pin = { lat: safeLat, lon: safeLon, elevM };
    const nextRegion: Region = {
      latitude: safeLat,
      longitude: safeLon,
      latitudeDelta: safeDelta,
      longitudeDelta: safeDelta,
    };

    const pinMoved = hasMeaningfulPinChange(pin, nextPin);
    if (pinMoved) {
      cancelPendingCompute();
      setIsComputing(false);
      setDidComputeFlash(false);
      if (isComputing || (resultPin && hasMeaningfulPinChange(resultPin, nextPin))) {
        setStatus("Pin moved. Recomputing...");
      }
    }

    setPin(nextPin);
    setRegion((r) => sanitizeRegion(nextRegion, r));

    mapRef.current?.animateToRegion(nextRegion, 450);
  };

  const movePinKeepZoom = (lat: number, lon: number) => {
    const safeLat = sanitizeLatitude(lat);
    const safeLon = normalizeLongitude(lon);
    const nextPin: Pin = { lat: safeLat, lon: safeLon, elevM: 0 };
    const pinMoved = hasMeaningfulPinChange(pin, nextPin);

    if (pinMoved) {
      cancelPendingCompute();
      setIsComputing(false);
      setDidComputeFlash(false);
      if (isComputing || (resultPin && hasMeaningfulPinChange(resultPin, nextPin))) {
        setStatus("Pin moved. Recomputing...");
      }
    }

    setPin(nextPin);
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
      const existing = await Location.getForegroundPermissionsAsync();
      if (existing.status !== "granted" && existing.canAskAgain) {
        const { isConfirmed } = await new Promise<{ isConfirmed: boolean }>((resolve) => {
          Alert.alert(
            "Location Access",
            "Eclipse Timer uses your location to compute precise eclipse contact times for where you are. Your location data stays on-device and is never sent to a server.",
            [
              { text: "Not Now", style: "cancel", onPress: () => resolve({ isConfirmed: false }) },
              { text: "Continue", onPress: () => resolve({ isConfirmed: true }) },
            ],
            { cancelable: true, onDismiss: () => resolve({ isConfirmed: false }) },
          );
        });
        if (!isConfirmed) {
          setStatus("Location permission declined");
          return;
        }
      }

      setStatus("Requesting location permission...");
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setStatus("Location permission denied");
        return;
      }

      setStatus("Getting location...");

      const last = await Location.getLastKnownPositionAsync();
      if (last?.coords) {
        const alt = last.coords.altitude ?? 0;
        jumpTo(last.coords.latitude, last.coords.longitude, 2, alt);
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
        const alt = current.coords.altitude ?? 0;
        jumpTo(current.coords.latitude, current.coords.longitude, 2, alt);
        setStatus("Pin set from GPS");
      } else if (!last) {
        setStatus("GPS timed out (try again or move near a window)");
      }
    } catch (err: unknown) {
      setStatus(`GPS error: ${getErrorMessage(err)}`);
    }
  };

  const runCompute = useCallback(() => {
    if (!activeEclipse) {
      setStatus("Select an eclipse from the landing page first");
      return;
    }

    const observer: Observer = { latDeg: pin.lat, lonDeg: pin.lon, elevM: pin.elevM };

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

        setMockTimelineAnchorMs(Date.now());
        setResult(out);
        setResultPin({ lat: observer.latDeg, lon: observer.lonDeg, elevM: observer.elevM ?? 0 });
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
        setResultPin(null);
      } finally {
        if (computeRunTokenRef.current !== runToken) return;
        computeTaskRef.current = null;
        setIsComputing(false);
      }
    });
  }, [activeEclipse, cancelPendingCompute, pin.lat, pin.lon, resultFlash]);

  useEffect(() => {
    if (!activeEclipse) return;
    if (result && isResultCurrentForPin) return;
    if (isComputing) return;
    if (!autoComputeKey) return;
    if (lastAutoComputeKeyRef.current === autoComputeKey) return;
    lastAutoComputeKeyRef.current = autoComputeKey;
    runCompute();
  }, [activeEclipse, autoComputeKey, isComputing, isResultCurrentForPin, result, runCompute]);

  useEffect(() => {
    if (!activeEclipse || !contactItems.length) return;

    const entriesById = new Map(notificationEntries.map((entry) => [entry.id, entry]));

    for (const item of contactItems) {
      const id = notificationEntryId(activeEclipse.id, item.key);
      const existing = entriesById.get(id);
      if (!existing) continue;

      if (!item.iso) {
        removeNotificationEntry(id);
        continue;
      }

      if (
        existing.iso === item.iso &&
        existing.contactLabel === item.label &&
        existing.eclipseDateYmd === activeEclipse.dateYmd &&
        existing.eclipseLabel === activeEclipse.id
      ) {
        continue;
      }

      upsertNotificationEntry({
        id,
        eclipseId: activeEclipse.id,
        eclipseDateYmd: activeEclipse.dateYmd,
        eclipseLabel: activeEclipse.id,
        contactKey: item.key,
        contactLabel: item.label,
        iso: item.iso,
      });
    }
  }, [
    activeEclipse,
    contactItems,
    notificationEntries,
    removeNotificationEntry,
    upsertNotificationEntry,
  ]);

  const toggleAlarm = useCallback(
    (key: ContactKey, enabled: boolean) => {
      if (!activeEclipse) return;
      const id = notificationEntryId(activeEclipse.id, key);

      if (!enabled) {
        removeNotificationEntry(id);
        return;
      }

      const contact = contactItems.find((item) => item.key === key);
      if (!contact?.iso) {
        setStatus("Cannot enable alarm yet because event time is unavailable.");
        return;
      }

      upsertNotificationEntry({
        id,
        eclipseId: activeEclipse.id,
        eclipseDateYmd: activeEclipse.dateYmd,
        eclipseLabel: activeEclipse.id,
        contactKey: key,
        contactLabel: contact.label,
        iso: contact.iso,
      });
    },
    [activeEclipse, contactItems, removeNotificationEntry, upsertNotificationEntry],
  );

  const resetForNewEclipse = useCallback(() => {
    cancelPendingCompute();
    setIsComputing(false);
    setDidComputeFlash(false);
    resultFlash.setValue(0);
    setResult(null);
    setResultPin(null);
    lastAutoComputeKeyRef.current = "";
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
    isResultCurrentForPin,
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
    resetForNewEclipse,
    setStatusMessage,
  };
}
