import { useLinkingURL } from "expo-linking";
import {
  getScheme,
  getShareExtensionKey,
  parseShareIntent,
  type ShareIntent,
  ShareIntentModule,
} from "expo-share-intent";
import type {
  AndroidShareIntent,
  ShareIntentOptions,
} from "expo-share-intent/build/ExpoShareIntentModule.types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform } from "react-native";

const SHARE_INTENT_DEFAULT_VALUE: ShareIntent = {
  files: null,
  text: null,
  webUrl: null,
  type: null,
};

function hasShareIntentValue(intent: ShareIntent): boolean {
  return Boolean(
    intent.text ||
      intent.webUrl ||
      intent.meta?.title ||
      (Array.isArray(intent.files) && intent.files.length > 0),
  );
}

export default function useShareIntentBridge(options: ShareIntentOptions = {}) {
  const url = useLinkingURL();
  const appState = useRef(AppState.currentState);
  const [shareIntent, setShareIntent] = useState<ShareIntent>(SHARE_INTENT_DEFAULT_VALUE);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const resolvedOptions = useMemo<ShareIntentOptions>(
    () => ({
      debug: options.debug ?? false,
      resetOnBackground: options.resetOnBackground ?? true,
      disabled: options.disabled ?? Platform.OS === "web",
      scheme: options.scheme,
      onResetShareIntent: options.onResetShareIntent,
    }),
    [
      options.debug,
      options.disabled,
      options.onResetShareIntent,
      options.resetOnBackground,
      options.scheme,
    ],
  );

  const resetShareIntent = useCallback(
    (clearNativeModule = true) => {
      if (resolvedOptions.disabled) return;
      setError(null);
      if (clearNativeModule && ShareIntentModule) {
        void ShareIntentModule.clearShareIntent(getShareExtensionKey(resolvedOptions));
      }
      if (hasShareIntentValue(shareIntent)) {
        setShareIntent(SHARE_INTENT_DEFAULT_VALUE);
        resolvedOptions.onResetShareIntent?.();
      }
    },
    [resolvedOptions, shareIntent],
  );

  const refreshShareIntent = useCallback(() => {
    if (resolvedOptions.disabled || !ShareIntentModule) return;

    if (Platform.OS === "android") {
      ShareIntentModule.getShareIntent("");
      return;
    }

    const scheme = getScheme(resolvedOptions);
    if (typeof url === "string" && url.includes(`${scheme}://dataUrl=`)) {
      ShareIntentModule.getShareIntent(url);
    }
  }, [resolvedOptions, url]);

  useEffect(() => {
    if (resolvedOptions.disabled) {
      setIsReady(true);
      return;
    }

    if (!ShareIntentModule) {
      setIsReady(true);
      if (resolvedOptions.debug) {
        console.warn("expo-share-intent module unavailable");
      }
      return;
    }

    const changeSubscription = ShareIntentModule.addListener("onChange", (event) => {
      try {
        const parsed = parseShareIntent(
          event.value as string | AndroidShareIntent,
          resolvedOptions,
        );
        setShareIntent(parsed);
        setError(null);
      } catch {
        setError("Cannot parse share intent value!");
      }
    });

    const errorSubscription = ShareIntentModule.addListener("onError", (event) => {
      setError(event?.value ?? "Share intent error");
    });

    // Important: refresh after listeners are attached so cold-start payloads are not dropped.
    refreshShareIntent();
    setIsReady(true);

    return () => {
      changeSubscription.remove();
      errorSubscription.remove();
    };
  }, [refreshShareIntent, resolvedOptions]);

  useEffect(() => {
    if (resolvedOptions.disabled) return;

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        refreshShareIntent();
      } else if (
        resolvedOptions.resetOnBackground !== false &&
        appState.current === "active" &&
        (nextAppState === "inactive" || nextAppState === "background")
      ) {
        resetShareIntent();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [refreshShareIntent, resetShareIntent, resolvedOptions]);

  return {
    isReady,
    hasShareIntent: hasShareIntentValue(shareIntent),
    shareIntent,
    resetShareIntent,
    error,
  };
}
