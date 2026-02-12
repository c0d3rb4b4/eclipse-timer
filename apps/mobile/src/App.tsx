import React, { useMemo, useRef, useState } from "react";
import { SafeAreaView, View, Text, Pressable, ScrollView, StyleSheet, Platform, Switch } from "react-native";
import MapView, { Marker, MapPressEvent, Region } from "react-native-maps";
import * as Location from "expo-location";
import { Animated, ActivityIndicator } from "react-native";

import { loadCatalog } from "@eclipse-timer/catalog";
import { computeCircumstances } from "@eclipse-timer/engine";
import type { Circumstances, Observer, EclipseRecord } from "@eclipse-timer/shared";

const GIBRALTAR = { lat: 36.1408, lon: -5.3536 };
const CENTRAL_1000 = { lat: 26 + 53.3 / 60, lon: 31 + 0.8 / 60 };
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type ContactKey = "c1" | "c2" | "max" | "c3" | "c4";
type AlarmState = Record<ContactKey, boolean>;
type ContactItem = {
  key: ContactKey;
  label: string;
  iso?: string;
};

function fmtUtcHuman(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  const yyyy = d.getUTCFullYear();
  const mon = MONTHS_SHORT[d.getUTCMonth()];
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${mon} ${dd}, ${yyyy} ${hh}:${mm}:${ss} UTC`;
}

function buildContactItems(c: Circumstances): ContactItem[] {
  if (c.kindAtLocation === "total") {
    return [
      { key: "c1", label: "Partial Eclipse Starts (C1)", iso: c.c1Utc },
      { key: "c2", label: "Totality Starts (C2)", iso: c.c2Utc },
      { key: "c3", label: "Totality Ends (C3)", iso: c.c3Utc },
      { key: "c4", label: "Partial Eclipse Ends (C4)", iso: c.c4Utc },
    ];
  }

  return [
    { key: "c1", label: "First Contact (C1)", iso: c.c1Utc },
    { key: "c2", label: "Second Contact (C2)", iso: c.c2Utc },
    { key: "max", label: "Maximum Eclipse", iso: c.maxUtc },
    { key: "c3", label: "Third Contact (C3)", iso: c.c3Utc },
    { key: "c4", label: "Fourth Contact (C4)", iso: c.c4Utc },
  ];
}

function nextEventCountdown(c: Circumstances) {
  const now = Date.now();
  const events = buildContactItems(c)
    .map((item) => {
      if (!item.iso) return null;
      const t = Date.parse(item.iso);
      if (!Number.isFinite(t)) return null;
      return { label: item.label, t };
    })
    .filter((e): e is { label: string; t: number } => !!e);

  const future = events.filter((e) => e.t > now).sort((a, b) => a.t - b.t)[0];
  if (!future) return "No upcoming contact time (for this eclipse)";

  const diffSec = Math.max(0, Math.floor((future.t - now) / 1000));
  const hh = Math.floor(diffSec / 3600);
  const mm = Math.floor((diffSec % 3600) / 60);
  const ss = diffSec % 60;

  return `Next: ${future.label} in ${hh}h ${mm}m ${ss}s`;
}

export default function App() {
  const mapRef = useRef<MapView>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [didComputeFlash, setDidComputeFlash] = useState(false);

  const resultFlash = useRef(new Animated.Value(0)).current; // 0..1

  const catalog = useMemo(() => loadCatalog(), []);
  const eclipse: EclipseRecord | undefined = catalog[0]; // MVP: first eclipse

  const [pin, setPin] = useState({ lat: GIBRALTAR.lat, lon: GIBRALTAR.lon });

  type MapType3 = "standard" | "satellite" | "hybrid";
  const [mapType, setMapType] = useState<MapType3>("standard");

  const cycleMapType = () => {
    setMapType((m) => (m === "standard" ? "satellite" : m === "satellite" ? "hybrid" : "standard"));
  };

  const jumpTo = (lat: number, lon: number, delta = 3) => {
    setPin({ lat, lon });
    setRegion((r) => ({
      ...r,
      latitude: lat,
      longitude: lon,
      latitudeDelta: delta,
      longitudeDelta: delta,
    }));

    // Imperative nudge (fixes “press twice”)
    mapRef.current?.animateToRegion(
      {
        latitude: lat,
        longitude: lon,
        latitudeDelta: delta,
        longitudeDelta: delta,
      },
      450
    );
  };

  const [region, setRegion] = useState<Region>({
    latitude: pin.lat,
    longitude: pin.lon,
    latitudeDelta: 8,
    longitudeDelta: 8,
  });

  const [status, setStatus] = useState("Ready");
  const [result, setResult] = useState<Circumstances | null>(null);
  const [alarmState, setAlarmState] = useState<AlarmState>({
    c1: true,
    c2: true,
    max: true,
    c3: true,
    c4: true,
  });

  const setPinAndRegion = (lat: number, lon: number, zoomDelta?: number) => {
    setPin({ lat, lon });
    setRegion((r) => ({
      ...r,
      latitude: lat,
      longitude: lon,
      ...(zoomDelta
        ? { latitudeDelta: zoomDelta, longitudeDelta: zoomDelta }
        : {}), // <-- IMPORTANT: don't touch deltas
    }));
  };

  const movePinKeepZoom = (lat: number, lon: number) => {
    setPin({ lat, lon });
    setRegion((r) => ({ ...r, latitude: lat, longitude: lon }));
  };

  const onMapPress = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    movePinKeepZoom(latitude, longitude);
  };

  const onDragEnd = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    movePinKeepZoom(latitude, longitude);
  };

  const useGps = async () => {
    try {
      setStatus("Requesting location permission…");
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setStatus("Location permission denied");
        return;
      }

      setStatus("Getting location…");

      // 1) Instant-ish: last known
      const last = await Location.getLastKnownPositionAsync();
      if (last?.coords) {
        jumpTo(last.coords.latitude, last.coords.longitude, 2);
        setStatus("Pin set from last known location");
      }

      // 2) Better fix: current position, but don’t wait forever
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
    if (!eclipse) {
      setStatus("No eclipse in catalog");
      return;
    }

    const observer: Observer = { latDeg: pin.lat, lonDeg: pin.lon, elevM: 0 };

    setIsComputing(true);
    setDidComputeFlash(false);
    setStatus(`Computing for ${pin.lat.toFixed(4)}, ${pin.lon.toFixed(4)}…`);

    try {
      const out = computeCircumstances(eclipse, observer);
      setResult(out);
      setStatus("Computed");

      // Flash the results card
      resultFlash.setValue(0);
      Animated.sequence([
        Animated.timing(resultFlash, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(resultFlash, { toValue: 0, duration: 420, useNativeDriver: true }),
      ]).start();

      // Briefly show “Done” state on button
      setDidComputeFlash(true);
      setTimeout(() => setDidComputeFlash(false), 800);
    } catch (err: any) {
      setStatus(`Compute error: ${err?.message ?? String(err)}`);
      setResult(null);
    } finally {
      setIsComputing(false);
    }
  };

  const toggleAlarm = (key: ContactKey, enabled: boolean) => {
    setAlarmState((prev) => ({ ...prev, [key]: enabled }));
  };

  const contactItems = result ? buildContactItems(result) : [];
  const isTotality = result?.kindAtLocation === "total";


  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Eclipse Timer (MVP)</Text>
        <Text style={styles.subtitle}>
          {eclipse ? `${eclipse.id} • ${eclipse.dateYmd}` : "No eclipse loaded"}
        </Text>
      </View>

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={styles.map}
          region={region}
          onRegionChangeComplete={(r) => setRegion(r)}
          onPress={onMapPress}
          mapType={mapType}
        >
          <Marker
            coordinate={{ latitude: pin.lat, longitude: pin.lon }}
            draggable
            onDragEnd={onDragEnd}
            title="Observer"
            description={`${pin.lat.toFixed(4)}, ${pin.lon.toFixed(4)}`}
          />
        </MapView>

        {/* Overlay: map type toggle */}
        <Pressable style={styles.mapOverlayBtn} onPress={cycleMapType}>
          <Text style={styles.mapOverlayBtnText}>
            {mapType === "standard" ? "Standard" : mapType === "satellite" ? "Satellite" : "Hybrid"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.controls}>
        <View style={styles.btnRow}>
          <Pressable style={styles.btn} onPress={useGps}>
            <Text style={styles.btnText}>Use GPS</Text>
          </Pressable>

          <Pressable style={styles.btn} onPress={() => jumpTo(GIBRALTAR.lat, GIBRALTAR.lon, 3)}>
            <Text style={styles.btnText}>Gibraltar</Text>
          </Pressable>

          <Pressable style={styles.btn} onPress={() => jumpTo(CENTRAL_1000.lat, CENTRAL_1000.lon, 3)}>
            <Text style={styles.btnText}>Central 10:00</Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.computeBtn, isComputing ? styles.computeBtnDisabled : null]}
          onPress={runCompute}
          disabled={isComputing}
        >
          <View style={styles.computeBtnInner}>
            {isComputing ? <ActivityIndicator /> : null}
            <Text style={styles.computeBtnText}>
              {isComputing ? "Computing…" : didComputeFlash ? "Done" : "Compute"}
            </Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.statusBar}>
        <Text style={styles.statusText}>{status}</Text>
      </View>

      <ScrollView style={styles.results}>
        <Animated.View
          style={[
            styles.card,
            {
              transform: [
                {
                  scale: resultFlash.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.02],
                  }),
                },
              ],
              opacity: resultFlash.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.92],
              }),
            },
          ]}
        >
          <Text style={styles.cardTitle}>Results</Text>
          {!result ? (
            <Text style={styles.muted}>Press Compute to run the engine.</Text>
          ) : (
            <>
              <View style={styles.summaryGrid}>
                <Text style={styles.summaryItem}>Visible: {result.visible ? "Yes" : "No"}</Text>
                <Text style={styles.summaryItem}>Kind: {result.kindAtLocation}</Text>
                <Text style={styles.summaryItem}>
                  Magnitude: {typeof result.magnitude === "number" ? result.magnitude.toFixed(3) : "—"}
                </Text>
                <Text style={styles.summaryItem}>Totality: {isTotality ? "Yes" : "No"}</Text>
              </View>

              <View style={styles.sep} />

              {contactItems.map((item) => (
                <View style={styles.contactRow} key={item.key}>
                  <View style={styles.contactMain}>
                    <Text style={styles.contactLabel}>{item.label}</Text>
                    <Text style={styles.contactTime}>{fmtUtcHuman(item.iso)}</Text>
                  </View>
                  <View style={styles.contactAlarm}>
                    <Text style={styles.alarmLabel}>Alarm</Text>
                    <Switch
                      value={alarmState[item.key]}
                      onValueChange={(enabled) => toggleAlarm(item.key, enabled)}
                      disabled={!item.iso}
                    />
                  </View>
                </View>
              ))}

              <View style={styles.sep} />

              <Text style={styles.row}>{nextEventCountdown(result)}</Text>

              <View style={styles.sep} />
              <Text style={styles.cardTitle}>Debug</Text>
              <Text style={styles.mono}>
                {`Selected pin: lat ${pin.lat.toFixed(6)}, lon ${pin.lon.toFixed(6)}`}
              </Text>
              {result._debug ? <Text style={styles.mono}>{JSON.stringify(result._debug, null, 2)}</Text> : null}
            </>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0b0b" },
  header: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 },
  title: { color: "white", fontSize: 18, fontWeight: "700" },
  subtitle: { color: "#bdbdbd", fontSize: 12 },

  mapWrap: { height: 260, marginHorizontal: 12, borderRadius: 12, overflow: "hidden" },
  map: { flex: 1 },

  computeBtnDisabled: {
    opacity: 0.75,
  },

  computeBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  controls: {
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 10,
  },
  btnRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  computeBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#2c3cff",
    alignItems: "center",
    justifyContent: "center",
  },
  computeBtnText: {
    color: "white",
    fontWeight: "800",
    fontSize: 16,
  },

  mapOverlayBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  mapOverlayBtnText: {
    color: "white",
    fontWeight: "700",
    fontSize: 12,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#1f1f1f",
  },
  btnPrimary: { backgroundColor: "#2c3cff" },
  btnText: { color: "white", fontWeight: "600" },

  statusBar: { paddingHorizontal: 12, paddingTop: 8 },
  statusText: { color: "#bdbdbd", fontSize: 12 },

  results: { flex: 1, paddingHorizontal: 12, paddingTop: 10 },
  card: { backgroundColor: "#121212", borderRadius: 12, padding: 12, marginBottom: 10 },
  cardTitle: { color: "white", fontSize: 14, fontWeight: "700", marginBottom: 6 },
  row: { color: "#e6e6e6", fontSize: 13, marginBottom: 4 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap" },
  summaryItem: { width: "50%", color: "#e6e6e6", fontSize: 13, marginBottom: 4 },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 10,
  },
  contactMain: { flex: 1 },
  contactLabel: { color: "#e6e6e6", fontSize: 13, fontWeight: "600" },
  contactTime: { color: "#bdbdbd", fontSize: 12, marginTop: 2 },
  contactAlarm: { alignItems: "center", justifyContent: "center" },
  alarmLabel: { color: "#bdbdbd", fontSize: 11, marginBottom: 2 },
  muted: { color: "#bdbdbd", fontSize: 13 },
  mono: { color: "#d0d0d0", fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }), fontSize: 11 },
  sep: { height: 1, backgroundColor: "#2a2a2a", marginVertical: 10 },
});
