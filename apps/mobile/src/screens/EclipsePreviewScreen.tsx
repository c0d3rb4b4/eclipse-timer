import type { EclipseKindAtLocation } from "@eclipse-timer/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type GestureResponderEvent,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BurgerButton from "../components/BurgerButton";
import type { ContactKey } from "../utils/contacts";
import { colorForContactKey } from "../utils/contactTheme";
import { fmtLocalHuman, fmtUtcHuman } from "../utils/date";
import {
  calculatePreviewMoonGeometry,
  determinePreviewTravelDirection,
  PREVIEW_STAGE_SIZE,
  PREVIEW_SUN_RADIUS,
} from "../utils/previewGeometry";

type PreviewContactKey = ContactKey;

type TimelineEvent = {
  key: PreviewContactKey;
  shortLabel: string;
  iso: string;
  t: number;
};

type TimelineMarker = TimelineEvent & {
  progress: number;
  color: string;
  labelProgress: number;
  labelRow: number;
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
  c1BearingDeg?: number;
  c2BearingDeg?: number;
  c3BearingDeg?: number;
  c4BearingDeg?: number;
};

type EclipsePreviewScreenProps = {
  payload: PreviewPayload;
  onBack: () => void;
  onOpenMenu: () => void;
};

const DEFAULT_WINDOW_MS = 2 * 60 * 60 * 1000;
const MIN_WINDOW_MS = 5 * 60 * 1000;
const PLAYBACK_SPEED = 480;
const SIM_STAGE_SIZE = PREVIEW_STAGE_SIZE;
const SUN_RADIUS = PREVIEW_SUN_RADIUS;
const MARKER_LABEL_HALF_WIDTH_PX = 18;
const MARKER_LABEL_MIN_GAP_PX = 40;
const MARKER_LABEL_ROW_LIMIT = 1;
const MARKER_LABEL_ROW_HEIGHT_PX = 22;
const MARKER_ARROW_HALF_WIDTH_PX = 5;
const MARKER_ARROW_DY_PX = 10;
const MARKER_CONNECTOR_THICKNESS_PX = 1.5;

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

function markerArrowForLabel(marker: TimelineMarker) {
  if (marker.key === "max") return "↓";
  if (marker.key === "c2" || marker.key === "c3") {
    if (marker.labelProgress < marker.progress) return "↘";
    if (marker.labelProgress > marker.progress) return "↙";
    return marker.key === "c2" ? "↘" : "↙";
  }
  return "↓";
}

function markerArrowOffsetPx(marker: TimelineMarker, trackWidth: number) {
  return (marker.progress - marker.labelProgress) * trackWidth;
}

