import { useMemo } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import MapView, { Marker, Polygon } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

import type { EclipseRecord } from "@eclipse-timer/shared";

import type { TimerState } from "../hooks/useTimerState";
import { fmtLocalHuman, fmtUtcHuman } from "../utils/date";
import { eclipseCenterForRecord, kindCodeForRecord } from "../utils/eclipse";

const VISIBLE_PATH_COLOR = "rgba(79, 195, 247, 0.22)";
const TOTALITY_PATH_COLOR = "rgba(255, 82, 82, 0.28)";
const ANNULARITY_PATH_COLOR = "rgba(255, 167, 38, 0.30)";

function localKindLabel(kind: "none" | "partial" | "total" | "annular") {
  if (kind === "total") return "Total";
  if (kind === "annular") return "Annular";
  if (kind === "partial") return "Partial";
  return "None";
}

function formatMagnitude(magnitude?: number) {
  if (typeof magnitude !== "number" || !Number.isFinite(magnitude)) return "--";
  return magnitude.toFixed(3);
}

function formatDuration(seconds?: number) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return "--";
  const totalSeconds = Math.round(seconds);
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${mm}m ${String(ss).padStart(2, "0")}s`;
}

type TimerScreenProps = {
  activeEclipse: EclipseRecord | null;
  isActiveEclipseLoading: boolean;
  timer: TimerState;
};

export default function TimerScreen({
  activeEclipse,
  isActiveEclipseLoading,
  timer,
}: TimerScreenProps) {
  const activeEclipseCenter = useMemo(() => eclipseCenterForRecord(activeEclipse), [activeEclipse]);
  const activeKindCode = useMemo(
    () => (activeEclipse ? kindCodeForRecord(activeEclipse) : "P"),
    [activeEclipse],
  );
  const centralOverlayColor = activeKindCode === "A" ? ANNULARITY_PATH_COLOR : TOTALITY_PATH_COLOR;
  const centralLegendLabel =
    activeKindCode === "A"
      ? "Annularity Path"
      : activeKindCode === "H"
        ? "Central Path"
        : "Totality Path";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Eclipse Timer (MVP)</Text>
        <Text style={styles.subtitle}>
          {isActiveEclipseLoading
            ? "Loading eclipse data..."
            : activeEclipse
              ? `${activeEclipse.id} - ${activeEclipse.dateYmd}`
              : "No eclipse loaded"}
        </Text>
      </View>

      <View style={styles.mapWrap}>
        <MapView
          ref={timer.mapRef}
          style={styles.map}
          region={timer.region}
          onRegionChangeComplete={timer.onRegionChangeComplete}
          onPress={timer.onMapPress}
          mapType={timer.mapType}
        >
          {timer.overlayVisiblePolygons.map((coordinates, idx) => (
            <Polygon
              key={`visible-${idx}`}
              coordinates={coordinates}
              fillColor={VISIBLE_PATH_COLOR}
              strokeColor="rgba(79, 195, 247, 0.05)"
              strokeWidth={0.5}
            />
          ))}
          {timer.overlayCentralPolygons.map((coordinates, idx) => (
            <Polygon
              key={`central-${idx}`}
              coordinates={coordinates}
              fillColor={centralOverlayColor}
              strokeColor="rgba(255,255,255,0.08)"
              strokeWidth={0.5}
            />
          ))}
          <Marker
            coordinate={{ latitude: timer.pin.lat, longitude: timer.pin.lon }}
            draggable
            onDragEnd={timer.onDragEnd}
            title="Observer"
            description={`${timer.pin.lat.toFixed(4)}, ${timer.pin.lon.toFixed(4)}`}
          />
        </MapView>

        <Pressable style={styles.mapOverlayBtn} onPress={timer.cycleMapType}>
          <Text style={styles.mapOverlayBtnText}>
            {timer.mapType === "standard"
              ? "Standard"
              : timer.mapType === "satellite"
                ? "Satellite"
                : "Hybrid"}
          </Text>
        </Pressable>

        <View style={styles.mapLegend}>
          <View style={styles.mapLegendRow}>
            <View style={[styles.mapLegendSwatch, { backgroundColor: VISIBLE_PATH_COLOR }]} />
            <Text style={styles.mapLegendText}>Eclipse Visible</Text>
          </View>
          <View style={styles.mapLegendRow}>
            <View style={[styles.mapLegendSwatch, { backgroundColor: centralOverlayColor }]} />
            <Text style={styles.mapLegendText}>{centralLegendLabel}</Text>
          </View>
          {!timer.hasOverlayData ? (
            <Text style={styles.mapLegendHint}>No precomputed overlay for this eclipse.</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.btnRow}>
          <Pressable style={styles.btn} onPress={timer.useGps}>
            <Text style={styles.btnText}>Use GPS</Text>
          </Pressable>

          <Pressable
            style={[styles.btn, isActiveEclipseLoading ? styles.btnDisabled : null]}
            onPress={() => {
              if (!activeEclipseCenter) {
                timer.setStatusMessage("No center coordinates available for this eclipse");
                return;
              }
              timer.jumpTo(activeEclipseCenter.lat, activeEclipseCenter.lon, 3);
            }}
            disabled={isActiveEclipseLoading}
          >
            <Text style={styles.btnText}>Greatest Eclipse</Text>
          </Pressable>
        </View>

        <Pressable
          style={[
            styles.computeBtn,
            timer.isComputing || isActiveEclipseLoading ? styles.computeBtnDisabled : null,
          ]}
          onPress={timer.runCompute}
          disabled={timer.isComputing || isActiveEclipseLoading}
        >
          <View style={styles.computeBtnInner}>
            {timer.isComputing ? <ActivityIndicator /> : null}
            <Text style={styles.computeBtnText}>
              {isActiveEclipseLoading
                ? "Loading..."
                : timer.isComputing
                  ? "Computing..."
                  : timer.didComputeFlash
                    ? "Done"
                    : "Compute"}
            </Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.statusBar}>
        <Text style={styles.statusText}>{timer.status}</Text>
      </View>

      <ScrollView style={styles.results}>
        <Animated.View
          style={[
            styles.card,
            {
              transform: [
                {
                  scale: timer.resultFlash.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.02],
                  }),
                },
              ],
              opacity: timer.resultFlash.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.92],
              }),
            },
          ]}
        >
          <Text style={styles.cardTitle}>Results</Text>
          {isActiveEclipseLoading && !timer.result ? (
            <View style={styles.loadingCardState}>
              <ActivityIndicator />
              <Text style={styles.muted}>Loading overlays and eclipse metadata...</Text>
            </View>
          ) : !timer.result ? (
            <Text style={styles.muted}>Press Compute to run the engine.</Text>
          ) : (
            <>
              <View style={styles.timerHero}>
                <Text style={styles.timerHeroLabel}>Next Event Timer</Text>
                <Text style={styles.timerHeroText}>{timer.nextEventCountdownText}</Text>
              </View>

              <View style={styles.metricRow}>
                <View style={styles.metricTile}>
                  <Text style={styles.metricLabel}>Type</Text>
                  <Text style={styles.metricValue}>{localKindLabel(timer.result.kindAtLocation)}</Text>
                </View>
                <View style={styles.metricTile}>
                  <Text style={styles.metricLabel}>Magnitude</Text>
                  <Text style={styles.metricValue}>{formatMagnitude(timer.result.magnitude)}</Text>
                </View>
                <View style={styles.metricTile}>
                  <Text style={styles.metricLabel}>Central Duration</Text>
                  <Text style={styles.metricValue}>{formatDuration(timer.result.durationSeconds)}</Text>
                </View>
              </View>

              <Pressable style={styles.testAlarmBtn} onPress={timer.runAlarmTest}>
                <Text style={styles.testAlarmBtnText}>Test Alarm</Text>
              </Pressable>

              <View style={styles.sep} />

              {timer.contactItems.map((item) => (
                <View style={styles.contactRow} key={item.key}>
                  <View style={styles.contactMain}>
                    <Text style={styles.contactLabel}>{item.label}</Text>
                    <Text style={styles.contactTime}>UTC: {fmtUtcHuman(item.iso)}</Text>
                    <Text style={styles.contactTimeLocal}>Local: {fmtLocalHuman(item.iso)}</Text>
                  </View>
                  <View style={styles.contactAlarm}>
                    <Text style={styles.alarmLabel}>Alarm</Text>
                    <Switch
                      value={timer.alarmState[item.key]}
                      onValueChange={(enabled) => timer.toggleAlarm(item.key, enabled)}
                      disabled={!item.iso}
                    />
                  </View>
                </View>
              ))}
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
  mapLegend: {
    position: "absolute",
    left: 10,
    bottom: 10,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.62)",
    gap: 4,
  },
  mapLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mapLegendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  mapLegendText: {
    color: "white",
    fontSize: 11,
    fontWeight: "600",
  },
  mapLegendHint: {
    color: "#c6c6c6",
    fontSize: 10,
    marginTop: 1,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#1f1f1f",
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnText: { color: "white", fontWeight: "600" },
  statusBar: { paddingHorizontal: 12, paddingTop: 8 },
  statusText: { color: "#bdbdbd", fontSize: 12 },
  results: { flex: 1, paddingHorizontal: 12, paddingTop: 10 },
  card: { backgroundColor: "#121212", borderRadius: 12, padding: 12, marginBottom: 10 },
  cardTitle: { color: "white", fontSize: 14, fontWeight: "700", marginBottom: 6 },
  timerHero: {
    backgroundColor: "#1a2056",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#3744b8",
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  timerHeroLabel: {
    color: "#a8b1ff",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  timerHeroText: { color: "white", fontSize: 16, fontWeight: "800", lineHeight: 22 },
  metricRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  metricTile: {
    flex: 1,
    backgroundColor: "#1b1b1b",
    borderWidth: 1,
    borderColor: "#2d2d2d",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    gap: 3,
  },
  metricLabel: {
    color: "#bdbdbd",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  metricValue: {
    color: "white",
    fontSize: 13,
    fontWeight: "700",
  },
  testAlarmBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#2c3cff",
    alignItems: "center",
    justifyContent: "center",
  },
  testAlarmBtnText: { color: "white", fontSize: 13, fontWeight: "700" },
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
  contactTimeLocal: { color: "#8fc8ff", fontSize: 12, marginTop: 2 },
  contactAlarm: { alignItems: "center", justifyContent: "center" },
  alarmLabel: { color: "#bdbdbd", fontSize: 11, marginBottom: 2 },
  muted: { color: "#bdbdbd", fontSize: 13 },
  loadingCardState: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sep: { height: 1, backgroundColor: "#2a2a2a", marginVertical: 10 },
});
