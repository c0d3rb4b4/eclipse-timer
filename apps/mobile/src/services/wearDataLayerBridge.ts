import { NativeEventEmitter, NativeModules, Platform } from "react-native";

export type WearDataLayerPaths = {
  liveLocation: string;
  liveRender: string;
  previewRender: string;
  previewScrub: string;
};

export type WearDataLayerMessage = {
  path: string;
  payload: string;
  sourceNodeId: string;
};

type WearDataLayerBridgeNativeModule = {
  getDataLayerPaths: () => Promise<WearDataLayerPaths>;
  sendPhaseZeroTestMessage: () => Promise<boolean>;
};

const DEFAULT_DATA_LAYER_PATHS: WearDataLayerPaths = {
  liveLocation: "/wear/live/location/v1",
  liveRender: "/wear/live/render/v1",
  previewRender: "/wear/preview/render/v1",
  previewScrub: "/wear/preview/scrub/v1",
};

const nativeWearBridge: WearDataLayerBridgeNativeModule | null =
  Platform.OS === "android" && NativeModules.WearDataLayerBridge
    ? (NativeModules.WearDataLayerBridge as WearDataLayerBridgeNativeModule)
    : null;

const wearEventEmitter = nativeWearBridge
  ? new NativeEventEmitter(NativeModules.WearDataLayerBridge)
  : null;

export function isWearDataLayerBridgeAvailable() {
  return nativeWearBridge !== null;
}

export async function getWearDataLayerPaths() {
  if (!nativeWearBridge) {
    return DEFAULT_DATA_LAYER_PATHS;
  }

  try {
    return await nativeWearBridge.getDataLayerPaths();
  } catch {
    return DEFAULT_DATA_LAYER_PATHS;
  }
}

export async function sendPhaseZeroWearTestMessage() {
  if (!nativeWearBridge) {
    return false;
  }

  try {
    return await nativeWearBridge.sendPhaseZeroTestMessage();
  } catch {
    return false;
  }
}

export function subscribeToWearDataLayerMessages(
  listener: (message: WearDataLayerMessage) => void,
) {
  if (!wearEventEmitter) {
    return () => {};
  }

  const subscription = wearEventEmitter.addListener("wearDataLayerMessage", listener);
  return () => subscription.remove();
}
