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

  const logDebug = useCallback(
    (...args: unknown[]) => {
      if (!resolvedOptions.debug) return;
      console.info("[share.debug]", ...args);
    },
    [resolvedOptions.debug],
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

    logDebug("refresh", { platform: Platform.OS, url });
    if (Platform.OS === "android") {
      ShareIntentModule.getShareIntent("");
      return;
    }

    const scheme = getScheme(resolvedOptions);
    if (typeof url === "string" && url.includes(`${scheme}://dataUrl=`)) {
      ShareIntentModule.getShareIntent(url);
    }
  }, [logDebug, resolvedOptions, url]);

  useEffect(() => {
    if (resolvedOptions.disabled) {
      setIsReady(true);
      return;
    }

    if (!ShareIntentModule) {
      setIsReady(true);
      console.warn("[share.debug] expo-share-intent module unavailable");
      return;
    }

    const changeSubscription = ShareIntentModule.addListener("onChange", (event) => {
      try {
        logDebug("onChange_raw", event?.value);
        const parsed = parseShareIntent(
          event.value as string | AndroidShareIntent,
          resolvedOptions,
        );
        logDebug("onChange_parsed", {
          text: parsed.text,
          webUrl: parsed.webUrl,
          title: parsed.meta?.title,
          type: parsed.type,
          fileCount: parsed.files?.length ?? 0,
        });
        setShareIntent(parsed);
        setError(null);
      } catch {
        logDebug("onChange_parse_error");
        setError("Cannot parse share intent value!");
      }
    });

    const errorSubscription = ShareIntentModule.addListener("onError", (event) => {
      logDebug("onError", event?.value);
      setError(event?.value ?? "Share intent error");
    });

    // Important: refresh after listeners are attached so cold-start payloads are not dropped.
    refreshShareIntent();
    logDebug("listeners_ready");
    setIsReady(true);

    return () => {
      changeSubscription.remove();
      errorSubscription.remove();
    };
  }, [logDebug, refreshShareIntent, resolvedOptions]);

  useEffect(() => {
    if (resolvedOptions.disabled) return;

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        logDebug("appstate_active_refresh");
        refreshShareIntent();
      } else if (
        resolvedOptions.resetOnBackground !== false &&
        appState.current === "active" &&
        (nextAppState === "inactive" || nextAppState === "background")
      ) {
        logDebug("appstate_background_reset");
        resetShareIntent();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [logDebug, refreshShareIntent, resetShareIntent, resolvedOptions]);

  return {
    isReady,
    hasShareIntent: hasShareIntentValue(shareIntent),
    shareIntent,
    resetShareIntent,
    error,
  };
}
