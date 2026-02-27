import type { EclipseKindAtLocation } from "@eclipse-timer/shared";
import { useMemo, useState } from "react";
import {
  type LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BurgerButton from "../components/BurgerButton";
import { useAppTheme } from "../theme/useAppTheme";
import { fmtLocalHuman, fmtUtcHuman } from "../utils/date";
import {
  buildLandscapeCompositeLayout,
  buildPhotographyGuideSchedule,
  type PhotographyGuidePictureCount,
  type PhotographyGuideRow,
} from "../utils/photographyGuide";
import {
  calculatePreviewMoonGeometry,
  determinePreviewTravelVector,
} from "../utils/previewGeometry";

const PHOTO_COUNT_OPTIONS: readonly PhotographyGuidePictureCount[] = [3, 5, 7, 9];
const TABLE_THUMB_STAGE_SIZE = 40;
const TABLE_THUMB_SUN_RADIUS = 18;
const TOTALITY_SKY_COLOR = "#050d24";
const TOTALITY_GROUND_COLOR = "#111827";
const TOTALITY_MOON_COLOR = TOTALITY_SKY_COLOR;
const TOTALITY_MOON_BORDER_COLOR = "#1f2c47";
const TOTALITY_HORIZON_LINE_COLOR = "rgba(255, 174, 205, 0.75)";
const TOTALITY_HORIZON_GLOW_COLOR = "rgba(255, 136, 182, 0.42)";
const LANDSCAPE_HORIZONTAL_FOV_DEG_24MM = 74;
const COMPASS_MARKERS = [
  { label: "N", azimuthDeg: 0 },
  { label: "NNE", azimuthDeg: 22.5 },
  { label: "NE", azimuthDeg: 45 },
  { label: "ENE", azimuthDeg: 67.5 },
  { label: "E", azimuthDeg: 90 },
  { label: "ESE", azimuthDeg: 112.5 },
  { label: "SE", azimuthDeg: 135 },
  { label: "SSE", azimuthDeg: 157.5 },
  { label: "S", azimuthDeg: 180 },
  { label: "SSW", azimuthDeg: 202.5 },
  { label: "SW", azimuthDeg: 225 },
  { label: "WSW", azimuthDeg: 247.5 },
  { label: "W", azimuthDeg: 270 },
  { label: "WNW", azimuthDeg: 292.5 },
  { label: "NW", azimuthDeg: 315 },
  { label: "NNW", azimuthDeg: 337.5 },
] as const;

function normalizeSignedDeltaDeg(fromDeg: number, toDeg: number) {
  const delta = ((toDeg - fromDeg + 540) % 360) - 180;
  return delta === -180 ? 180 : delta;
}

export type PhotographyGuidePayload = {
  eclipseId: string;
  eclipseDateYmd: string;
  visible: boolean;
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
  observer: {
    latDeg: number;
    lonDeg: number;
    elevM?: number;
  };
};

type PhotographyGuideScreenProps = {
  payload: PhotographyGuidePayload;
  onBack: () => void;
  onOpenMenu: () => void;
};

function kindLabel(kindAtLocation: EclipseKindAtLocation) {
  if (kindAtLocation === "total") return "Total";
  if (kindAtLocation === "annular") return "Annular";
  if (kindAtLocation === "partial") return "Partial";
  return "None";
}

function formatObserver(observer: PhotographyGuidePayload["observer"]) {
  const lat = observer.latDeg.toFixed(4);
  const lon = observer.lonDeg.toFixed(4);
  if (typeof observer.elevM === "number" && Number.isFinite(observer.elevM)) {
    return `${lat}, ${lon} (${observer.elevM.toFixed(0)}m)`;
  }
  return `${lat}, ${lon}`;
}

export default function PhotographyGuideScreen({
  payload,
  onBack,
  onOpenMenu,
}: PhotographyGuideScreenProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [totalPictures, setTotalPictures] = useState<PhotographyGuidePictureCount>(5);
  const [isCountPickerOpen, setIsCountPickerOpen] = useState(false);
  const [isLandscapeCompositeOpen, setIsLandscapeCompositeOpen] = useState(false);
  const [showCompositeMarkings, setShowCompositeMarkings] = useState(true);
  const [compositeStageSize, setCompositeStageSize] = useState({
    width: 0,
    height: 0,
  });
  const isTotalCompositeTheme = payload.kindAtLocation === "total";
  const isWithinEclipseArea = payload.visible && payload.kindAtLocation !== "none";
  const scheduleResult = useMemo(
    () =>
      buildPhotographyGuideSchedule({
        visible: payload.visible,
        totalPictures,
        kindAtLocation: payload.kindAtLocation,
        c1Utc: payload.c1Utc,
        c2Utc: payload.c2Utc,
        maxUtc: payload.maxUtc,
        c3Utc: payload.c3Utc,
        c4Utc: payload.c4Utc,
      }),
    [
      payload.c1Utc,
      payload.c2Utc,
      payload.c3Utc,
      payload.c4Utc,
      payload.kindAtLocation,
      payload.maxUtc,
      payload.visible,
      totalPictures,
    ],
  );
  const previewTravelVector = useMemo(
    () =>
      determinePreviewTravelVector({
        c1BearingDeg: payload.c1BearingDeg,
        c2BearingDeg: payload.c2BearingDeg,
        c3BearingDeg: payload.c3BearingDeg,
        c4BearingDeg: payload.c4BearingDeg,
      }),
    [payload.c1BearingDeg, payload.c2BearingDeg, payload.c3BearingDeg, payload.c4BearingDeg],
  );
  const scheduleRowsWithPreview = useMemo(() => {
    if (!scheduleResult.ok) {
      return [] as Array<
        PhotographyGuideRow & { moonGeometry: ReturnType<typeof calculatePreviewMoonGeometry> }
      >;
    }
    return scheduleResult.schedule.rows.map((row) => ({
      ...row,
      moonGeometry: calculatePreviewMoonGeometry({
        progress: row.progress,
        kindAtLocation: payload.kindAtLocation,
        magnitude: payload.magnitude,
        contacts: scheduleResult.schedule.contacts,
        stageSize: TABLE_THUMB_STAGE_SIZE,
        sunRadius: TABLE_THUMB_SUN_RADIUS,
        travelVector: previewTravelVector,
      }),
    }));
  }, [payload.kindAtLocation, payload.magnitude, previewTravelVector, scheduleResult]);
  const compositeLayout = useMemo(() => {
    if (!scheduleResult.ok) return null;
    if (compositeStageSize.width <= 1 || compositeStageSize.height <= 1) return null;

    return buildLandscapeCompositeLayout({
      schedule: scheduleResult.schedule,
      kindAtLocation: payload.kindAtLocation,
      magnitude: payload.magnitude,
      maxUtc: payload.maxUtc,
      frameWidth: compositeStageSize.width,
      frameHeight: compositeStageSize.height,
      observer: {
        latDeg: payload.observer.latDeg,
        lonDeg: payload.observer.lonDeg,
      },
      travelVector: previewTravelVector,
    });
  }, [
    compositeStageSize.height,
    compositeStageSize.width,
    payload.kindAtLocation,
    payload.magnitude,
    payload.maxUtc,
    payload.observer.latDeg,
    payload.observer.lonDeg,
    previewTravelVector,
    scheduleResult,
  ]);
  const activeCompositeHorizonY = useMemo(() => {
    const fallback = compositeStageSize.height > 0 ? compositeStageSize.height * 0.76 : undefined;
    if (!compositeLayout) return fallback;
    return compositeLayout.horizonY;
  }, [compositeLayout, compositeStageSize.height]);
  const compositeGroundHeight = useMemo(() => {
    if (typeof activeCompositeHorizonY !== "number") return undefined;
    return Math.max(0, compositeStageSize.height - activeCompositeHorizonY);
  }, [activeCompositeHorizonY, compositeStageSize.height]);
  const horizonCompassMarkers = useMemo(() => {
    if (!compositeLayout) return [];
    const maxPlacement = compositeLayout.placements.find(
      (placement) => placement.phaseBucket === "MAX" && typeof placement.sunAzimuthDeg === "number",
    );
    if (!maxPlacement || typeof maxPlacement.sunAzimuthDeg !== "number") return [];
    const centerAzimuthDeg = maxPlacement.sunAzimuthDeg;

    return COMPASS_MARKERS.map((marker) => {
      const deltaDeg = normalizeSignedDeltaDeg(centerAzimuthDeg, marker.azimuthDeg);
      const x =
        compositeLayout.anchorX +
        (deltaDeg / LANDSCAPE_HORIZONTAL_FOV_DEG_24MM) * compositeStageSize.width;
      return { ...marker, x, inFrame: x >= 0 && x <= compositeStageSize.width };
    }).filter((marker) => marker.inFrame);
  }, [compositeLayout, compositeStageSize.width]);
  const handleCompositeStageLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    if (nextWidth <= 0 || nextHeight <= 0) return;
    if (nextWidth === compositeStageSize.width && nextHeight === compositeStageSize.height) {
      return;
    }
    setCompositeStageSize({
      width: nextWidth,
      height: nextHeight,
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.headerRow}>
        <BurgerButton onPress={onOpenMenu} />
        <Pressable style={styles.backBtn} onPress={onBack} accessibilityRole="button">
          <Text style={styles.backBtnText}>Back</Text>
        </Pressable>
        <View style={styles.headerMeta}>
          <Text style={styles.headerTitle}>Photography Guide</Text>
          <Text style={styles.headerSubtitle}>
            {payload.eclipseId}
            {payload.eclipseDateYmd ? ` - ${payload.eclipseDateYmd}` : ""}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.contextCard}>
          <Text style={styles.contextTitle}>Current Observer Context</Text>
          <Text style={styles.contextLine}>Type: {kindLabel(payload.kindAtLocation)}</Text>
          <Text style={styles.contextLine}>Observer: {formatObserver(payload.observer)}</Text>
          {payload.maxUtc ? (
            <>
              <Text style={styles.contextLine}>MAX (UTC): {fmtUtcHuman(payload.maxUtc)}</Text>
              <Text style={styles.contextLine}>MAX (Local): {fmtLocalHuman(payload.maxUtc)}</Text>
            </>
          ) : null}
        </View>

        <View style={styles.controlCard}>
          <Text style={styles.controlLabel}>Total pictures</Text>
          <Pressable
            style={[
              styles.countPickerButton,
              !isWithinEclipseArea ? styles.countPickerButtonDisabled : null,
            ]}
            onPress={() => setIsCountPickerOpen(true)}
            disabled={!isWithinEclipseArea}
            accessibilityRole="button"
            accessibilityLabel="Choose total pictures"
            accessibilityState={{ disabled: !isWithinEclipseArea }}
          >
            <Text style={styles.countPickerButtonText}>{totalPictures}</Text>
          </Pressable>
          {!isWithinEclipseArea ? (
            <Text style={styles.visibilityHint}>Must be within eclipse area</Text>
          ) : null}
        </View>

        {isWithinEclipseArea && scheduleResult.ok ? (
          <View style={styles.tableCard}>
            <Text style={styles.tableTitle}>Shot Schedule</Text>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableHeaderText, styles.indexCell]}>#</Text>
              <Text style={[styles.tableHeaderText, styles.timeCell]}>UTC / Local</Text>
              <Text style={[styles.tableHeaderText, styles.phaseCell]}>Phase</Text>
              <Text style={[styles.tableHeaderText, styles.previewCell]}>Preview</Text>
            </View>
            {scheduleRowsWithPreview.map((row) => (
              <View style={styles.tableRow} key={row.index}>
                <Text style={[styles.tableRowIndex, styles.indexCell]}>{row.index}</Text>
                <View style={styles.timeCell}>
                  <Text style={styles.tableUtcText}>{fmtUtcHuman(row.iso)}</Text>
                  <Text style={styles.tableLocalText}>{fmtLocalHuman(row.iso)}</Text>
                </View>
                <Text style={[styles.tablePhaseText, styles.phaseCell]}>{row.phaseBucket}</Text>
                <View style={[styles.previewCell, styles.tablePreviewWrap]}>
                  <View style={styles.tableThumbStage}>
                    <View style={styles.tableThumbSunDisk} />
                    {row.showMoon ? (
                      <View
                        style={[
                          styles.tableThumbMoon,
                          {
                            width: row.moonGeometry.moonRadius * 2,
                            height: row.moonGeometry.moonRadius * 2,
                            borderRadius: row.moonGeometry.moonRadius,
                            left: row.moonGeometry.moonCenterX - row.moonGeometry.moonRadius,
                            top: row.moonGeometry.moonCenterY - row.moonGeometry.moonRadius,
                          },
                        ]}
                      />
                    ) : null}
                  </View>
                </View>
              </View>
            ))}
            <Pressable
              style={styles.compositeBtn}
              onPress={() => setIsLandscapeCompositeOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Show landscape composite"
            >
              <Text style={styles.compositeBtnText}>Show landscape composite</Text>
            </Pressable>
          </View>
        ) : null}

        {isWithinEclipseArea && !scheduleResult.ok ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{scheduleResult.reason}</Text>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={isCountPickerOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setIsCountPickerOpen(false)}
      >
        <View style={styles.countPickerBackdrop}>
          <Pressable
            style={styles.countPickerBackdropDismiss}
            onPress={() => setIsCountPickerOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close total pictures options"
          />
          <View style={styles.countPickerModal}>
            <Text style={styles.countPickerModalTitle}>Total pictures</Text>
            {PHOTO_COUNT_OPTIONS.map((option) => {
              const isSelected = option === totalPictures;
              return (
                <Pressable
                  key={option}
                  style={[
                    styles.countPickerOption,
                    isSelected ? styles.countPickerOptionSelected : null,
                  ]}
                  onPress={() => {
                    setTotalPictures(option);
                    setIsCountPickerOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text
                    style={[
                      styles.countPickerOptionText,
                      isSelected ? styles.countPickerOptionTextSelected : null,
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>

      <Modal
        visible={isLandscapeCompositeOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setIsLandscapeCompositeOpen(false)}
      >
        <View style={styles.countPickerBackdrop}>
          <Pressable
            style={styles.countPickerBackdropDismiss}
            onPress={() => setIsLandscapeCompositeOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close landscape composite"
          />
          <View style={styles.compositeModal}>
            <Text style={styles.compositeModalTitle}>Landscape composite</Text>
            <Pressable
              style={styles.compositeMarkingsToggleBtn}
              onPress={() => setShowCompositeMarkings((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel="Toggle composite markings"
            >
              <Text style={styles.compositeMarkingsToggleText}>
                {showCompositeMarkings ? "Hide" : "Show"} markings, directions, and shot numbers
              </Text>
            </Pressable>
            <View style={styles.compositeFrame} onLayout={handleCompositeStageLayout}>
              <View
                style={[
                  styles.compositeSky,
                  isTotalCompositeTheme ? { backgroundColor: TOTALITY_SKY_COLOR } : null,
                ]}
              />
              <View
                style={[
                  styles.compositeGround,
                  isTotalCompositeTheme ? { backgroundColor: TOTALITY_GROUND_COLOR } : null,
                  typeof activeCompositeHorizonY === "number" &&
                  typeof compositeGroundHeight === "number"
                    ? {
                        top: activeCompositeHorizonY,
                        height: compositeGroundHeight,
                      }
                    : null,
                ]}
              />
              {isTotalCompositeTheme ? (
                <View
                  style={[
                    styles.compositeHorizonGlow,
                    typeof activeCompositeHorizonY === "number"
                      ? { top: Math.max(0, activeCompositeHorizonY - 2.5) }
                      : null,
                  ]}
                />
              ) : null}
              <View
                style={[
                  styles.compositeHorizon,
                  isTotalCompositeTheme ? { backgroundColor: TOTALITY_HORIZON_LINE_COLOR } : null,
                  typeof activeCompositeHorizonY === "number"
                    ? { top: activeCompositeHorizonY }
                    : null,
                ]}
              />
              {showCompositeMarkings && typeof activeCompositeHorizonY === "number"
                ? horizonCompassMarkers.map((marker) => (
                    <View key={`horizon-marker-${marker.label}`} style={{ left: marker.x - 10 }}>
                      <View
                        style={[
                          styles.compositeDirectionTick,
                          { top: activeCompositeHorizonY - 6 },
                        ]}
                      />
                      <Text
                        style={[
                          styles.compositeDirectionLabel,
                          { top: activeCompositeHorizonY + 4 },
                        ]}
                      >
                        {marker.label}
                      </Text>
                    </View>
                  ))
                : null}
              {compositeLayout ? (
                <>
                  <View
                    style={[
                      styles.compositeMaxAnchor,
                      {
                        left: compositeLayout.anchorX - 4,
                        top: compositeLayout.anchorY - 4,
                      },
                    ]}
                  />
                  {compositeLayout.placements.map((placement) => (
                    <View key={placement.index}>
                      {!placement.isAboveHorizon ? null : (
                        <>
                          {isTotalCompositeTheme &&
                          placement.phaseBucket === "MAX" &&
                          placement.showMoon &&
                          placement.moon ? (
                            <>
                              <View
                                style={[
                                  styles.compositeCoronaGlow,
                                  {
                                    width: Math.max(placement.sunRadius * 9, 16),
                                    height: Math.max(placement.sunRadius * 9, 16),
                                    borderRadius: Math.max(placement.sunRadius * 4.5, 8),
                                    left: placement.x - Math.max(placement.sunRadius * 4.5, 8),
                                    top: placement.y - Math.max(placement.sunRadius * 4.5, 8),
                                  },
                                ]}
                              />
                              <View
                                style={[
                                  styles.compositeCoronaRing,
                                  {
                                    width: Math.max(placement.sunRadius * 6, 10),
                                    height: Math.max(placement.sunRadius * 6, 10),
                                    borderRadius: Math.max(placement.sunRadius * 3, 5),
                                    left: placement.x - Math.max(placement.sunRadius * 3, 5),
                                    top: placement.y - Math.max(placement.sunRadius * 3, 5),
                                  },
                                ]}
                              />
                            </>
                          ) : null}
                          <View
                            style={[
                              styles.compositeSun,
                              {
                                width: placement.sunRadius * 2,
                                height: placement.sunRadius * 2,
                                borderRadius: placement.sunRadius,
                                left: placement.x - placement.sunRadius,
                                top: placement.y - placement.sunRadius,
                              },
                            ]}
                          />
                          {placement.showMoon && placement.moon ? (
                            <View
                              style={[
                                styles.compositeMoon,
                                isTotalCompositeTheme
                                  ? {
                                      backgroundColor: TOTALITY_MOON_COLOR,
                                      borderColor: TOTALITY_MOON_BORDER_COLOR,
                                    }
                                  : null,
                                {
                                  width: placement.moon.radius * 2,
                                  height: placement.moon.radius * 2,
                                  borderRadius: placement.moon.radius,
                                  left: placement.moon.x - placement.moon.radius,
                                  top: placement.moon.y - placement.moon.radius,
                                },
                              ]}
                            />
                          ) : null}
                          {showCompositeMarkings ? (
                            <View
                              style={[
                                styles.compositeShotIndexTag,
                                {
                                  left: placement.x - 9,
                                  top: placement.y + placement.sunRadius + 3,
                                },
                                placement.clamped ? styles.compositeShotIndexTagClamped : null,
                              ]}
                            >
                              <Text style={styles.compositeShotIndexText}>{placement.index}</Text>
                            </View>
                          ) : null}
                          {showCompositeMarkings && placement.clamped ? (
                            <View
                              style={[
                                styles.compositeClampIndicator,
                                {
                                  left: placement.x + placement.sunRadius - 4,
                                  top: placement.y - placement.sunRadius - 4,
                                },
                              ]}
                            />
                          ) : null}
                        </>
                      )}
                    </View>
                  ))}
                </>
              ) : null}
            </View>
            <Text style={styles.compositeModalBody}>
              24mm framing simulation with MAX anchored at frame center.
            </Text>
            <Text style={styles.compositeLegendText}>
              Numbers are shot indices. Horizon ticks show compass directions. Amber dots mark
              edge-clamped shots.
            </Text>
            <Pressable
              style={styles.compositeModalCloseBtn}
              onPress={() => setIsLandscapeCompositeOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close landscape composite panel"
            >
              <Text style={styles.compositeModalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerRow: {
      paddingHorizontal: 12,
      paddingTop: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    backBtn: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.surfaceMuted,
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    backBtnText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "700",
    },
    headerMeta: {
      flex: 1,
      gap: 2,
    },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "800",
    },
    headerSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
    },
    content: {
      paddingHorizontal: 12,
      paddingTop: 14,
      paddingBottom: 20,
      gap: 12,
    },
    contextCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: 12,
      paddingHorizontal: 12,
      gap: 4,
    },
    contextTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
      marginBottom: 2,
    },
    contextLine: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    controlCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: 12,
      paddingHorizontal: 12,
      gap: 8,
    },
    controlLabel: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "700",
    },
    countPickerButton: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.surfaceMuted,
      paddingVertical: 10,
      paddingHorizontal: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    countPickerButtonDisabled: {
      backgroundColor: colors.surfaceElevated,
      opacity: 0.7,
    },
    countPickerButtonText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    visibilityHint: {
      color: colors.textMuted,
      fontSize: 12,
    },
    tableCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: 12,
      paddingHorizontal: 12,
      gap: 6,
    },
    tableTitle: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "700",
    },
    tableHeaderRow: {
      marginTop: 2,
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 6,
      gap: 8,
    },
    tableHeaderText: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    tableRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 8,
    },
    indexCell: {
      width: 22,
      textAlign: "center",
    },
    timeCell: {
      flex: 1,
      minWidth: 0,
    },
    phaseCell: {
      width: 76,
      textAlign: "center",
    },
    previewCell: {
      width: 56,
      alignItems: "center",
      justifyContent: "center",
    },
    tableRowIndex: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: "700",
    },
    tableUtcText: {
      color: colors.textSecondary,
      fontSize: 11,
      lineHeight: 16,
    },
    tableLocalText: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 16,
    },
    tablePhaseText: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "700",
    },
    tablePreviewWrap: {
      alignItems: "center",
    },
    tableThumbStage: {
      width: TABLE_THUMB_STAGE_SIZE,
      height: TABLE_THUMB_STAGE_SIZE,
      borderRadius: TABLE_THUMB_STAGE_SIZE / 2,
      backgroundColor: "transparent",
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
    },
    tableThumbSunDisk: {
      width: TABLE_THUMB_SUN_RADIUS * 2,
      height: TABLE_THUMB_SUN_RADIUS * 2,
      borderRadius: TABLE_THUMB_SUN_RADIUS,
      backgroundColor: "#ffd36f",
      borderWidth: 1,
      borderColor: "#ffe2a6",
    },
    tableThumbMoon: {
      position: "absolute",
      backgroundColor: "#0d1020",
      borderWidth: 1,
      borderColor: "#3d4267",
    },
    compositeBtn: {
      marginTop: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.surfaceMuted,
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    compositeBtnText: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "700",
    },
    errorCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.dangerBorder,
      backgroundColor: colors.dangerBackground,
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
    errorText: {
      color: colors.dangerText,
      fontSize: 12,
      lineHeight: 18,
    },
    countPickerBackdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    countPickerBackdropDismiss: {
      ...StyleSheet.absoluteFillObject,
    },
    countPickerModal: {
      width: "100%",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.surface,
      paddingVertical: 12,
      paddingHorizontal: 12,
      gap: 8,
    },
    countPickerModalTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    countPickerOption: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    countPickerOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
    },
    countPickerOptionText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "700",
    },
    countPickerOptionTextSelected: {
      color: colors.textPrimary,
    },
    compositeFrame: {
      width: "100%",
      aspectRatio: 16 / 9,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.16)",
      overflow: "hidden",
      backgroundColor: "#89b7ef",
    },
    compositeSky: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "#89b7ef",
    },
    compositeGround: {
      position: "absolute",
      left: 0,
      right: 0,
      top: "76%",
      height: "24%",
      backgroundColor: "#314451",
    },
    compositeHorizon: {
      position: "absolute",
      left: 0,
      right: 0,
      top: "76%",
      height: 1,
      backgroundColor: "rgba(255,255,255,0.45)",
    },
    compositeHorizonGlow: {
      position: "absolute",
      left: 0,
      right: 0,
      height: 5,
      backgroundColor: TOTALITY_HORIZON_GLOW_COLOR,
      opacity: 0.95,
    },
    compositeMaxAnchor: {
      position: "absolute",
      width: 8,
      height: 8,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.9)",
      backgroundColor: "rgba(255,255,255,0.28)",
    },
    compositeSun: {
      position: "absolute",
      backgroundColor: "#ffd36f",
      borderWidth: 1,
      borderColor: "#ffe2a6",
    },
    compositeMoon: {
      position: "absolute",
      backgroundColor: "#0d1020",
      borderWidth: 1,
      borderColor: "#3d4267",
    },
    compositeCoronaGlow: {
      position: "absolute",
      backgroundColor: "rgba(198, 228, 255, 0.20)",
      borderWidth: 0,
    },
    compositeCoronaRing: {
      position: "absolute",
      borderWidth: 1,
      borderColor: "rgba(236, 248, 255, 0.92)",
      backgroundColor: "transparent",
    },
    compositeShotIndexTag: {
      position: "absolute",
      minWidth: 18,
      height: 16,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.55)",
      backgroundColor: "rgba(0,0,0,0.36)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    compositeShotIndexTagClamped: {
      borderColor: "#ffc26b",
      backgroundColor: "rgba(70, 43, 0, 0.5)",
    },
    compositeShotIndexText: {
      color: "#ffffff",
      fontSize: 10,
      fontWeight: "800",
      lineHeight: 12,
    },
    compositeClampIndicator: {
      position: "absolute",
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: "#ffc26b",
      borderWidth: 1,
      borderColor: "#7a5222",
      opacity: 0.9,
    },
    compositeDirectionTick: {
      position: "absolute",
      width: 1,
      height: 12,
      backgroundColor: "rgba(255,255,255,0.7)",
    },
    compositeDirectionLabel: {
      position: "absolute",
      width: 20,
      textAlign: "center",
      color: "#ffffff",
      fontSize: 9,
      fontWeight: "700",
      textShadowColor: "rgba(0,0,0,0.4)",
      textShadowRadius: 2,
      textShadowOffset: { width: 0, height: 1 },
    },
    compositeMarkingsToggleBtn: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.surfaceMuted,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    compositeMarkingsToggleText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "700",
    },
    compositeModal: {
      width: "100%",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.surface,
      paddingVertical: 12,
      paddingHorizontal: 12,
      gap: 10,
    },
    compositeModalTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    compositeModalBody: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    compositeLegendText: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 16,
    },
    compositeModalCloseBtn: {
      alignSelf: "flex-end",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.surfaceMuted,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    compositeModalCloseText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "700",
    },
  });
}
