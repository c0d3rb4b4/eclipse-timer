import {
  DEFAULT_WEAR_DATA_LAYER_PATHS,
  getWearDataLayerPaths,
  isWearDataLayerBridgeAvailable,
  sendWearDataLayerMessage,
  subscribeToWearDataLayerMessages,
  type WearDataLayerPaths,
} from "./wearDataLayerBridge";
import {
  buildLiveRenderPayloadFromLocation,
  parseWearLiveLocationPayload,
  type WearLiveLocationPayload,
} from "./wearLiveCompute";

const MIN_PUBLISH_INTERVAL_MS = 2_500;
const MIN_PUBLISH_DISTANCE_METERS = 10;
const EARTH_RADIUS_METERS = 6_371_000;
const LOG_TAG = "[wear.liveSync]";

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

function toRadians(valueDeg: number): number {
  return (valueDeg * Math.PI) / 180;
}

function haversineDistanceMeters(a: WearLiveLocationPayload, b: WearLiveLocationPayload): number {
  const dLat = toRadians(b.latitudeDeg - a.latitudeDeg);
  const dLon = toRadians(b.longitudeDeg - a.longitudeDeg);
  const lat1 = toRadians(a.latitudeDeg);
  const lat2 = toRadians(b.latitudeDeg);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

function shouldPublishUpdate(params: {
  previousLocation: WearLiveLocationPayload | null;
  nextLocation: WearLiveLocationPayload;
  nowMs: number;
  lastPublishMs: number;
}) {
  if (!params.previousLocation) {
    return true;
  }

  const elapsedMs = params.nowMs - params.lastPublishMs;
  const movedMeters = haversineDistanceMeters(params.previousLocation, params.nextLocation);

  if (movedMeters >= MIN_PUBLISH_DISTANCE_METERS) {
    return true;
  }

  return elapsedMs >= MIN_PUBLISH_INTERVAL_MS;
}

export function startWearLiveSync(): () => void {
  if (!isWearDataLayerBridgeAvailable()) {
    logInfo("bridge_unavailable");
    return () => {};
  }

  let isStopped = false;
  let paths: WearDataLayerPaths = DEFAULT_WEAR_DATA_LAYER_PATHS;
  let lastPublishedLocation: WearLiveLocationPayload | null = null;
  let lastPublishMs = 0;
  let publishQueue = Promise.resolve();

  void getWearDataLayerPaths()
    .then((resolved) => {
      if (!isStopped) {
        paths = resolved;
        logInfo("paths_resolved", paths);
      }
    })
    .catch((error: unknown) => {
      // Keep defaults.
      logWarn("paths_resolve_failed_using_defaults", { error });
    });

  const unsubscribe = subscribeToWearDataLayerMessages((message) => {
    if (message.path !== paths.liveLocation) {
      return;
    }

    logInfo("payload_received", { path: message.path, sourceNodeId: message.sourceNodeId });
    const liveLocation = parseWearLiveLocationPayload(message.payload);
    if (!liveLocation) {
      logWarn("payload_invalid", { path: message.path });
      return;
    }

    publishQueue = publishQueue
      .then(async () => {
        if (isStopped) {
          return;
        }

        const nowMs = Date.now();
        if (
          !shouldPublishUpdate({
            previousLocation: lastPublishedLocation,
            nextLocation: liveLocation,
            nowMs,
            lastPublishMs,
          })
        ) {
          logInfo("publish_skipped_throttled", {
            path: paths.liveRender,
            nowMs,
            lastPublishMs,
          });
          return;
        }

        const livePayload = buildLiveRenderPayloadFromLocation(liveLocation, { nowMs });
        logInfo("payload_publish_attempt", {
          path: paths.liveRender,
          showMoon: livePayload.showMoon,
        });
        const didSend = await sendWearDataLayerMessage(
          paths.liveRender,
          JSON.stringify(livePayload),
        );
        if (!didSend) {
          logWarn("payload_publish_failed", { path: paths.liveRender });
          return;
        }

        logInfo("payload_publish_success", { path: paths.liveRender });
        lastPublishedLocation = liveLocation;
        lastPublishMs = nowMs;
      })
      .catch((error: unknown) => {
        logWarn("publish_queue_error", { error });
      });
  });

  return () => {
    isStopped = true;
    unsubscribe();
    logInfo("stopped");
  };
}
