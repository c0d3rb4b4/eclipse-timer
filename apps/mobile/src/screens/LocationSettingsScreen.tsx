import * as Location from "expo-location";
import { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BurgerButton from "../components/BurgerButton";
import { geocodeAddressQuery, resolveAddressLabelForCoordinates } from "../services/geocoding";
import type { FavoriteLocation } from "../state/appState";
import { useAppTheme } from "../theme/useAppTheme";

type LocationSettingsScreenProps = {
  onOpenMenu: () => void;
  favoriteLocations: FavoriteLocation[];
  onAddFavoriteLocation: (location: Omit<FavoriteLocation, "id">) => void;
  onRemoveFavoriteLocation: (id: string) => void;
};

function formatCoordLabel(value: number) {
  return value.toFixed(4);
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return String(err);
}

export default function LocationSettingsScreen({
  onOpenMenu,
  favoriteLocations,
  onAddFavoriteLocation,
  onRemoveFavoriteLocation,
}: LocationSettingsScreenProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [name, setName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [latitudeText, setLatitudeText] = useState("");
  const [longitudeText, setLongitudeText] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isSavingFavorite, setIsSavingFavorite] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sortedFavorites = useMemo(
    () => [...favoriteLocations].sort((a, b) => a.name.localeCompare(b.name)),
    [favoriteLocations],
  );

  const ensureAndroidGeocodePermission = async () => {
    if (Platform.OS !== "android") return true;

    const existing = await Location.getForegroundPermissionsAsync();
    if (existing.status === "granted") return true;
    if (!existing.canAskAgain) return false;

    const requested = await Location.requestForegroundPermissionsAsync();
    return requested.status === "granted";
  };

  const searchAddress = async () => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery || isSearching) {
      if (!trimmedQuery) setErrorMessage("Enter an address or place to search.");
      return;
    }

    setIsSearching(true);
    setErrorMessage(null);

    try {
      const hasPermission = await ensureAndroidGeocodePermission();
      if (!hasPermission) {
        setErrorMessage("Location permission is required to search addresses.");
        return;
      }

      const matches = await geocodeAddressQuery(trimmedQuery);
      const first = matches.find(
        (item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude),
      );
      if (!first) {
        setErrorMessage(`No search results for "${trimmedQuery}".`);
        return;
      }

      const lat = first.latitude;
      const lon = first.longitude;
      setLatitudeText(lat.toFixed(6));
      setLongitudeText(lon.toFixed(6));
      if (!name.trim()) {
        const resolved = await resolveAddressLabelForCoordinates(lat, lon);
        if (resolved) {
          setName(resolved);
        } else {
          setName(trimmedQuery);
        }
      }
      setErrorMessage(null);
    } catch (err: unknown) {
      setErrorMessage(`Address search failed: ${getErrorMessage(err)}`);
    } finally {
      setIsSearching(false);
    }
  };

  const addFavorite = async () => {
    if (isSavingFavorite) return;

    const lat = Number(latitudeText);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setErrorMessage("Latitude must be a number between -90 and 90.");
      return;
    }

    const lon = Number(longitudeText);
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      setErrorMessage("Longitude must be a number between -180 and 180.");
      return;
    }

    setIsSavingFavorite(true);
    setErrorMessage(null);
    try {
      let resolvedName = name.trim();
      if (!resolvedName) {
        resolvedName = (await resolveAddressLabelForCoordinates(lat, lon)) ?? "";
      }
      if (!resolvedName) {
        setErrorMessage("Enter a name or search for an address before saving.");
        return;
      }

      onAddFavoriteLocation({
        name: resolvedName,
        lat,
        lon,
      });
      setName("");
      setSearchQuery("");
      setLatitudeText("");
      setLongitudeText("");
      setErrorMessage(null);
    } finally {
      setIsSavingFavorite(false);
    }
  };

  const canSearchAddress = searchQuery.trim().length > 0 && !isSearching;
  const canAddFavorite =
    latitudeText.trim().length > 0 && longitudeText.trim().length > 0 && !isSavingFavorite;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.headerRow}>
        <BurgerButton onPress={onOpenMenu} />
        <View style={styles.headerMeta}>
          <Text style={styles.title}>Location Settings</Text>
          <Text style={styles.subtitle}>Add and manage favorite observing locations.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Add Favorite Location</Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search address or place"
            placeholderTextColor={colors.inputPlaceholder}
            style={styles.input}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => {
              void searchAddress();
            }}
          />
          <Pressable
            style={[styles.searchBtn, !canSearchAddress ? styles.actionBtnDisabled : null]}
            onPress={() => {
              void searchAddress();
            }}
            disabled={!canSearchAddress}
            accessibilityRole="button"
            accessibilityLabel="Find coordinates for address search query"
            accessibilityState={{ disabled: !canSearchAddress }}
          >
            <Text style={styles.searchBtnText}>
              {isSearching ? "Searching..." : "Find Address"}
            </Text>
          </Pressable>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Name (optional if address resolves)"
            placeholderTextColor={colors.inputPlaceholder}
            style={styles.input}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <View style={styles.coordRow}>
            <TextInput
              value={latitudeText}
              onChangeText={setLatitudeText}
              placeholder="Latitude"
              placeholderTextColor={colors.inputPlaceholder}
              style={[styles.input, styles.coordInput]}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              value={longitudeText}
              onChangeText={setLongitudeText}
              placeholder="Longitude"
              placeholderTextColor={colors.inputPlaceholder}
              style={[styles.input, styles.coordInput]}
              keyboardType="numbers-and-punctuation"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          <Pressable
            style={[styles.addBtn, !canAddFavorite ? styles.actionBtnDisabled : null]}
            onPress={() => {
              void addFavorite();
            }}
            disabled={!canAddFavorite}
          >
            <Text style={styles.addBtnText}>{isSavingFavorite ? "Saving..." : "Add Favorite"}</Text>
          </Pressable>
        </View>

        <View style={styles.listSection}>
          <Text style={styles.formTitle}>Saved Favorites</Text>
          {sortedFavorites.length ? (
            sortedFavorites.map((location) => (
              <View style={styles.locationCard} key={location.id}>
                <View style={styles.locationMain}>
                  <Text style={styles.locationName}>{location.name}</Text>
                  <Text style={styles.locationCoords}>
                    {formatCoordLabel(location.lat)}, {formatCoordLabel(location.lon)}
                  </Text>
                </View>
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => onRemoveFavoriteLocation(location.id)}
                >
                  <Text style={styles.removeBtnText}>Remove</Text>
                </Pressable>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No favorites yet. Add your first location above.</Text>
          )}
        </View>
      </ScrollView>
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
      gap: 10,
    },
    headerMeta: {
      flex: 1,
      gap: 2,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 21,
      fontWeight: "800",
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 12,
    },
    content: {
      paddingHorizontal: 12,
      paddingTop: 14,
      paddingBottom: 24,
      gap: 14,
    },
    formCard: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: 12,
      paddingHorizontal: 12,
      gap: 10,
    },
    formTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "800",
    },
    input: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.inputBackground,
      color: colors.textPrimary,
      paddingVertical: 10,
      paddingHorizontal: 12,
      fontSize: 14,
    },
    searchBtn: {
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 11,
    },
    searchBtnText: {
      color: colors.primaryText,
      fontSize: 13,
      fontWeight: "700",
    },
    coordRow: {
      flexDirection: "row",
      gap: 10,
    },
    coordInput: {
      flex: 1,
    },
    errorText: {
      color: colors.dangerText,
      fontSize: 12,
    },
    addBtn: {
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 11,
    },
    actionBtnDisabled: {
      opacity: 0.7,
    },
    addBtnText: {
      color: colors.primaryText,
      fontSize: 14,
      fontWeight: "700",
    },
    listSection: {
      gap: 8,
    },
    locationCard: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      backgroundColor: colors.surfaceMuted,
      paddingVertical: 10,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    locationMain: {
      flex: 1,
      gap: 3,
    },
    locationName: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    locationCoords: {
      color: colors.textMuted,
      fontSize: 12,
    },
    removeBtn: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: colors.dangerBorder,
      backgroundColor: colors.dangerBackground,
    },
    removeBtnText: {
      color: colors.dangerText,
      fontSize: 12,
      fontWeight: "700",
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 12,
    },
  });
}