export default function EclipsePreviewScreen({
  payload,
  onBack,
  onOpenMenu,
}: EclipsePreviewScreenProps) {
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progressTrackWidth, setProgressTrackWidth] = useState(0);
  const isScrubbingRef = useRef(false);
  const pendingProgressRef = useRef<number | null>(null);
  const progressRafRef = useRef<number | null>(null);
  const progressTrackRef = useRef<View | null>(null);
  const progressTrackPageXRef = useRef(0);

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
        if (isScrubbingRef.current) return prev;
        const delta = (dtMs * PLAYBACK_SPEED) / timelineDurationMs;
        const next = clamp01(prev + delta);
        if (next >= 1) setIsPlaying(false);
        return next;
      });
    }, 40);

    return () => clearInterval(intervalId);
  }, [isPlaying, timelineDurationMs]);

  useEffect(() => {
    return () => {
      if (typeof progressRafRef.current === "number") {
        cancelAnimationFrame(progressRafRef.current);
      }
    };
  }, []);

  const eventMarkers = useMemo<TimelineMarker[]>(() => {
    const baseMarkers = timelineEvents.map((event) => ({
      ...event,
      progress: clamp01((event.t - timelineBounds.startMs) / timelineDurationMs),
      color: colorForContactKey(event.key),
    }));
    if (!baseMarkers.length) return [];

    const effectiveTrackWidth = progressTrackWidth > 0 ? progressTrackWidth : 240;
    const minLabelProgress = clamp01(MARKER_LABEL_HALF_WIDTH_PX / effectiveTrackWidth);
    const maxLabelProgress = clamp01(1 - minLabelProgress);

    const positionedMarkers = baseMarkers
      .map((marker) => ({
        ...marker,
        labelProgress: marker.progress,
        labelRow: 0,
      }))
      .sort((a, b) => a.labelProgress - b.labelProgress);

    const minGapProgress = MARKER_LABEL_MIN_GAP_PX / effectiveTrackWidth;

    let prevLabelProgress = minLabelProgress - minGapProgress;
    for (const marker of positionedMarkers) {
      marker.labelProgress = Math.max(
        minLabelProgress,
        Math.min(maxLabelProgress, Math.max(marker.progress, prevLabelProgress + minGapProgress)),
      );
      prevLabelProgress = marker.labelProgress;
    }

    let nextLabelProgress = maxLabelProgress + minGapProgress;
    for (let idx = positionedMarkers.length - 1; idx >= 0; idx -= 1) {
      const marker = positionedMarkers[idx];
      if (!marker) continue;
      marker.labelProgress = Math.max(
        minLabelProgress,
        Math.min(marker.labelProgress, nextLabelProgress - minGapProgress),
      );
      nextLabelProgress = marker.labelProgress;
    }

    return positionedMarkers;
  }, [progressTrackWidth, timelineBounds.startMs, timelineDurationMs, timelineEvents]);

  const contactProgress = useMemo(() => {
    const toProgress = (iso?: string) => {
      const t = parseUtcMs(iso);
      if (typeof t !== "number") return undefined;
      return clamp01((t - timelineBounds.startMs) / timelineDurationMs);
    };

    return {
      c1: toProgress(payload.c1Utc),
      c2: toProgress(payload.c2Utc),
      max: toProgress(payload.maxUtc),
      c3: toProgress(payload.c3Utc),
      c4: toProgress(payload.c4Utc),
    };
  }, [
    payload.c1Utc,
    payload.c2Utc,
    payload.c3Utc,
    payload.c4Utc,
    payload.maxUtc,
    timelineBounds.startMs,
    timelineDurationMs,
  ]);

  const moonGeometry = useMemo(
    () =>
      calculatePreviewMoonGeometry({
        progress,
        kindAtLocation: payload.kindAtLocation,
        magnitude: payload.magnitude,
        contacts: contactProgress,
        stageSize: SIM_STAGE_SIZE,
        sunRadius: SUN_RADIUS,
        travelDirection: determinePreviewTravelDirection({
          c1BearingDeg: payload.c1BearingDeg,
          c2BearingDeg: payload.c2BearingDeg,
          c3BearingDeg: payload.c3BearingDeg,
          c4BearingDeg: payload.c4BearingDeg,
        }),
      }),
    [
      contactProgress,
      payload.c1BearingDeg,
      payload.c2BearingDeg,
      payload.c3BearingDeg,
      payload.c4BearingDeg,
      payload.kindAtLocation,
      payload.magnitude,
      progress,
    ],
  );

  const phaseLabel = useMemo(
    () => phaseLabelForTime(currentMs, timelineEvents),
    [currentMs, timelineEvents],
  );

  const commitProgress = useCallback((nextProgress: number) => {
    pendingProgressRef.current = clamp01(nextProgress);
    if (typeof progressRafRef.current === "number") return;

    progressRafRef.current = requestAnimationFrame(() => {
      progressRafRef.current = null;
      const pending = pendingProgressRef.current;
      pendingProgressRef.current = null;
      if (typeof pending !== "number") return;
      setProgress((prev) => (Math.abs(prev - pending) < 0.0005 ? prev : pending));
    });
  }, []);

  const refreshProgressTrackPageX = useCallback(() => {
    progressTrackRef.current?.measureInWindow((x) => {
      progressTrackPageXRef.current = x;
    });
  }, []);

  const updateProgressFromGesture = useCallback(
    (event: GestureResponderEvent) => {
      if (progressTrackWidth <= 0) return;
      const localX = event.nativeEvent.pageX - progressTrackPageXRef.current;
      const ratio = clamp01(localX / progressTrackWidth);
      commitProgress(ratio);
    },
    [commitProgress, progressTrackWidth],
  );

  const onSeekStart = useCallback(
    (event: GestureResponderEvent) => {
      isScrubbingRef.current = true;
      setIsPlaying(false);
      refreshProgressTrackPageX();
      updateProgressFromGesture(event);
    },
    [refreshProgressTrackPageX, updateProgressFromGesture],
  );

  const onSeekMove = useCallback(
    (event: GestureResponderEvent) => {
      if (!isScrubbingRef.current) return;
      updateProgressFromGesture(event);
    },
    [updateProgressFromGesture],
  );

  const onSeekEnd = useCallback(() => {
    isScrubbingRef.current = false;
  }, []);

  const jumpToMarker = useCallback(
    (marker: TimelineMarker) => {
      commitProgress(marker.progress);
    },
    [commitProgress],
  );

  const onProgressTrackLayout = (event: LayoutChangeEvent) => {
    setProgressTrackWidth(event.nativeEvent.layout.width);
    requestAnimationFrame(() => {
      refreshProgressTrackPageX();
    });
  };

  const effectiveTrackWidth = progressTrackWidth > 0 ? progressTrackWidth : 240;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.headerRow}>
        <BurgerButton onPress={onOpenMenu} />
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
                width: moonGeometry.moonRadius * 2,
                height: moonGeometry.moonRadius * 2,
                borderRadius: moonGeometry.moonRadius,
                left: moonGeometry.moonCenterX - moonGeometry.moonRadius,
                top: moonGeometry.moonCenterY - moonGeometry.moonRadius,
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
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? "Pause playback" : "Start playback"}
          >
            <Text style={styles.playPauseBtnText}>{isPlaying ? "⏸" : "▶"}</Text>
          </Pressable>

          <View style={styles.progressTrackWrap}>
            <View style={styles.progressLabelsLayer} pointerEvents="none">
              {eventMarkers.map((marker) => {
                const arrowOffsetPx = markerArrowOffsetPx(marker, effectiveTrackWidth);
                const connectorLength = Math.max(1, Math.hypot(arrowOffsetPx, MARKER_ARROW_DY_PX));
                const connectorAngleRad = Math.atan2(MARKER_ARROW_DY_PX, arrowOffsetPx);
                const connectorAngleDeg = (connectorAngleRad * 180) / Math.PI;
                const connectorLeft =
                  MARKER_LABEL_HALF_WIDTH_PX +
                  (connectorLength / 2) * (Math.cos(connectorAngleRad) - 1);
                const connectorTop =
                  12 +
                  (connectorLength / 2) * Math.sin(connectorAngleRad) -
                  MARKER_CONNECTOR_THICKNESS_PX / 2;

                return (
                  <View
                    key={`marker-label-${marker.key}`}
                    style={[
                      styles.progressMarkerLabelWrap,
                      {
                        left: `${marker.labelProgress * 100}%`,
                        top: marker.labelRow * MARKER_LABEL_ROW_HEIGHT_PX,
                      },
                    ]}
                  >
                    <Text style={[styles.progressMarkerLabelText, { color: marker.color }]}>
                      {marker.shortLabel}
                    </Text>
                    <View
                      style={[
                        styles.progressMarkerConnector,
                        {
                          backgroundColor: marker.color,
                          left: connectorLeft,
                          top: connectorTop,
                          width: connectorLength,
                          transform: [{ rotate: `${connectorAngleDeg}deg` }],
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.progressMarkerArrowText,
                        {
                          color: marker.color,
                          left:
                            MARKER_LABEL_HALF_WIDTH_PX - MARKER_ARROW_HALF_WIDTH_PX + arrowOffsetPx,
                          top: 12 + MARKER_ARROW_DY_PX - 6,
                        },
                      ]}
                    >
                      {markerArrowForLabel(marker)}
                    </Text>
                  </View>
                );
              })}
            </View>

            <View
              ref={progressTrackRef}
              style={styles.progressTrack}
              onLayout={onProgressTrackLayout}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
              onResponderTerminationRequest={() => false}
              onResponderGrant={onSeekStart}
              onResponderMove={onSeekMove}
              onResponderRelease={onSeekEnd}
              onResponderTerminate={onSeekEnd}
              accessibilityRole="adjustable"
              accessibilityLabel="Eclipse timeline progress"
            >
              <View
                pointerEvents="none"
                style={[styles.progressFill, { width: `${progress * 100}%` }]}
              />
              {eventMarkers.map((marker) => (
                <View
                  key={marker.key}
                  style={[styles.progressMarkerTick, { left: `${marker.progress * 100}%` }]}
                >
                  <View style={[styles.progressMarkerLine, { backgroundColor: marker.color }]} />
                </View>
              ))}
              <View
                pointerEvents="none"
                style={[styles.progressThumb, { left: `${progress * 100}%` }]}
              />
            </View>
          </View>
        </View>

        <View style={styles.contactLegendRow}>
          {eventMarkers.map((marker) => (
            <Pressable
              key={`legend-${marker.key}`}
              style={[styles.contactLegendChip, { borderColor: marker.color }]}
              onPress={() => jumpToMarker(marker)}
              accessibilityRole="button"
              accessibilityLabel={`Jump to ${marker.shortLabel}`}
            >
              <View style={[styles.contactLegendDot, { backgroundColor: marker.color }]} />
              <Text style={[styles.contactLegendText, { color: marker.color }]}>
                {marker.shortLabel}
              </Text>
            </Pressable>
          ))}
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
    alignItems: "flex-end",
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
    fontSize: 18,
    fontWeight: "800",
  },
  progressTrackWrap: {
    flex: 1,
    gap: 4,
  },
  progressLabelsLayer: {
    position: "relative",
    height: MARKER_LABEL_ROW_HEIGHT_PX * MARKER_LABEL_ROW_LIMIT,
  },
  progressMarkerLabelWrap: {
    position: "absolute",
    marginLeft: -MARKER_LABEL_HALF_WIDTH_PX,
    minWidth: MARKER_LABEL_HALF_WIDTH_PX * 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  progressMarkerLabelText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  progressMarkerArrowText: {
    position: "absolute",
    width: MARKER_ARROW_HALF_WIDTH_PX * 2,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 10,
  },
  progressMarkerConnector: {
    position: "absolute",
    height: MARKER_CONNECTOR_THICKNESS_PX,
    borderRadius: MARKER_CONNECTOR_THICKNESS_PX,
  },
  progressTrack: {
    height: 30,
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
    top: 4,
    width: 10,
    height: 22,
    marginLeft: -5,
    borderRadius: 6,
    backgroundColor: "white",
  },
  progressMarkerTick: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  progressMarkerLine: {
    width: 2,
    height: 16,
    borderRadius: 2,
    backgroundColor: "rgba(220, 225, 255, 0.75)",
  },
  contactLegendRow: {
    marginTop: 2,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  contactLegendChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  contactLegendDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  contactLegendText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
});
