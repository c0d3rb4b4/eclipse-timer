import {
  DEFAULT_WEAR_DATA_LAYER_PATHS,
  getWearDataLayerPaths,
  isWearDataLayerBridgeAvailable,
  sendWearDataLayerMessage,
  subscribeToWearDataLayerMessages,
  type WearDataLayerMessage,
  type WearDataLayerPaths,
} from "./wearDataLayerBridge";
import {
  createWearPreviewScrubPayload,
  parseWearPreviewScrubPayload,
  type WearPreviewScrubPayloadV1,
} from "./wearPreviewScrubPayload";

const MIN_SCRUB_PUBLISH_INTERVAL_MS = 30;
const MIN_SCRUB_PUBLISH_DELTA = 0.001;
const LOG_TAG = "[wear.previewScrubSync]";

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

export type WearPreviewScrubEvent = {
  previewSessionId: string;
  progress: number;
  source: "watch";
};

type WearPreviewScrubListener = (event: WearPreviewScrubEvent) => void;

let resolvedPaths: WearDataLayerPaths = DEFAULT_WEAR_DATA_LAYER_PATHS;
let hasResolvedPaths = false;
let bridgeUnsubscribe: (() => void) | null = null;

let lastPublishedSessionId: string | null = null;
let lastPublishedProgressNorm = NaN;
let lastPublishedAtMs = 0;
let pendingPublishRequest: { previewSessionId: string; progress: number } | null = null;
let isPublishLoopActive = false;

const scrubListeners = new Set<WearPreviewScrubListener>();

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
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

function notifyScrubListeners(event: WearPreviewScrubEvent) {
  for (const listener of scrubListeners) {
    listener(event);
  }
}

function isPreviewScrubPath(path: string): boolean {
  return path === resolvedPaths.previewScrub || path === DEFAULT_WEAR_DATA_LAYER_PATHS.previewScrub;
}

function handleDataLayerMessage(message: WearDataLayerMessage) {
  if (!isPreviewScrubPath(message.path)) {
    return;
  }

  const scrubPayload = parseWearPreviewScrubPayload(message.payload);
  if (!scrubPayload || scrubPayload.source !== "watch") {
    logWarn("payload_invalid_or_non_watch_source", { path: message.path });
    return;
  }

  notifyScrubListeners({
    previewSessionId: scrubPayload.previewSessionId,
    progress: scrubPayload.progress,
    source: "watch",
  });
}

function maybeStartBridgeSubscription() {
  if (bridgeUnsubscribe || !isWearDataLayerBridgeAvailable()) {
    return;
  }

  bridgeUnsubscribe = subscribeToWearDataLayerMessages(handleDataLayerMessage);
  logInfo("subscription_started");
  void ensureDataLayerPaths();
}

function maybeStopBridgeSubscription() {
  if (scrubListeners.size > 0 || !bridgeUnsubscribe) {
    return;
  }

  bridgeUnsubscribe();
  bridgeUnsubscribe = null;
  logInfo("subscription_stopped");
}

function shouldPublishProgress(previewSessionId: string, progress: number, nowMs: number): boolean {
  if (previewSessionId !== lastPublishedSessionId) {
    return true;
  }

  const elapsedMs = nowMs - lastPublishedAtMs;
  if (elapsedMs < MIN_SCRUB_PUBLISH_INTERVAL_MS) {
    return false;
  }

  if (!Number.isFinite(lastPublishedProgressNorm)) {
    return true;
  }

  return Math.abs(progress - lastPublishedProgressNorm) >= MIN_SCRUB_PUBLISH_DELTA;
}

export function subscribeToWearPreviewScrubEvents(listener: WearPreviewScrubListener): () => void {
  if (!isWearDataLayerBridgeAvailable()) {
    logInfo("bridge_unavailable");
    return () => {};
  }

  scrubListeners.add(listener);
  maybeStartBridgeSubscription();

  return () => {
    scrubListeners.delete(listener);
    maybeStopBridgeSubscription();
  };
}

async function publishWearPreviewScrubProgressInternal(params: {
  previewSessionId: string;
  progress: number;
}): Promise<boolean> {
  if (!isWearDataLayerBridgeAvailable()) {
    logInfo("bridge_unavailable");
    return false;
  }

  const previewSessionId = params.previewSessionId.trim();
  if (!previewSessionId) {
    logWarn("publish_invalid_input", { reason: "empty_preview_session_id" });
    return false;
  }

  const progress = clamp01(params.progress);
  const nowMs = Date.now();
  if (!shouldPublishProgress(previewSessionId, progress, nowMs)) {
    return false;
  }

  const payload: WearPreviewScrubPayloadV1 | null = createWearPreviewScrubPayload({
    previewSessionId,
    progress,
    source: "phone",
  });
  if (!payload) {
    logWarn("publish_invalid_input", { reason: "payload_factory_returned_null", previewSessionId });
    return false;
  }

  const paths = await ensureDataLayerPaths();
  const didSend = await sendWearDataLayerMessage(paths.previewScrub, JSON.stringify(payload));
  if (!didSend) {
    logWarn("payload_publish_failed", { path: paths.previewScrub, previewSessionId });
    return false;
  }

  lastPublishedSessionId = previewSessionId;
  lastPublishedProgressNorm = progress;
  lastPublishedAtMs = nowMs;
  return true;
}

async function flushPendingPreviewScrubPublishes(): Promise<boolean> {
  let didSendAny = false;
  while (pendingPublishRequest) {
    const nextRequest = pendingPublishRequest;
    pendingPublishRequest = null;
    const didSend = await publishWearPreviewScrubProgressInternal(nextRequest);
    didSendAny = didSendAny || didSend;
  }

  isPublishLoopActive = false;
  return didSendAny;
}

export async function publishWearPreviewScrubProgress(params: {
  previewSessionId: string;
  progress: number;
}): Promise<boolean> {
  pendingPublishRequest = {
    previewSessionId: params.previewSessionId,
    progress: params.progress,
  };

  if (isPublishLoopActive) {
    return false;
  }

  isPublishLoopActive = true;
  return flushPendingPreviewScrubPublishes();
}
