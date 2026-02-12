import { useCallback, useEffect, useRef, useState, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from "react-native";

type AppScreen = "landing" | "timer";

type LandingScrollArgs = {
  screen: AppScreen;
  selectedLandingId: string | null;
};

export type LandingScrollState = {
  landingListRef: RefObject<ScrollView>;
  landingRowYByIdRef: MutableRefObject<Record<string, number>>;
  didAutoScrollRef: MutableRefObject<boolean>;
  landingListScrollYRef: MutableRefObject<number>;
  firstFutureRowY: number | null;
  setFirstFutureRowY: Dispatch<SetStateAction<number | null>>;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEndDrag: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onMomentumScrollEnd: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

export function useLandingScroll({ screen, selectedLandingId }: LandingScrollArgs): LandingScrollState {
  const landingListRef = useRef<ScrollView>(null);
  const didAutoScrollRef = useRef(false);
  const prevScreenRef = useRef<AppScreen>("landing");
  const landingListScrollYRef = useRef(0);
  const landingRowYByIdRef = useRef<Record<string, number>>({});
  const [firstFutureRowY, setFirstFutureRowY] = useState<number | null>(null);

  useEffect(() => {
    if (screen !== "landing" || didAutoScrollRef.current) return;
    if (firstFutureRowY == null) return;

    const y = Math.max(0, firstFutureRowY - 8);
    landingListRef.current?.scrollTo({ y, animated: false });
    landingListScrollYRef.current = y;
    didAutoScrollRef.current = true;
  }, [screen, firstFutureRowY]);

  useEffect(() => {
    const prev = prevScreenRef.current;
    prevScreenRef.current = screen;

    if (prev !== "timer" || screen !== "landing") return;

    const restore = () => {
      let targetY = Math.max(0, landingListScrollYRef.current);

      if (targetY <= 1 && selectedLandingId) {
        const rowY = landingRowYByIdRef.current[selectedLandingId];
        if (typeof rowY === "number" && Number.isFinite(rowY)) {
          targetY = Math.max(0, rowY - 8);
        }
      }

      landingListRef.current?.scrollTo({ y: targetY, animated: false });
      landingListScrollYRef.current = targetY;
    };

    restore();
    const t = setTimeout(restore, 80);
    return () => clearTimeout(t);
  }, [screen, selectedLandingId]);

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
    landingRowYByIdRef,
    didAutoScrollRef,
    landingListScrollYRef,
    firstFutureRowY,
    setFirstFutureRowY,
    onScroll,
    onScrollEndDrag: onScrollEnd,
    onMomentumScrollEnd: onScrollEnd,
  };
}
