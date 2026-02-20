import type { Circumstances, EclipseRecord } from "@eclipse-timer/shared";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Marker, Polygon, Polyline } from "react-native-maps";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { APP_LOGO } from "../assets/branding";
import BurgerButton from "../components/BurgerButton";
import type { TimerState } from "../hooks/useTimerState";
import type { FavoriteLocation } from "../state/appState";
import { colorForContactKey } from "../utils/contactTheme";
import { fmtLocalHuman, fmtUtcHuman } from "../utils/date";
import { eclipseCenterForRecord, kindCodeForRecord } from "../utils/eclipse";

const VISIBLE_PATH_COLOR = "rgba(79, 195, 247, 0.22)";
const TOTALITY_PATH_COLOR = "rgba(255, 82, 82, 0.28)";
const ANNULARITY_PATH_COLOR = "rgba(255, 167, 38, 0.30)";
const FAVORITE_COORD_EPSILON = 0.0001;
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

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

function formatCardinalCoord(
  value: number,
  positiveHemisphere: string,
  negativeHemisphere: string,
) {
  const hemisphere = value >= 0 ? positiveHemisphere : negativeHemisphere;
  return `${Math.abs(value).toFixed(4)}${hemisphere}`;
}

function buildDefaultFavoriteName(lat: number, lon: number, favoriteLocations: FavoriteLocation[]) {
  const base = `Pinned ${formatCardinalCoord(lat, "N", "S")} ${formatCardinalCoord(lon, "E", "W")}`;
  const existingNames = new Set(
    favoriteLocations.map((location) => location.name.trim().toLowerCase()).filter(Boolean),
  );
  if (!existingNames.has(base.toLowerCase())) return base;

  let suffix = 2;
  while (existingNames.has(`${base} ${suffix}`.toLowerCase())) {
    suffix += 1;
  }
  return `${base} ${suffix}`;
}

function isSameFavoriteLocation(aLat: number, aLon: number, bLat: number, bLon: number) {
  return (
    Math.abs(aLat - bLat) <= FAVORITE_COORD_EPSILON &&
    Math.abs(aLon - bLon) <= FAVORITE_COORD_EPSILON
  );
}

function clamp(value: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, value));
}

function normalizeLongitudeDeg(lonDeg: number) {
  return (((lonDeg % 360) + 540) % 360) - 180;
}

function destinationPoint(
  latDeg: number,
  lonDeg: number,
  bearingDeg: number,
  distanceDeg: number,
): { latitude: number; longitude: number } {
  const lat1 = latDeg * DEG2RAD;
  const lon1 = lonDeg * DEG2RAD;
  const brng = bearingDeg * DEG2RAD;
  const angularDistance = distanceDeg * DEG2RAD;
  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinD = Math.sin(angularDistance);
  const cosD = Math.cos(angularDistance);
  const lat2 = Math.asin(sinLat1 * cosD + cosLat1 * sinD * Math.cos(brng));
  const lon2 = lon1 + Math.atan2(Math.sin(brng) * sinD * cosLat1, cosD - sinLat1 * Math.sin(lat2));

  return {
    latitude: clamp(lat2 * RAD2DEG, -89.9, 89.9),
    longitude: normalizeLongitudeDeg(lon2 * RAD2DEG),
  };
}

type ContactDirectionOverlay = {
  key: "c1" | "c2" | "c3" | "c4";
  label: "C1" | "C2" | "C3" | "C4";
  color: string;
  bearingDeg: number;
  endpoint: { latitude: number; longitude: number };
};

export type TimerEclipseOption = {
  id: string;
  dateYmd: string;
  kindLabel: string;
  isPast: boolean;
};

