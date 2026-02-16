import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { EclipseKindAtLocation } from "@eclipse-timer/shared";

import { fmtLocalHuman, fmtUtcHuman } from "../utils/date";

type PreviewContactKey = "c1" | "c2" | "max" | "c3" | "c4";

type TimelineEvent = {
  key: PreviewContactKey;
  shortLabel: string;
  iso: string;
  t: number;
};

export type PreviewPayload = {
  eclipseId: string;
  eclipseDateYmd: string;
  kindAtLocation: EclipseKindAtLocation;
  magnitude?: number;
  c1Utc?: string;
  c2Utc?: string;
  maxUtc?: string;
  c3Utc?: string;
  c4Utc?: string;
};

type EclipsePreviewScreenProps = {
  payload: PreviewPayload;
  onBack: () => void;
};

const DEFAULT_WINDOW_MS = 2 * 60 * 60 * 1000;
const MIN_WINDOW_MS = 5 * 60 * 1000;
const PLAYBACK_SPEED = 480;
const SIM_STAGE_SIZE = 300;
const SUN_RADIUS = 72;

function parseUtcMs(iso?: string): number | undefined {
  if (!iso) return undefined;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function kindLabel(kindAtLocation: EclipseKindAtLocation) {
  if (kindAtLocation === "total") return "Total";
  if (kindAtLocation === "annular") return "Annular";
  if (kindAtLocation === "partial") return "Partial";
  return "None";
}

function buildTimelineEvents(payload: PreviewPayload): TimelineEvent[] {
  const defs: Array<{ key: PreviewContactKey; shortLabel: string; iso?: string }> = [
    { key: "c1", shortLabel: "C1", iso: payload.c1Utc },
    { key: "c2", shortLabel: "C2", iso: payload.c2Utc },
    { key: "max", shortLabel: "MAX", iso: payload.maxUtc },
    { key: "c3", shortLabel: "C3", iso: payload.c3Utc },
    { key: "c4", shortLabel: "C4", iso: payload.c4Utc },
  ];

  return defs
    .map((def) => {
      const t = parseUtcMs(def.iso);
      if (typeof t !== "number" || !def.iso) return null;
      return {
        key: def.key,
        shortLabel: def.shortLabel,
        iso: def.iso,
        t,
      };
    })
    .filter((event): event is TimelineEvent => !!event)
    .sort((a, b) => a.t - b.t);
}

function determineMoonRadius(kindAtLocation: EclipseKindAtLocation) {
  if (kindAtLocation === "annular") return 58;
  if (kindAtLocation === "total") return 76;
  if (kindAtLocation === "partial") return 68;
  return 66;
}

function determineApproachOffset(
  kindAtLocation: EclipseKindAtLocation,
  magnitude: number | undefined,
  moonRadius: number,
) {
  if (kindAtLocation === "none") {
    return SUN_RADIUS + moonRadius + 14;
  }

  if (kindAtLocation === "partial") {
    const safeMag =
      typeof magnitude === "number" && Number.isFinite(magnitude) ? clamp01(magnitude) : 0.6;
    return (1 - safeMag) * (SUN_RADIUS + moonRadius - 6);
  }

  return 0;
}

function phaseLabelForTime(nowMs: number, events: TimelineEvent[]) {
  if (!events.length) return "No contact times available for this location";

  let previous: TimelineEvent | undefined;
  let next: TimelineEvent | undefined;

  for (const event of events) {
    if (event.t <= nowMs) previous = event;
    if (!next && event.t > nowMs) next = event;
  }

  if (!previous && next) return `Before ${next.shortLabel}`;
  if (previous && !next) return `After ${previous.shortLabel}`;
  if (!previous || !next) return "Eclipse in progress";
  if (previous.key === next.key) return `At ${previous.shortLabel}`;
  return `Between ${previous.shortLabel} and ${next.shortLabel}`;
}

export default function EclipsePreviewScreen({ payload, onBack }: EclipsePreviewScreenProps) {
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progressTrackWidth, setProgressTrackWidth] = useState(0);

  const timelineEvents = useMemo(() => buildTimelineEvents(payload), [payload]);

  const timelineBounds = useMemo(() => {
    const c1Ms = parseUtcMs(payload.c1Utc);
    const c4Ms = parseUtcMs(payload.c4Utc);
    const maxMs = parseUtcMs(payload.maxUtc);
    const firstMs = timelineEvents[0]?.t;
    const lastMs = timelineEvents[timelineEvents.length - 1]?.t;

    let startMs = c1Ms ?? firstMs;
    let endMs = c4Ms ?? lastMs;

    if (typeof startMs !== "number" && typeof maxMs === "number") {
      startMs = maxMs - DEFAULT_WINDOW_MS / 2;
    }
    if (typeof endMs !== "number" && typeof maxMs === "number") {
      endMs = maxMs + DEFAULT_WINDOW_MS / 2;
    }

    if (typeof startMs !== "number" || typeof endMs !== "number") {
      const now = Date.now();
      startMs = now - DEFAULT_WINDOW_MS / 2;
      endMs = now + DEFAULT_WINDOW_MS / 2;
    }

    if (endMs <= startMs) {
      endMs = startMs + MIN_WINDOW_MS;
    } else if (endMs - startMs < MIN_WINDOW_MS) {
      const midpoint = startMs + (endMs - startMs) / 2;
      startMs = Math.round(midpoint - MIN_WINDOW_MS / 2);
      endMs = Math.round(midpoint + MIN_WINDOW_MS / 2);
    }

    return {
      startMs: Math.round(startMs),
      endMs: Math.round(endMs),
    };
  }, [payload.c1Utc, payload.c4Utc, payload.maxUtc, timelineEvents]);

  useEffect(() => {
    setProgress(0);
    setIsPlaying(false);
  }, [payload.eclipseId, timelineBounds.endMs, timelineBounds.startMs]);

  const timelineDurationMs = Math.max(MIN_WINDOW_MS, timelineBounds.endMs - timelineBounds.startMs);
  const currentMs = Math.round(timelineBounds.startMs + timelineDurationMs * progress);
  const currentIso = new Date(currentMs).toISOString();

  useEffect(() => {
    if (!isPlaying) return;

    let lastTickMs = Date.now();
    const intervalId = setInterval(() => {
      const now = Date.now();
      const dtMs = now - lastTickMs;
      lastTickMs = now;

      setProgress((prev) => {
        const delta = (dtMs * PLAYBACK_SPEED) / timelineDurationMs;
        const next = clamp01(prev + delta);
        if (next >= 1) setIsPlaying(false);
        return next;
      });
    }, 40);

    return () => clearInterval(intervalId);
  }, [isPlaying, timelineDurationMs]);

  const eventMarkers = useMemo(
    () =>
      timelineEvents.map((event) => ({
        ...event,
        progress: clamp01((event.t - timelineBounds.startMs) / timelineDurationMs),
      })),
    [timelineBounds.startMs, timelineDurationMs, timelineEvents],
  );

  const moonRadius = useMemo(
    () => determineMoonRadius(payload.kindAtLocation),
    [payload.kindAtLocation],
  );
  const moonClosestOffset = useMemo(
    () => determineApproachOffset(payload.kindAtLocation, payload.magnitude, moonRadius),
    [moonRadius, payload.kindAtLocation, payload.magnitude],
  );

  const moonTravelHalfSpan = SUN_RADIUS + moonRadius + 26;
  const moonCenterX = SIM_STAGE_SIZE / 2 - moonTravelHalfSpan + progress * moonTravelHalfSpan * 2;
  const moonCenterY = SIM_STAGE_SIZE / 2 + moonClosestOffset;

  const phaseLabel = useMemo(
    () => phaseLabelForTime(currentMs, timelineEvents),
    [currentMs, timelineEvents],
  );

  const onSeek = (event: GestureResponderEvent) => {
    if (progressTrackWidth <= 0) return;
    const ratio = clamp01(event.nativeEvent.locationX / progressTrackWidth);
    setProgress(ratio);
    setIsPlaying(false);
  };

  const onProgressTrackLayout = (event: LayoutChangeEvent) => {
    setProgressTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
        <View style={styles.headerMeta}>
          <Text style={styles.headerTitle}>Eclipse Preview</Text>
          <Text style={styles.headerSubtitle}>
            {payload.eclipseId}
            {payload.eclipseDateYmd ? ` - ${payload.eclipseDateYmd}` : ""}
          </Text>
        </View>
      </View>

      <View style={styles.timePanel}>
        <Text style={styles.timePrimary}>{fmtLocalHuman(currentIso)}</Text>
        <Text style={styles.timeSecondary}>{fmtUtcHuman(currentIso)}</Text>
        <Text style={styles.kindPill}>
          {kindLabel(payload.kindAtLocation)}
          {typeof payload.magnitude === "number" && Number.isFinite(payload.magnitude)
            ? `  |  Mag ${payload.magnitude.toFixed(3)}`
            : ""}
        </Text>
      </View>

      <View style={styles.simContainer}>
        <View style={styles.simStage}>
          <View style={styles.sunGlow} />
          <View style={styles.sunDisk} />
          <View
            style={[
              styles.moonDisk,
              {
                width: moonRadius * 2,
                height: moonRadius * 2,
                borderRadius: moonRadius,
                left: moonCenterX - moonRadius,
                top: moonCenterY - moonRadius,
              },
            ]}
          />
        </View>
        <Text style={styles.phaseText}>{phaseLabel}</Text>
      </View>

      <View style={styles.controlsWrap}>
        <View style={styles.progressRow}>
          <Pressable
            style={styles.playPauseBtn}
            onPress={() => {
              if (!isPlaying && progress >= 1) {
                setProgress(0);
              }
              setIsPlaying((prev) => !prev);
            }}
          >
            <Text style={styles.playPauseBtnText}>{isPlaying ? "Pause" : "Play"}</Text>
          </Pressable>

          <Pressable
            style={styles.progressTrack}
            onPress={onSeek}
            onLayout={onProgressTrackLayout}
            accessibilityRole="adjustable"
            accessibilityLabel="Eclipse timeline progress"
          >
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            {eventMarkers.map((marker) => (
              <View key={marker.key} style={[styles.progressMarker, { left: `${marker.progress * 100}%` }]}>
                <View style={styles.progressMarkerLine} />
                <Text style={styles.progressMarkerText}>{marker.shortLabel}</Text>
              </View>
            ))}
            <View style={[styles.progressThumb, { left: `${progress * 100}%` }]} />
          </Pressable>
        </View>

        <View style={styles.timelineLabels}>
          <Text style={styles.timelineLabel}>{fmtLocalHuman(new Date(timelineBounds.startMs).toISOString())}</Text>
          <Text style={styles.timelineLabel}>{fmtLocalHuman(new Date(timelineBounds.endMs).toISOString())}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#0a0a0d",
  },
  headerRow: {
    paddingHorizontal: 14,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#17171f",
    borderWidth: 1,
    borderColor: "#30303f",
  },
  backBtnText: {
    color: "white",
    fontWeight: "700",
    fontSize: 13,
  },
  headerMeta: {
    flex: 1,
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "800",
  },
  headerSubtitle: {
    color: "#b9bdd5",
    fontSize: 12,
    marginTop: 2,
  },
  timePanel: {
    marginTop: 10,
    marginHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#262739",
    backgroundColor: "#121420",
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 4,
  },
  timePrimary: {
    color: "white",
    fontSize: 14,
    fontWeight: "800",
  },
  timeSecondary: {
    color: "#9ea4c8",
    fontSize: 12,
    fontWeight: "600",
  },
  kindPill: {
    marginTop: 2,
    color: "#d1d4e7",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  simContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  simStage: {
    width: SIM_STAGE_SIZE,
    height: SIM_STAGE_SIZE,
    borderRadius: SIM_STAGE_SIZE / 2,
    borderWidth: 1,
    borderColor: "#1f253c",
    backgroundColor: "#05070f",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  sunGlow: {
    position: "absolute",
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(255, 205, 117, 0.18)",
  },
  sunDisk: {
    width: SUN_RADIUS * 2,
    height: SUN_RADIUS * 2,
    borderRadius: SUN_RADIUS,
    backgroundColor: "#ffd36f",
    borderWidth: 2,
    borderColor: "#ffe2a6",
    shadowColor: "#ffc96a",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  moonDisk: {
    position: "absolute",
    backgroundColor: "#0d1020",
    borderWidth: 1,
    borderColor: "#3d4267",
  },
  phaseText: {
    color: "#c7cbdf",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  controlsWrap: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 4,
    gap: 8,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  playPauseBtn: {
    width: 74,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#2c3cff",
    alignItems: "center",
    justifyContent: "center",
  },
  playPauseBtnText: {
    color: "white",
    fontSize: 13,
    fontWeight: "800",
  },
  progressTrack: {
    flex: 1,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#181d2c",
    borderWidth: 1,
    borderColor: "#2d3452",
    overflow: "hidden",
    justifyContent: "center",
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#3b5bff",
    opacity: 0.52,
  },
  progressThumb: {
    position: "absolute",
    top: 6,
    width: 4,
    height: 20,
    marginLeft: -2,
    borderRadius: 2,
    backgroundColor: "white",
  },
  progressMarker: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 26,
    marginLeft: -13,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  progressMarkerLine: {
    width: 2,
    height: 12,
    borderRadius: 2,
    backgroundColor: "rgba(220, 225, 255, 0.75)",
  },
  progressMarkerText: {
    marginTop: 1,
    color: "#d5dcff",
    fontSize: 9,
    fontWeight: "700",
  },
  timelineLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  timelineLabel: {
    flex: 1,
    color: "#9ca3c4",
    fontSize: 10,
  },
});
