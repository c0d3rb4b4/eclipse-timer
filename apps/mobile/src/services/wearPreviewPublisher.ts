import {
  DEFAULT_WEAR_DATA_LAYER_PATHS,
  getWearDataLayerPaths,
  isWearDataLayerBridgeAvailable,
  sendWearDataLayerMessage,
  type WearDataLayerPaths,
} from "./wearDataLayerBridge";
import { buildPreviewRenderPayloadV1, type WearPreviewSourcePayload } from "./wearPreviewPayload";

type WearPreviewRouteState = {
  routeName?: string | null;
  previewPayload?: WearPreviewSourcePayload | null;
};

const LOG_TAG = "[wear.previewPublisher]";

function logInfo(event: string, details?: Record<string, unknown>) {
  if (details) {
    console.info(LOG_TAG, event, details);
    return;
  }
  console.info(LOG_TAG, event);
}

function logWarn(event: string, details?: Record<string, unknown>) {
  if (details) {
    console.warn(LOG_TAG, event, details);
    return;
  }
  console.warn(LOG_TAG, event);
}

const PREVIEW_UNAVAILABLE_PAYLOAD = JSON.stringify({
  version: 1,
  mode: "preview-unavailable",
});

let resolvedPaths: WearDataLayerPaths = DEFAULT_WEAR_DATA_LAYER_PATHS;
let hasResolvedPaths = false;
let hasPublishedPreviewState = false;
let activePreviewSessionId: string | null = null;
let activePreviewEclipseId: string | null = null;
let lastPublishedPreviewJson: string | null = null;
let syncQueue = Promise.resolve();

function createPreviewSessionId(eclipseId: string, nowMs: number): string {
  return `${eclipseId}:${nowMs}`;
}

async function ensureDataLayerPaths(): Promise<WearDataLayerPaths> {
  if (!hasResolvedPaths) {
    try {
      resolvedPaths = await getWearDataLayerPaths();
      logInfo("paths_resolved", resolvedPaths);
    } catch {
      resolvedPaths = DEFAULT_WEAR_DATA_LAYER_PATHS;
      logWarn("paths_resolve_failed_using_defaults");
    } finally {
      hasResolvedPaths = true;
    }
  }

  return resolvedPaths;
}

async function publishPreviewUnavailableIfNeeded(): Promise<void> {
  if (!hasPublishedPreviewState) {
    return;
  }

  const paths = await ensureDataLayerPaths();
  logInfo("payload_publish_attempt", { path: paths.previewRender, mode: "preview-unavailable" });
  const didSend = await sendWearDataLayerMessage(paths.previewRender, PREVIEW_UNAVAILABLE_PAYLOAD);
  if (didSend) {
    hasPublishedPreviewState = false;
    activePreviewSessionId = null;
    activePreviewEclipseId = null;
    lastPublishedPreviewJson = null;
    logInfo("mode_switch", { to: "live", reason: "preview_route_inactive" });
    return;
  }
  logWarn("payload_publish_failed", { path: paths.previewRender, mode: "preview-unavailable" });
}

async function syncWearPreviewRouteStateInternal(input: WearPreviewRouteState): Promise<void> {
  if (!isWearDataLayerBridgeAvailable()) {
    logInfo("bridge_unavailable");
    return;
  }

  const routeName = input.routeName ?? null;
  const previewPayload = input.previewPayload ?? null;

  if (routeName !== "Preview" || !previewPayload) {
    await publishPreviewUnavailableIfNeeded();
    return;
  }

  const nowMs = Date.now();
  const eclipseId = previewPayload.eclipseId.trim();
  if (!eclipseId) {
    logWarn("preview_payload_invalid", { reason: "empty_eclipse_id" });
    await publishPreviewUnavailableIfNeeded();
    return;
  }

  if (activePreviewSessionId == null || activePreviewEclipseId !== eclipseId) {
    activePreviewSessionId = createPreviewSessionId(eclipseId, nowMs);
    activePreviewEclipseId = eclipseId;
    lastPublishedPreviewJson = null;
    logInfo("mode_switch", {
      to: "preview",
      previewSessionId: activePreviewSessionId,
      eclipseId,
    });
  }

  const previewRenderPayload = buildPreviewRenderPayloadV1({
    source: previewPayload,
    previewSessionId: activePreviewSessionId,
    nowMs,
  });

  if (!previewRenderPayload) {
    logWarn("preview_payload_invalid", { reason: "build_payload_failed", eclipseId });
    await publishPreviewUnavailableIfNeeded();
    return;
  }

  const payloadJson = JSON.stringify(previewRenderPayload);
  if (payloadJson === lastPublishedPreviewJson) {
    logInfo("payload_publish_skipped_unchanged", {
      path: resolvedPaths.previewRender,
      previewSessionId: activePreviewSessionId,
    });
    return;
  }

  const paths = await ensureDataLayerPaths();
  logInfo("payload_publish_attempt", {
    path: paths.previewRender,
    mode: "preview",
    previewSessionId: activePreviewSessionId,
  });
  const didSend = await sendWearDataLayerMessage(paths.previewRender, payloadJson);
  if (!didSend) {
    logWarn("payload_publish_failed", {
      path: paths.previewRender,
      mode: "preview",
      previewSessionId: activePreviewSessionId,
    });
    return;
  }

  hasPublishedPreviewState = true;
  lastPublishedPreviewJson = payloadJson;
  logInfo("payload_publish_success", {
    path: paths.previewRender,
    mode: "preview",
    previewSessionId: activePreviewSessionId,
  });
}

export function syncWearPreviewRouteState(input: WearPreviewRouteState): void {
  syncQueue = syncQueue
    .then(() => syncWearPreviewRouteStateInternal(input))
    .catch((error: unknown) => {
      logWarn("sync_queue_error", { error });
    });
}

export function getActiveWearPreviewSessionId(): string | null {
  return activePreviewSessionId;
}
