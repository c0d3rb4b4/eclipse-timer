import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import type { FlatList, NativeScrollEvent, NativeSyntheticEvent } from "react-native";

import type { LandingEclipseItem } from "./useLandingEclipses";

type LandingScrollArgs = {
  isFocused: boolean;
  selectedIndex: number;
  firstFutureIndex: number;
};

const LANDING_ROW_HEIGHT = 68;
const LANDING_ROW_GAP = 8;
const LANDING_ROW_SPAN = LANDING_ROW_HEIGHT + LANDING_ROW_GAP;

export type LandingScrollState = {
  landingListRef: RefObject<FlatList<LandingEclipseItem> | null>;
  didAutoScrollRef: MutableRefObject<boolean>;
  landingListScrollYRef: MutableRefObject<number>;
  rowHeight: number;
  rowGap: number;
  rowSpan: number;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEndDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onMomentumScrollEnd: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

export function useLandingScroll({
  isFocused,
  selectedIndex,
  firstFutureIndex,
}: LandingScrollArgs): LandingScrollState {
  const landingListRef = useRef<FlatList<LandingEclipseItem>>(null);
  const didAutoScrollRef = useRef(false);
  const prevFocusedRef = useRef(isFocused);
  const landingListScrollYRef = useRef(0);

  useEffect(() => {
    if (!isFocused || didAutoScrollRef.current) return;
    if (firstFutureIndex < 0) return;

    const y = Math.max(0, firstFutureIndex * LANDING_ROW_SPAN - LANDING_ROW_GAP);
    landingListRef.current?.scrollToOffset({ offset: y, animated: false });
    landingListScrollYRef.current = y;
    didAutoScrollRef.current = true;
  }, [firstFutureIndex, isFocused]);

  useEffect(() => {
    const prev = prevFocusedRef.current;
    prevFocusedRef.current = isFocused;

    if (!isFocused || prev) return;

    const restore = () => {
      let targetY = Math.max(0, landingListScrollYRef.current);

      if (targetY <= 1 && selectedIndex >= 0) {
        targetY = Math.max(0, selectedIndex * LANDING_ROW_SPAN - LANDING_ROW_GAP);
      }

      landingListRef.current?.scrollToOffset({ offset: targetY, animated: false });
      landingListScrollYRef.current = targetY;
    };

    restore();
    const t = setTimeout(restore, 80);
    return () => clearTimeout(t);
  }, [isFocused, selectedIndex]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = Math.max(0, e.nativeEvent.contentOffset.y);
    landingListScrollYRef.current = y;
    if (y > 0.5) didAutoScrollRef.current = true;
  }, []);

  const onScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    landingListScrollYRef.current = Math.max(0, e.nativeEvent.contentOffset.y);
  }, []);

  return {
    landingListRef,
    didAutoScrollRef,
    landingListScrollYRef,
    rowHeight: LANDING_ROW_HEIGHT,
    rowGap: LANDING_ROW_GAP,
    rowSpan: LANDING_ROW_SPAN,
    onScroll,
    onScrollEndDrag: onScrollEnd,
    onMomentumScrollEnd: onScrollEnd,
  };
}
