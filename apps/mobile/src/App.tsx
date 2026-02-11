import React, { useMemo, useState } from "react";
import { SafeAreaView, View, Text, Pressable, ScrollView, StyleSheet, Platform } from "react-native";
import MapView, { Marker, MapPressEvent, Region } from "react-native-maps";
import * as Location from "expo-location";

import { loadCatalog } from "@eclipse-timer/catalog";
import { computeCircumstances } from "@eclipse-timer/engine";
import type { Circumstances, Observer, EclipseRecord } from "@eclipse-timer/shared";

const GIBRALTAR = { lat: 36.1408, lon: -5.3536 };
const CENTRAL_1000 = { lat: 26 + 53.3 / 60, lon: 31 + 0.8 / 60 };

function fmtUtc(iso?: string) {
  if (!iso) return "—";
  // Keep it simple: ISO without milliseconds
  return iso.replace(".000Z", "Z");
}

function fmtDur(seconds?: number) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const s = Math.round(seconds);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}m ${ss.toString().padStart(2, "0")}s`;
}

function nextEventCountdown(c: Circumstances) {
  const now = Date.now();
  const events: { label: string; t: number }[] = [];

  const push = (label: string, iso?: string) => {
    if (!iso) return;
    const t = Date.parse(iso);
    if (Number.isFinite(t)) events.push({ label, t });
  };

  push("C1", c.c1Utc);
  push("C2", c.c2Utc);
  push("MAX", c.maxUtc);
  push("C3", c.c3Utc);
  push("C4", c.c4Utc);

  const future = events.filter((e) => e.t > now).sort((a, b) => a.t - b.t)[0];
  if (!future) return "No upcoming contact time (for this eclipse)";

  const diffSec = Math.max(0, Math.floor((future.t - now) / 1000));
  const hh = Math.floor(diffSec / 3600);
  const mm = Math.floor((diffSec % 3600) / 60);
  const ss = diffSec % 60;

  return `Next: ${future.label} in ${hh}h ${mm}m ${ss}s`;
}

export default function App() {
  const catalog = useMemo(() => loadCatalog(), []);
  const eclipse: EclipseRecord | undefined = catalog[0]; // MVP: first eclipse

  const [pin, setPin] = useState({ lat: GIBRALTAR.lat, lon: GIBRALTAR.lon });

  const [region, setRegion] = useState<Region>({
    latitude: pin.lat,
    longitude: pin.lon,
    latitudeDelta: 8,
    longitudeDelta: 8,
  });

  const [status, setStatus] = useState("Ready");
  const [result, setResult] = useState<Circumstances | null>(null);

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

  const onMapPress = (e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPinAndRegion(latitude, longitude);
    setStatus("Pin set (tap)");
  };

  const onDragEnd = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPinAndRegion(latitude, longitude);
    setStatus("Pin set (drag)");
  };

  const useGps = async () => {
    try {
      setStatus("Requesting location permission…");
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setStatus("Location permission denied");
        return;
      }
      setStatus("Getting GPS fix…");
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPinAndRegion(loc.coords.latitude, loc.coords.longitude, 2);
      setStatus("Pin set from GPS");
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

    setStatus(`Computing for ${pin.lat.toFixed(4)}, ${pin.lon.toFixed(4)}…`);
    try {
      const out = computeCircumstances(eclipse, observer);
      setResult(out);
      setStatus("Computed");
    } catch (err: any) {
      setStatus(`Compute error: ${err?.message ?? String(err)}`);
      setResult(null);
    }
  };

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
          style={styles.map}
          region={region}
          onRegionChangeComplete={(r) => setRegion(r)}
          onPress={onMapPress}
        >
          <Marker
            coordinate={{ latitude: pin.lat, longitude: pin.lon }}
            draggable
            onDragEnd={onDragEnd}
            title="Observer"
            description={`${pin.lat.toFixed(4)}, ${pin.lon.toFixed(4)}`}
          />
        </MapView>
      </View>

      <View style={styles.controls}>
        <Pressable style={styles.btn} onPress={useGps}>
          <Text style={styles.btnText}>Use GPS</Text>
        </Pressable>

        <Pressable style={styles.btn} onPress={() => setPinAndRegion(GIBRALTAR.lat, GIBRALTAR.lon, 3)}>
          <Text style={styles.btnText}>Gibraltar</Text>
        </Pressable>

        <Pressable style={styles.btn} onPress={() => setPinAndRegion(CENTRAL_1000.lat, CENTRAL_1000.lon, 3)}>
          <Text style={styles.btnText}>Central 10:00</Text>
        </Pressable>

        <Pressable style={[styles.btn, styles.btnPrimary]} onPress={runCompute}>
          <Text style={styles.btnText}>Compute</Text>
        </Pressable>
      </View>

      <View style={styles.statusBar}>
        <Text style={styles.statusText}>{status}</Text>
      </View>

      <ScrollView style={styles.results}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Selected Pin</Text>
          <Text style={styles.mono}>
            lat {pin.lat.toFixed(6)}{"\n"}lon {pin.lon.toFixed(6)}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Results</Text>
          {!result ? (
            <Text style={styles.muted}>Press Compute to run the engine.</Text>
          ) : (
            <>
              <Text style={styles.row}>Visible: {String(result.visible)}</Text>
              <Text style={styles.row}>Kind: {result.kindAtLocation}</Text>
              <Text style={styles.row}>Magnitude: {typeof result.magnitude === "number" ? result.magnitude.toFixed(3) : "—"}</Text>
              <Text style={styles.row}>Totality: {fmtDur(result.durationSeconds)}</Text>

              <View style={styles.sep} />

              <Text style={styles.row}>C1: {fmtUtc(result.c1Utc)}</Text>
              <Text style={styles.row}>C2: {fmtUtc(result.c2Utc)}</Text>
              <Text style={styles.row}>MAX: {fmtUtc(result.maxUtc)}</Text>
              <Text style={styles.row}>C3: {fmtUtc(result.c3Utc)}</Text>
              <Text style={styles.row}>C4: {fmtUtc(result.c4Utc)}</Text>

              <View style={styles.sep} />

              <Text style={styles.row}>{nextEventCountdown(result)}</Text>

              {result._debug ? (
                <>
                  <View style={styles.sep} />
                  <Text style={styles.cardTitle}>Debug</Text>
                  <Text style={styles.mono}>{JSON.stringify(result._debug, null, 2)}</Text>
                </>
              ) : null}
            </>
          )}
        </View>
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

  controls: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
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
  muted: { color: "#bdbdbd", fontSize: 13 },
  mono: { color: "#d0d0d0", fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }), fontSize: 11 },
  sep: { height: 1, backgroundColor: "#2a2a2a", marginVertical: 10 },
});
