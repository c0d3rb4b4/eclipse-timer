import React, { useCallback, useMemo } from "react";
import { FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { LandingEclipseItem } from "../hooks/useLandingEclipses";
import type { LandingScrollState } from "../hooks/useLandingScroll";

type LandingScreenProps = {
  eclipses: LandingEclipseItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onGo: () => void;
  scroll: LandingScrollState;
};

export default function LandingScreen({
  eclipses,
  selectedId,
  onSelect,
  onGo,
  scroll,
}: LandingScreenProps) {
  const selectedLanding = useMemo(
    () => eclipses.find((e) => e.id === selectedId) ?? null,
    [eclipses, selectedId]
  );
  const canGo = !!selectedLanding;
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
          style={[
            styles.landingListItemMeta,
            item.isPast ? styles.landingListItemMetaPast : null,
          ]}
        >
          {item.id} - {item.isPast ? "Past" : "Upcoming"}
        </Text>
      </Pressable>
    ),
    [onSelect, selectedLanding?.id]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.landingWrap}>
        <Text style={styles.landingTitle}>Eclipse Timer</Text>

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
          />
        </View>

        {selectedLanding ? (
          <View style={styles.previewCard}>
            <Image
              source={{ uri: selectedLanding.gifUrl }}
              style={styles.previewGif}
              resizeMode="contain"
            />
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
  previewCard: {
    backgroundColor: "#121212",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2b2b2b",
    padding: 8,
  },
  previewGif: {
    width: "100%",
    height: 220,
    borderRadius: 8,
    backgroundColor: "#0b0b0b",
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
