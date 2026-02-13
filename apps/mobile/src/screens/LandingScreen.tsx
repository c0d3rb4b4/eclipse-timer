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

import type { LandingEclipseItem } from "../hooks/useLandingEclipses";
import type { LandingScrollState } from "../hooks/useLandingScroll";

type LandingScreenProps = {
  eclipses: LandingEclipseItem[];
  selectedId: string | null;
  searchQuery: string;
  filteredCount: number;
  totalCount: number;
  onSelect: (id: string) => void;
  onSearchQueryChange: (query: string) => void;
  onGo: () => void;
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
  scroll,
}: LandingScreenProps) {
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
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.landingWrap}>
        <Text style={styles.landingTitle}>Eclipse Timer</Text>
        <View style={styles.searchWrap}>
          <TextInput
            value={searchQuery}
            onChangeText={onSearchQueryChange}
            style={styles.searchInput}
            placeholder="Search by year, date, kind, or ID"
            placeholderTextColor="#6f6f6f"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
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
                  <Pressable style={styles.previewRetryBtn} onPress={retryPreview}>
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
        >
          <Text style={styles.goBtnText}>GO</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b0b0b" },
  landingWrap: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 12,
  },
  landingTitle: { color: "white", fontSize: 26, fontWeight: "800" },
  searchWrap: {
    backgroundColor: "#121212",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2b2b2b",
    padding: 10,
    gap: 8,
  },
  searchInput: {
    color: "white",
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#313131",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  searchMeta: {
    color: "#9b9b9b",
    fontSize: 12,
    fontWeight: "600",
  },
  landingListBox: {
    flex: 1,
    minHeight: 220,
    backgroundColor: "#121212",
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
    backgroundColor: "#1f1f1f",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2b2b2b",
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  landingListItemSelected: {
    borderColor: "#2c3cff",
    backgroundColor: "#1a2056",
  },
  landingListItemPast: {
    backgroundColor: "#171717",
    borderColor: "#272727",
  },
  landingListItemTitle: { color: "white", fontSize: 14, fontWeight: "700" },
  landingListItemTitlePast: { color: "#9b9b9b" },
  landingListItemMeta: { color: "#bdbdbd", fontSize: 12, marginTop: 4 },
  landingListItemMetaPast: { color: "#7f7f7f" },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    gap: 6,
  },
  emptyTitle: { color: "#dedede", fontSize: 14, fontWeight: "700" },
  emptyMeta: { color: "#8d8d8d", fontSize: 12 },
  previewCard: {
    backgroundColor: "#121212",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2b2b2b",
    padding: 8,
  },
  previewMedia: {
    width: "100%",
    height: 220,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#0b0b0b",
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
    backgroundColor: "rgba(11, 11, 11, 0.85)",
    paddingHorizontal: 16,
  },
  previewOverlayText: {
    color: "#d8d8d8",
    fontSize: 12,
    textAlign: "center",
  },
  previewRetryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#2c3cff",
  },
  previewRetryText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
  },
  goBtn: {
    marginTop: 4,
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#2c3cff",
    alignItems: "center",
    justifyContent: "center",
  },
  goBtnDisabled: {
    backgroundColor: "#26306f",
    opacity: 0.55,
  },
  goBtnText: {
    color: "white",
    fontWeight: "800",
    fontSize: 16,
  },
});