type TimerScreenProps = {
  activeEclipse: EclipseRecord | null;
  activeEclipseId: string | null;
  isActiveEclipseLoading: boolean;
  eclipseOptions: TimerEclipseOption[];
  timer: TimerState;
  isEclipseAlarmEnabled: boolean;
  favoriteLocations: FavoriteLocation[];
  onSetEclipseAlarmEnabled: (enabled: boolean) => void;
  onAddFavoriteLocation: (location: Omit<FavoriteLocation, "id">) => void;
  onSelectEclipse: (eclipseId: string) => void;
  onUseFavoriteLocation: (location: FavoriteLocation) => void;
  onOpenMenu: () => void;
  onOpenPreview: (result: Circumstances) => void;
};

export default function TimerScreen({
  activeEclipse,
  activeEclipseId,
  isActiveEclipseLoading,
  eclipseOptions,
  timer,
  isEclipseAlarmEnabled,
  favoriteLocations,
  onSetEclipseAlarmEnabled,
  onAddFavoriteLocation,
  onSelectEclipse,
  onUseFavoriteLocation,
  onOpenMenu,
  onOpenPreview,
}: TimerScreenProps) {
  const insets = useSafeAreaInsets();
  const [isEclipsePickerOpen, setIsEclipsePickerOpen] = useState(false);
  const [isAddFavoriteModalOpen, setIsAddFavoriteModalOpen] = useState(false);
  const [favoriteModalName, setFavoriteModalName] = useState("");
  const [favoriteModalDefaultName, setFavoriteModalDefaultName] = useState("");
  const [favoriteModalPin, setFavoriteModalPin] = useState<{ lat: number; lon: number } | null>(
    null,
  );
  const activeEclipseOption = useMemo(
    () => eclipseOptions.find((option) => option.id === activeEclipseId) ?? null,
    [activeEclipseId, eclipseOptions],
  );
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
  const favoriteAtCurrentPin = useMemo(
    () =>
      favoriteLocations.find((location) =>
        isSameFavoriteLocation(location.lat, location.lon, timer.pin.lat, timer.pin.lon),
      ) ?? null,
    [favoriteLocations, timer.pin.lat, timer.pin.lon],
  );
  const canAddCurrentPinToFavorites = !favoriteAtCurrentPin;
  const contactDirectionOverlays = useMemo<ContactDirectionOverlay[]>(() => {
    if (!timer.result || !timer.isResultCurrentForPin) return [];

    const arrowDistanceDeg = clamp(timer.region.latitudeDelta * 0.28, 0.18, 2.2);
    const entries = [
      {
        key: "c1",
        label: "C1",
        bearingDeg: timer.result.c1BearingDeg,
        color: colorForContactKey("c1"),
      },
      {
        key: "c2",
        label: "C2",
        bearingDeg: timer.result.c2BearingDeg,
        color: colorForContactKey("c2"),
      },
      {
        key: "c3",
        label: "C3",
        bearingDeg: timer.result.c3BearingDeg,
        color: colorForContactKey("c3"),
      },
      {
        key: "c4",
        label: "C4",
        bearingDeg: timer.result.c4BearingDeg,
        color: colorForContactKey("c4"),
      },
    ] as const;

    const overlays: ContactDirectionOverlay[] = [];
    for (const entry of entries) {
      if (typeof entry.bearingDeg !== "number" || !Number.isFinite(entry.bearingDeg)) continue;
      const bearingDeg = ((entry.bearingDeg % 360) + 360) % 360;
      overlays.push({
        key: entry.key,
        label: entry.label,
        color: entry.color,
        bearingDeg,
        endpoint: destinationPoint(timer.pin.lat, timer.pin.lon, bearingDeg, arrowDistanceDeg),
      });
    }
    return overlays;
  }, [
    timer.isResultCurrentForPin,
    timer.pin.lat,
    timer.pin.lon,
    timer.region.latitudeDelta,
    timer.result,
  ]);
  const hasDirectionsData = contactDirectionOverlays.length > 0;

  const closeAddFavoriteModal = () => {
    setIsAddFavoriteModalOpen(false);
    setFavoriteModalName("");
    setFavoriteModalDefaultName("");
    setFavoriteModalPin(null);
  };
  const closeEclipsePicker = () => {
    setIsEclipsePickerOpen(false);
  };

  const openAddFavoriteModal = () => {
    if (!canAddCurrentPinToFavorites) return;

    const nextPin = { lat: timer.pin.lat, lon: timer.pin.lon };
    const compiledDefaultName = buildDefaultFavoriteName(
      nextPin.lat,
      nextPin.lon,
      favoriteLocations,
    );
    setFavoriteModalPin(nextPin);
    setFavoriteModalDefaultName(compiledDefaultName);
    setFavoriteModalName(compiledDefaultName);
    setIsAddFavoriteModalOpen(true);
  };

  const submitAddFavorite = () => {
    if (!favoriteModalPin) return;
    const name = favoriteModalName.trim() || favoriteModalDefaultName;

    onAddFavoriteLocation({
      name,
      lat: favoriteModalPin.lat,
      lon: favoriteModalPin.lon,
    });
    timer.setStatusMessage(`Saved ${name} to favorites`);
    closeAddFavoriteModal();
  };
  const openEclipsePicker = () => {
    if (!eclipseOptions.length) return;
    setIsEclipsePickerOpen(true);
  };
  const selectEclipseFromPicker = (eclipseId: string) => {
    const normalizedId = eclipseId.trim();
    if (!normalizedId) return;
    closeEclipsePicker();
    onSelectEclipse(normalizedId);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.header}>
        <BurgerButton onPress={onOpenMenu} />
        <View style={styles.headerMeta}>
          <View style={styles.headerBrandRow}>
            <Image source={APP_LOGO} style={styles.headerLogo} resizeMode="contain" />
            <Text style={styles.title}>Eclipse Timer (MVP)</Text>
          </View>
          <Text style={styles.subtitle}>
            {isActiveEclipseLoading
              ? "Loading eclipse data..."
              : activeEclipse
                ? `${activeEclipse.id} - ${activeEclipse.dateYmd}`
                : "No eclipse loaded"}
          </Text>
        </View>
      </View>

      <View style={styles.eclipseSwitcherWrap}>
        <Pressable
          style={[
            styles.eclipseSwitcherBtn,
            isActiveEclipseLoading ? styles.eclipseSwitcherBtnDisabled : null,
          ]}
          onPress={openEclipsePicker}
          disabled={!eclipseOptions.length || isActiveEclipseLoading}
          accessibilityRole="button"
          accessibilityLabel="Switch active eclipse"
          accessibilityState={{ disabled: !eclipseOptions.length || isActiveEclipseLoading }}
        >
          <View style={styles.eclipseSwitcherTopRow}>
            <Text style={styles.eclipseSwitcherLabel}>Active Eclipse</Text>
            <Text style={styles.eclipseSwitcherHint}>Switch</Text>
          </View>
          <Text style={styles.eclipseSwitcherValue}>
            {activeEclipseOption
              ? `${activeEclipseOption.dateYmd} - ${activeEclipseOption.kindLabel}`
              : "No eclipse selected"}
          </Text>
          <Text style={styles.eclipseSwitcherMeta}>
            {activeEclipseOption
              ? `${activeEclipseOption.id} - ${activeEclipseOption.isPast ? "Past" : "Upcoming"}`
              : "Pick an eclipse to compute on this screen"}
          </Text>
        </Pressable>
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
          {timer.showVisibleOverlay
            ? timer.overlayVisiblePolygons.map((coordinates, idx) => (
                <Polygon
                  key={`visible-${idx}`}
                  coordinates={coordinates}
                  fillColor={VISIBLE_PATH_COLOR}
                  strokeColor="rgba(79, 195, 247, 0.05)"
                  strokeWidth={0.5}
                />
              ))
            : null}
          {timer.showCentralOverlay
            ? timer.overlayCentralPolygons.map((coordinates, idx) => (
                <Polygon
                  key={`central-${idx}`}
                  coordinates={coordinates}
                  fillColor={centralOverlayColor}
                  strokeColor="rgba(255,255,255,0.08)"
                  strokeWidth={0.5}
                />
              ))
            : null}
          <Marker
            coordinate={{ latitude: timer.pin.lat, longitude: timer.pin.lon }}
            draggable
            onDragEnd={timer.onDragEnd}
            title="Observer"
            description={`${timer.pin.lat.toFixed(4)}, ${timer.pin.lon.toFixed(4)}`}
          />
          {timer.showDirectionsOverlay
            ? contactDirectionOverlays.map((direction) => (
                <Polyline
                  key={`direction-line-${direction.key}`}
                  coordinates={[
                    { latitude: timer.pin.lat, longitude: timer.pin.lon },
                    direction.endpoint,
                  ]}
                  strokeColor={direction.color}
                  strokeWidth={2}
                  lineDashPattern={[5, 4]}
                />
              ))
            : null}
          {timer.showDirectionsOverlay
            ? contactDirectionOverlays.map((direction) => (
                <Marker
                  key={`direction-marker-${direction.key}`}
                  coordinate={direction.endpoint}
                  anchor={{ x: 0.5, y: 0.5 }}
                  tracksViewChanges={false}
                  title={`${direction.label} direction`}
                  description={`${Math.round(direction.bearingDeg)}° from pin`}
                >
                  <View style={styles.contactDirectionBadge}>
                    <Text
                      style={[
                        styles.contactDirectionArrow,
                        {
                          color: direction.color,
                          transform: [{ rotate: `${direction.bearingDeg}deg` }],
                        },
                      ]}
                    >
                      ▲
                    </Text>
                    <Text style={[styles.contactDirectionLabel, { color: direction.color }]}>
                      {direction.label}
                    </Text>
                  </View>
                </Marker>
              ))
            : null}
        </MapView>

        <Pressable
          style={styles.mapGpsBtn}
          onPress={timer.useGps}
          accessibilityRole="button"
          accessibilityLabel="Use current GPS location"
        >
          <View style={styles.mapGpsIcon}>
            <View style={styles.mapGpsIconCrossVertical} />
            <View style={styles.mapGpsIconCrossHorizontal} />
            <View style={styles.mapGpsIconRing}>
              <View style={styles.mapGpsIconDot} />
            </View>
          </View>
        </Pressable>

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
          <Pressable
            style={[
              styles.mapLegendItem,
              !timer.showVisibleOverlay ? styles.mapLegendMuted : null,
              !timer.hasVisibleOverlayData ? styles.mapLegendDisabled : null,
            ]}
            onPress={timer.toggleVisibleOverlay}
            disabled={!timer.hasVisibleOverlayData}
            accessibilityRole="button"
            accessibilityLabel={
              timer.showVisibleOverlay
                ? "Hide eclipse visible overlay"
                : "Show eclipse visible overlay"
            }
          >
            <View style={styles.mapLegendRow}>
              <View style={[styles.mapLegendSwatch, { backgroundColor: VISIBLE_PATH_COLOR }]} />
              <Text style={styles.mapLegendText}>Eclipse Visible</Text>
            </View>
            <Text style={styles.mapLegendState}>{timer.showVisibleOverlay ? "On" : "Off"}</Text>
          </Pressable>

          <Pressable
            style={[
              styles.mapLegendItem,
              !timer.showCentralOverlay ? styles.mapLegendMuted : null,
              !timer.hasCentralOverlayData ? styles.mapLegendDisabled : null,
            ]}
            onPress={timer.toggleCentralOverlay}
            disabled={!timer.hasCentralOverlayData}
            accessibilityRole="button"
            accessibilityLabel={
              timer.showCentralOverlay ? "Hide central path overlay" : "Show central path overlay"
            }
          >
            <View style={styles.mapLegendRow}>
              <View style={[styles.mapLegendSwatch, { backgroundColor: centralOverlayColor }]} />
              <Text style={styles.mapLegendText}>{centralLegendLabel}</Text>
            </View>
            <Text style={styles.mapLegendState}>{timer.showCentralOverlay ? "On" : "Off"}</Text>
          </Pressable>
        </View>

        {timer.result && timer.isResultCurrentForPin ? (
          <Pressable
            style={[
              styles.mapDirectionLegend,
              !timer.showDirectionsOverlay ? styles.mapLegendMuted : null,
              !hasDirectionsData ? styles.mapLegendDisabled : null,
            ]}
            onPress={timer.toggleDirectionsOverlay}
            disabled={!hasDirectionsData}
            accessibilityRole="button"
            accessibilityLabel={
              timer.showDirectionsOverlay ? "Hide direction overlays" : "Show direction overlays"
            }
          >
            <View style={styles.mapDirectionLegendHeader}>
              <Text style={styles.mapDirectionLegendTitle}>Directions</Text>
              <Text style={styles.mapLegendState}>
                {timer.showDirectionsOverlay ? "On" : "Off"}
              </Text>
            </View>
            {contactDirectionOverlays.map((direction) => (
              <View key={`direction-legend-${direction.key}`} style={styles.mapDirectionLegendRow}>
                <View
                  style={[styles.mapDirectionLegendLine, { borderTopColor: direction.color }]}
                />
                <Text style={[styles.mapDirectionLegendText, { color: direction.color }]}>
                  {direction.label}
                </Text>
              </View>
            ))}
          </Pressable>
        ) : null}
      </View>

      <View style={styles.controls}>
        <View style={styles.btnRow}>
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

          <Pressable
            style={[styles.btn, !canAddCurrentPinToFavorites ? styles.btnDisabled : null]}
            onPress={openAddFavoriteModal}
            disabled={!canAddCurrentPinToFavorites}
          >
            <Text style={styles.btnText}>
              {canAddCurrentPinToFavorites ? "Add to Favorites" : "Already in Favorites"}
            </Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={isEclipsePickerOpen}
        transparent
        animationType="fade"
        onRequestClose={closeEclipsePicker}
      >
        <View style={styles.eclipsePickerBackdrop}>
          <View style={styles.eclipsePickerCard}>
            <Text style={styles.eclipsePickerTitle}>Select Eclipse</Text>
            <Text style={styles.eclipsePickerSubtitle}>
              Switch eclipses without leaving the timer screen.
            </Text>
            <FlatList
              data={eclipseOptions}
              keyExtractor={(item) => item.id}
              style={styles.eclipsePickerList}
              contentContainerStyle={styles.eclipsePickerListContent}
              renderItem={({ item }) => {
                const isSelected = item.id === activeEclipseId;
                return (
                  <Pressable
                    style={[
                      styles.eclipsePickerItem,
                      isSelected ? styles.eclipsePickerItemSelected : null,
                    ]}
                    onPress={() => selectEclipseFromPicker(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.dateYmd} ${item.kindLabel}, ${item.isPast ? "past" : "upcoming"}`}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={[
                        styles.eclipsePickerItemTitle,
                        isSelected ? styles.eclipsePickerItemTitleSelected : null,
                      ]}
                    >
                      {item.dateYmd} {item.kindLabel}
                    </Text>
                    <Text
                      style={[
                        styles.eclipsePickerItemMeta,
                        isSelected ? styles.eclipsePickerItemMetaSelected : null,
                      ]}
                    >
                      {item.id} - {item.isPast ? "Past" : "Upcoming"}
                    </Text>
                  </Pressable>
                );
              }}
            />
            <Pressable style={styles.eclipsePickerCloseBtn} onPress={closeEclipsePicker}>
              <Text style={styles.eclipsePickerCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isAddFavoriteModalOpen}
        transparent
        animationType="fade"
        onRequestClose={closeAddFavoriteModal}
      >
        <View style={styles.favoriteModalBackdrop}>
          <View style={styles.favoriteModalCard}>
            <Text style={styles.favoriteModalTitle}>Add to Favorites</Text>
            <Text style={styles.favoriteModalSubtitle}>Name this location (optional)</Text>
            <TextInput
              value={favoriteModalName}
              onChangeText={setFavoriteModalName}
              placeholder={favoriteModalDefaultName}
              placeholderTextColor="#707070"
              style={styles.favoriteModalInput}
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
            />
            {favoriteModalPin ? (
              <Text style={styles.favoriteModalCoords}>
                {favoriteModalPin.lat.toFixed(4)}, {favoriteModalPin.lon.toFixed(4)}
              </Text>
            ) : null}
            <View style={styles.favoriteModalActions}>
              <Pressable style={styles.favoriteModalCancelBtn} onPress={closeAddFavoriteModal}>
                <Text style={styles.favoriteModalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.favoriteModalSaveBtn} onPress={submitAddFavorite}>
                <Text style={styles.favoriteModalSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.favoriteWrap}>
        {favoriteLocations.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.favoriteList}
          >
            {favoriteLocations.map((location) => (
              <Pressable
                key={location.id}
                style={styles.favoriteChip}
                onPress={() => onUseFavoriteLocation(location)}
              >
                <Text style={styles.favoriteChipText}>{location.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.favoriteEmpty}>
            No saved favorites yet. Add one from Menu {" > "} Location Settings.
          </Text>
        )}
      </View>

      <View style={styles.statusBar}>
        <Text style={styles.statusText}>{timer.status}</Text>
      </View>

      <ScrollView
        style={styles.results}
        contentContainerStyle={[
          styles.resultsContent,
          { paddingBottom: Math.max(28, insets.bottom + 18) },
        ]}
      >
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
          {isActiveEclipseLoading && !timer.result ? (
            <View style={styles.loadingCardState}>
              <ActivityIndicator />
              <Text style={styles.muted}>Loading overlays and eclipse metadata...</Text>
            </View>
          ) : !timer.result ? (
            <Text style={styles.muted}>
              {timer.isComputing
                ? "Computing eclipse circumstances..."
                : "Eclipse circumstances will auto-compute for the current pin."}
            </Text>
          ) : (
            <>
              <View style={styles.timerHero}>
                <Text style={styles.timerHeroLabel}>Next Event Timer</Text>
                <Text style={styles.timerHeroText}>{timer.nextEventCountdownText}</Text>
              </View>

              <View style={styles.metricRow}>
                <View style={styles.metricTile}>
                  <Text style={styles.metricLabel}>Type</Text>
                  <Text style={styles.metricValue}>
                    {localKindLabel(timer.result.kindAtLocation)}
                  </Text>
                </View>
                <View style={styles.metricTile}>
                  <Text style={styles.metricLabel}>Magnitude</Text>
                  <Text style={styles.metricValue}>{formatMagnitude(timer.result.magnitude)}</Text>
                </View>
                <View style={styles.metricTile}>
                  <Text style={styles.metricLabel}>Central Duration</Text>
                  <Text style={styles.metricValue}>
                    {formatDuration(timer.result.durationSeconds)}
                  </Text>
                </View>
              </View>

              <View style={styles.eclipseAlarmCard}>
                <View style={styles.eclipseAlarmCardMain}>
                  <Text style={styles.eclipseAlarmCardTitle}>
                    Enable alarms and reminders for this eclipse
                  </Text>
                  <Text style={styles.eclipseAlarmCardDescription}>
                    Enables fixed T-1h/T-10m reminders and per-event in-app `a1/a2` alarms.
                  </Text>
                </View>
                <Switch
                  value={isEclipseAlarmEnabled}
                  onValueChange={onSetEclipseAlarmEnabled}
                  disabled={!activeEclipse}
                  accessibilityRole="switch"
                  accessibilityLabel="Enable alarms and reminders for this eclipse"
                />
              </View>

              {!timer.notificationsEnabled ? (
                <Text style={styles.notificationsDisabledHint}>
                  Eclipse alarms/reminders are off for this eclipse. Enable them above.
                </Text>
              ) : null}

              <View style={styles.sep} />

              {timer.contactItems.map((item) => (
                <View
                  style={[
                    styles.contactRow,
                    !isEclipseAlarmEnabled ? styles.contactRowDisabled : null,
                  ]}
                  key={item.key}
                >
                  <View style={styles.contactMain}>
                    <View style={styles.contactLabelRow}>
                      <View
                        style={[
                          styles.contactKeyBadge,
                          {
                            borderColor: colorForContactKey(item.key),
                            backgroundColor: "rgba(255,255,255,0.04)",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.contactKeyBadgeText,
                            { color: colorForContactKey(item.key) },
                          ]}
                        >
                          {item.key === "max" ? "MAX" : item.key.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.contactLabel}>{item.label}</Text>
                    </View>
                    <Text style={styles.contactTime}>UTC: {fmtUtcHuman(item.iso)}</Text>
                    <Text
                      style={[styles.contactTimeLocal, { color: colorForContactKey(item.key) }]}
                    >
                      Local: {fmtLocalHuman(item.iso)}
                    </Text>
                  </View>
                  <View style={styles.contactAlarm}>
                    <Text style={styles.alarmLabel}>Alarm</Text>
                    <Switch
                      value={timer.alarmState[item.key]}
                      onValueChange={(enabled) => timer.toggleAlarm(item.key, enabled)}
                      disabled={!item.iso || !isEclipseAlarmEnabled}
                    />
                  </View>
                </View>
              ))}

              <Pressable
                style={styles.previewBtn}
                onPress={() => {
                  if (!timer.result) return;
                  onOpenPreview(timer.result);
                }}
              >
                <Text style={styles.previewBtnText}>Preview</Text>
              </Pressable>
            </>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0b0b" },
  header: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerMeta: {
    flex: 1,
    gap: 2,
  },
  headerBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerLogo: {
    width: 20,
    height: 20,
  },
  title: { color: "white", fontSize: 18, fontWeight: "700" },
  subtitle: { color: "#bdbdbd", fontSize: 12 },
  eclipseSwitcherWrap: {
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  eclipseSwitcherBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2e3566",
    backgroundColor: "#151a43",
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 4,
  },
  eclipseSwitcherBtnDisabled: {
    opacity: 0.68,
  },
  eclipseSwitcherTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eclipseSwitcherLabel: {
    color: "#b7beff",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  eclipseSwitcherHint: {
    color: "#d9dcff",
    fontSize: 11,
    fontWeight: "700",
  },
  eclipseSwitcherValue: {
    color: "white",
    fontSize: 13,
    fontWeight: "700",
  },
  eclipseSwitcherMeta: {
    color: "#bcc2f4",
    fontSize: 11,
  },
  mapWrap: { height: 300, marginHorizontal: 12, borderRadius: 12, overflow: "hidden" },
  map: { flex: 1 },
  controls: {
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 10,
  },
  favoriteWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 6,
  },
  favoriteList: {
    gap: 8,
    paddingBottom: 2,
  },
  favoriteChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3a447d",
    backgroundColor: "#1a2257",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  favoriteChipText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
  },
  favoriteEmpty: {
    color: "#8f8f8f",
    fontSize: 12,
  },
  btnRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
  mapGpsBtn: {
    position: "absolute",
    top: 10,
    left: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.68)",
    alignItems: "center",
    justifyContent: "center",
  },
  mapGpsIcon: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  mapGpsIconCrossVertical: {
    position: "absolute",
    width: 2,
    height: 20,
    borderRadius: 1,
    backgroundColor: "white",
  },
  mapGpsIconCrossHorizontal: {
    position: "absolute",
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: "white",
  },
  mapGpsIconRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "white",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  mapGpsIconDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "white",
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
  mapLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  mapLegendMuted: {
    opacity: 0.72,
  },
  mapLegendDisabled: {
    opacity: 0.45,
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
  mapLegendState: {
    color: "#d6d6d6",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  mapDirectionLegend: {
    position: "absolute",
    right: 10,
    bottom: 10,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.62)",
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 4,
  },
  mapDirectionLegendHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  mapDirectionLegendTitle: {
    color: "#e2e2e2",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  mapDirectionLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mapDirectionLegendLine: {
    width: 18,
    borderTopWidth: 2,
    borderStyle: "dashed",
  },
  mapDirectionLegendText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  contactDirectionBadge: {
    minWidth: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  contactDirectionArrow: {
    fontSize: 14,
    lineHeight: 16,
    fontWeight: "900",
  },
  contactDirectionLabel: {
    marginTop: 1,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
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
  resultsContent: { paddingBottom: 28 },
  card: { backgroundColor: "#121212", borderRadius: 12, padding: 12, marginBottom: 10 },
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
  eclipseAlarmCard: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2b2b2b",
    backgroundColor: "#171717",
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  eclipseAlarmCardMain: {
    flex: 1,
    gap: 3,
  },
  eclipseAlarmCardTitle: {
    color: "#f3f3f3",
    fontSize: 13,
    fontWeight: "700",
  },
  eclipseAlarmCardDescription: {
    color: "#a8a8a8",
    fontSize: 11,
    lineHeight: 16,
  },
  notificationsDisabledHint: {
    marginTop: 8,
    color: "#b6b6b6",
    fontSize: 12,
  },
  previewBtn: {
    marginTop: 4,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#3f3f3f",
    backgroundColor: "#1e1e1e",
    alignItems: "center",
    justifyContent: "center",
  },
  previewBtnText: { color: "white", fontSize: 13, fontWeight: "700" },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 10,
  },
  contactRowDisabled: {
    opacity: 0.55,
  },
  contactMain: { flex: 1 },
  contactLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  contactKeyBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  contactKeyBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
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
  eclipsePickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.58)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  eclipsePickerCard: {
    width: "100%",
    maxHeight: "82%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2f2f2f",
    backgroundColor: "#121212",
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 10,
  },
  eclipsePickerTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
  },
  eclipsePickerSubtitle: {
    color: "#bdbdbd",
    fontSize: 12,
  },
  eclipsePickerList: {
    maxHeight: 360,
  },
  eclipsePickerListContent: {
    gap: 8,
    paddingBottom: 2,
  },
  eclipsePickerItem: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2b2b2b",
    backgroundColor: "#1b1b1b",
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  eclipsePickerItemSelected: {
    borderColor: "#2c3cff",
    backgroundColor: "#1a2056",
  },
  eclipsePickerItemTitle: {
    color: "white",
    fontSize: 13,
    fontWeight: "700",
  },
  eclipsePickerItemTitleSelected: {
    color: "#e8ebff",
  },
  eclipsePickerItemMeta: {
    marginTop: 4,
    color: "#bdbdbd",
    fontSize: 11,
  },
  eclipsePickerItemMetaSelected: {
    color: "#c6ceff",
  },
  eclipsePickerCloseBtn: {
    alignSelf: "flex-end",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#3a3a3a",
    backgroundColor: "#1f1f1f",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  eclipsePickerCloseText: {
    color: "#d5d5d5",
    fontSize: 13,
    fontWeight: "700",
  },
  favoriteModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.58)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  favoriteModalCard: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2f2f2f",
    backgroundColor: "#121212",
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 10,
  },
  favoriteModalTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
  },
  favoriteModalSubtitle: {
    color: "#bdbdbd",
    fontSize: 12,
  },
  favoriteModalInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2f2f2f",
    backgroundColor: "#1b1b1b",
    color: "white",
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  favoriteModalCoords: {
    color: "#9f9f9f",
    fontSize: 12,
  },
  favoriteModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  favoriteModalCancelBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#3a3a3a",
    backgroundColor: "#1f1f1f",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  favoriteModalCancelText: {
    color: "#d5d5d5",
    fontSize: 13,
    fontWeight: "700",
  },
  favoriteModalSaveBtn: {
    borderRadius: 10,
    backgroundColor: "#2c3cff",
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  favoriteModalSaveText: {
    color: "white",
    fontSize: 13,
    fontWeight: "700",
  },
  sep: { height: 1, backgroundColor: "#2a2a2a", marginVertical: 10 },
});
