import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { APP_LOGO } from "../assets/branding";
import BurgerButton from "../components/BurgerButton";
import type { LandingEclipseItem } from "../hooks/useLandingEclipses";
import type { LandingScrollState } from "../hooks/useLandingScroll";
import { useAppTheme } from "../theme/useAppTheme";

type LandingScreenProps = {
  eclipses: LandingEclipseItem[];
  selectedId: string | null;
  searchQuery: string;
  filteredCount: number;
  totalCount: number;
  onSelect: (id: string) => void;
  onSearchQueryChange: (query: string) => void;
  onGo: () => void;
  onOpenMenu: () => void;
  scroll: LandingScrollState;
};

export default function LandingScreen({
  eclipses,
  selectedId,
  searchQuery,
  filteredCount,
  totalCount,
  onSelect,
  onSearchQueryChange,
  onGo,
  onOpenMenu,
  scroll,
}: LandingScreenProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const selectedLanding = useMemo(
    () => eclipses.find((e) => e.id === selectedId) ?? null,
    [eclipses, selectedId],
  );
  const canGo = !!selectedLanding;
  const previewUri = selectedLanding?.gifUrl;
  const [previewState, setPreviewState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [previewReloadKey, setPreviewReloadKey] = useState(0);

  useEffect(() => {
    if (!previewUri) {
      setPreviewState("idle");
      return;
    }
    setPreviewReloadKey(0);
    setPreviewState("loading");
    Image.prefetch(previewUri).catch(() => undefined);
  }, [previewUri]);

  const retryPreview = useCallback(() => {
    if (!previewUri) return;
    setPreviewReloadKey((v) => v + 1);
    setPreviewState("loading");
    Image.prefetch(previewUri).catch(() => undefined);
  }, [previewUri]);

  const renderItem = useCallback(
    ({ item }: { item: LandingEclipseItem }) => (
      <Pressable
        style={[
          styles.landingListItem,
          item.isPast ? styles.landingListItemPast : null,
          selectedLanding?.id === item.id ? styles.landingListItemSelected : null,
        ]}
        onPress={() => onSelect(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`${item.dateYmd} ${item.kindLabel}, ${item.isPast ? "past" : "upcoming"}`}
        accessibilityState={{ selected: selectedLanding?.id === item.id }}
      >
        <Text
          style={[
            styles.landingListItemTitle,
            item.isPast ? styles.landingListItemTitlePast : null,
          ]}
        >
          {item.dateYmd} {item.kindLabel}
        </Text>
        <Text
          style={[styles.landingListItemMeta, item.isPast ? styles.landingListItemMetaPast : null]}
        >
          {item.id} - {item.isPast ? "Past" : "Upcoming"}
        </Text>
      </Pressable>
    ),
    [onSelect, selectedLanding?.id],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.landingWrap}>
        <View style={styles.headerRow}>
          <BurgerButton onPress={onOpenMenu} />
          <View style={styles.brandRow}>
            <Image source={APP_LOGO} style={styles.brandLogo} resizeMode="contain" />
            <Text style={styles.landingTitle} accessibilityRole="header">
              Eclipse Timer
            </Text>
          </View>
        </View>
        <View style={styles.searchWrap}>
          <TextInput
            value={searchQuery}
            onChangeText={onSearchQueryChange}
            style={styles.searchInput}
            placeholder="Search by year, date, kind, or ID"
            placeholderTextColor={colors.inputPlaceholder}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            accessibilityLabel="Search eclipses"
            accessibilityRole="search"
          />
          <Text style={styles.searchMeta}>
            {filteredCount} of {totalCount}
          </Text>
        </View>

        <View style={styles.landingListBox}>
          <FlatList
            ref={scroll.landingListRef}
            data={eclipses}
            keyExtractor={(item) => item.id}
            style={styles.landingListScroll}
            contentContainerStyle={styles.landingListScrollContent}
            renderItem={renderItem}
            accessibilityRole="list"
            accessibilityLabel="Eclipse list"
            ItemSeparatorComponent={() => <View style={{ height: scroll.rowGap }} />}
            getItemLayout={(_, index) => ({
              length: scroll.rowSpan,
              offset: scroll.rowSpan * index,
              index,
            })}
            onScroll={scroll.onScroll}
            onScrollEndDrag={scroll.onScrollEndDrag}
            onMomentumScrollEnd={scroll.onMomentumScrollEnd}
            scrollEventThrottle={16}
            initialNumToRender={18}
            maxToRenderPerBatch={24}
            windowSize={11}
            removeClippedSubviews
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>No eclipses found</Text>
                <Text style={styles.emptyMeta}>Try a different search query.</Text>
              </View>
            }
          />
        </View>

        {selectedLanding ? (
          <View style={styles.previewCard}>
            <View style={styles.previewMedia}>
              <Image
                key={`${previewUri}-${previewReloadKey}`}
                source={{ uri: selectedLanding.gifUrl, cache: "force-cache" }}
                style={styles.previewGif}
                resizeMode="contain"
                onLoadStart={() => setPreviewState("loading")}
                onLoad={() => setPreviewState("ready")}
                onError={() => setPreviewState("error")}
              />
              {previewState === "loading" ? (
                <View style={styles.previewOverlay}>
                  <ActivityIndicator />
                  <Text style={styles.previewOverlayText}>Loading NASA preview...</Text>
                </View>
              ) : null}
              {previewState === "error" ? (
                <View style={styles.previewOverlay}>
                  <Text style={styles.previewOverlayText}>Preview unavailable right now.</Text>
                  <Pressable
                    style={styles.previewRetryBtn}
                    onPress={retryPreview}
                    accessibilityRole="button"
                    accessibilityLabel="Retry loading preview"
                  >
                    <Text style={styles.previewRetryText}>Retry</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        <Pressable
          style={[styles.goBtn, !canGo ? styles.goBtnDisabled : null]}
          onPress={onGo}
          disabled={!canGo}
          accessibilityRole="button"
          accessibilityLabel="Go to eclipse timer"
          accessibilityState={{ disabled: !canGo }}
        >
          <Text style={styles.goBtnText}>GO</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useAppTheme>["colors"]) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    landingWrap: {
      flex: 1,
      paddingHorizontal: 12,
      paddingTop: 24,
      paddingBottom: 24,
      gap: 12,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    brandLogo: {
      width: 30,
      height: 30,
    },
    landingTitle: { color: colors.textPrimary, fontSize: 26, fontWeight: "800" },
    searchWrap: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 10,
      gap: 8,
    },
    searchInput: {
      color: colors.textPrimary,
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
    },
    searchMeta: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
    landingListBox: {
      flex: 1,
      minHeight: 220,
      backgroundColor: colors.surface,
      borderRadius: 12,
      padding: 8,
    },
    landingListScroll: {
      flex: 1,
    },
    landingListScrollContent: {
      paddingBottom: 2,
    },
    landingListItem: {
      height: 68,
      backgroundColor: colors.surfaceMuted,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 10,
      paddingHorizontal: 12,
      justifyContent: "center",
    },
    landingListItemSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryMuted,
    },
    landingListItemPast: {
      backgroundColor: colors.surfaceElevated,
      borderColor: colors.border,
    },
    landingListItemTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: "700" },
    landingListItemTitlePast: { color: colors.textMuted },
    landingListItemMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
    landingListItemMetaPast: { color: colors.textMuted },
    emptyWrap: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 36,
      gap: 6,
    },
    emptyTitle: { color: colors.textSecondary, fontSize: 14, fontWeight: "700" },
    emptyMeta: { color: colors.textMuted, fontSize: 12 },
    previewCard: {
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 8,
    },
    previewMedia: {
      width: "100%",
      height: 220,
      borderRadius: 8,
      overflow: "hidden",
      backgroundColor: colors.background,
    },
    previewGif: {
      width: "100%",
      height: "100%",
    },
    previewOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.overlay,
      paddingHorizontal: 16,
    },
    previewOverlayText: {
      color: colors.textSecondary,
      fontSize: 12,
      textAlign: "center",
    },
    previewRetryBtn: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    previewRetryText: {
      color: colors.primaryText,
      fontSize: 12,
      fontWeight: "700",
    },
    goBtn: {
      marginTop: 4,
      width: "100%",
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    goBtnDisabled: {
      backgroundColor: colors.primaryMuted,
      opacity: 0.55,
    },
    goBtnText: {
      color: colors.primaryText,
      fontWeight: "800",
      fontSize: 16,
    },
  });
}
