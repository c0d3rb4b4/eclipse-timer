import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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

import type { Circumstances, EclipseRecord } from "@eclipse-timer/shared";

import type { TimerState } from "../hooks/useTimerState";
import BurgerButton from "../components/BurgerButton";
import type { FavoriteLocation } from "../state/appState";
import { fmtLocalHuman, fmtUtcHuman } from "../utils/date";
import { eclipseCenterForRecord, kindCodeForRecord } from "../utils/eclipse";

const VISIBLE_PATH_COLOR = "rgba(79, 195, 247, 0.22)";
const TOTALITY_PATH_COLOR = "rgba(255, 82, 82, 0.28)";
const ANNULARITY_PATH_COLOR = "rgba(255, 167, 38, 0.30)";
const FAVORITE_COORD_EPSILON = 0.0001;
const CONTACT_DIRECTION_COLORS = {
  c1: "#67d2ff",
  c2: "#8dff8d",
  c3: "#ffd866",
  c4: "#ff8f8f",
} as const;
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

function formatCardinalCoord(value: number, positiveHemisphere: string, negativeHemisphere: string) {
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
  return Math.abs(aLat - bLat) <= FAVORITE_COORD_EPSILON && Math.abs(aLon - bLon) <= FAVORITE_COORD_EPSILON;
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
  const lon2 =
    lon1 + Math.atan2(Math.sin(brng) * sinD * cosLat1, cosD - sinLat1 * Math.sin(lat2));

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

type TimerScreenProps = {
  activeEclipse: EclipseRecord | null;
  isActiveEclipseLoading: boolean;
  timer: TimerState;
  favoriteLocations: FavoriteLocation[];
  onAddFavoriteLocation: (location: Omit<FavoriteLocation, "id">) => void;
  onUseFavoriteLocation: (location: FavoriteLocation) => void;
  onOpenMenu: () => void;
  onOpenPreview: (result: Circumstances) => void;
};

export default function TimerScreen({
  activeEclipse,
  isActiveEclipseLoading,
  timer,
  favoriteLocations,
  onAddFavoriteLocation,
  onUseFavoriteLocation,
  onOpenMenu,
  onOpenPreview,
}: TimerScreenProps) {
  const insets = useSafeAreaInsets();
  const [isAddFavoriteModalOpen, setIsAddFavoriteModalOpen] = useState(false);
  const [favoriteModalName, setFavoriteModalName] = useState("");
  const [favoriteModalDefaultName, setFavoriteModalDefaultName] = useState("");
  const [favoriteModalPin, setFavoriteModalPin] = useState<{ lat: number; lon: number } | null>(null);
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
    if (!timer.result || !timer.showOverlays) return [];

    const arrowDistanceDeg = clamp(timer.region.latitudeDelta * 0.28, 0.18, 2.2);
    const entries = [
      { key: "c1", label: "C1", bearingDeg: timer.result.c1BearingDeg, color: CONTACT_DIRECTION_COLORS.c1 },
      { key: "c2", label: "C2", bearingDeg: timer.result.c2BearingDeg, color: CONTACT_DIRECTION_COLORS.c2 },
      { key: "c3", label: "C3", bearingDeg: timer.result.c3BearingDeg, color: CONTACT_DIRECTION_COLORS.c3 },
      { key: "c4", label: "C4", bearingDeg: timer.result.c4BearingDeg, color: CONTACT_DIRECTION_COLORS.c4 },
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
  }, [timer.pin.lat, timer.pin.lon, timer.region.latitudeDelta, timer.result, timer.showOverlays]);

  const closeAddFavoriteModal = () => {
    setIsAddFavoriteModalOpen(false);
    setFavoriteModalName("");
    setFavoriteModalDefaultName("");
    setFavoriteModalPin(null);
  };

  const openAddFavoriteModal = () => {
    if (!canAddCurrentPinToFavorites) return;

    const nextPin = { lat: timer.pin.lat, lon: timer.pin.lon };
    const compiledDefaultName = buildDefaultFavoriteName(nextPin.lat, nextPin.lon, favoriteLocations);
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

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.header}>
        <BurgerButton onPress={onOpenMenu} />
        <View style={styles.headerMeta}>
          <Text style={styles.title}>Eclipse Timer (MVP)</Text>
          <Text style={styles.subtitle}>
            {isActiveEclipseLoading
              ? "Loading eclipse data..."
              : activeEclipse
                ? `${activeEclipse.id} - ${activeEclipse.dateYmd}`
                : "No eclipse loaded"}
          </Text>
        </View>
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
          {timer.showOverlays
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
          {timer.showOverlays
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
          {contactDirectionOverlays.map((direction) => (
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
          ))}
          {contactDirectionOverlays.map((direction) => (
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
                    { color: direction.color, transform: [{ rotate: `${direction.bearingDeg}deg` }] },
                  ]}
                >
                  ▲
                </Text>
                <Text style={[styles.contactDirectionLabel, { color: direction.color }]}>
                  {direction.label}
                </Text>
              </View>
            </Marker>
          ))}
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

        <Pressable
          style={[
            styles.mapLegend,
            !timer.showOverlays && timer.hasOverlayData ? styles.mapLegendMuted : null,
          ]}
          onPress={timer.toggleOverlays}
          disabled={!timer.hasOverlayData}
          accessibilityRole="button"
          accessibilityLabel={timer.showOverlays ? "Hide eclipse overlays" : "Show eclipse overlays"}
        >
          <View style={styles.mapLegendRow}>
            <View style={[styles.mapLegendSwatch, { backgroundColor: VISIBLE_PATH_COLOR }]} />
            <Text style={styles.mapLegendText}>Eclipse Visible</Text>
          </View>
          <View style={styles.mapLegendRow}>
            <View style={[styles.mapLegendSwatch, { backgroundColor: centralOverlayColor }]} />
            <Text style={styles.mapLegendText}>{centralLegendLabel}</Text>
          </View>
          <Text style={styles.mapLegendHint}>
            {!timer.hasOverlayData
              ? "No precomputed overlay for this eclipse."
              : timer.showOverlays
                ? "Tap legend to hide both overlays."
                : "Tap legend to show both overlays."}
          </Text>
        </Pressable>
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
        <Text style={styles.favoriteTitle}>Use Favorite Location</Text>
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
        contentContainerStyle={[styles.resultsContent, { paddingBottom: Math.max(28, insets.bottom + 18) }]}
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

              <Pressable
                style={[
                  styles.testAlarmBtn,
                  !timer.notificationsEnabled ? styles.testAlarmBtnDisabled : null,
                ]}
                onPress={timer.runAlarmTest}
                disabled={!timer.notificationsEnabled}
              >
                <Text style={styles.testAlarmBtnText}>Test Alarm</Text>
              </Pressable>

              {!timer.notificationsEnabled ? (
                <Text style={styles.notificationsDisabledHint}>
                  Eclipse Event Alerts are off. Enable them in Notification Settings.
                </Text>
              ) : null}

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
                      disabled={!item.iso || !timer.notificationsEnabled}
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
  favoriteWrap: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 6,
  },
  favoriteTitle: {
    color: "#cfcfcf",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
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
  mapLegendMuted: {
    opacity: 0.72,
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
  testAlarmBtnDisabled: {
    opacity: 0.45,
  },
  testAlarmBtnText: { color: "white", fontSize: 13, fontWeight: "700" },
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
