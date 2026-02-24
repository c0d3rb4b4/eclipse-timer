package com.lallimaven.eclipsetimer.wearable

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class WearDataLayerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext),
  LifecycleEventListener,
  WearDataLayerBridge.IncomingMessageListener {

  init {
    reactContext.addLifecycleEventListener(this)
    WearDataLayerBridge.initialize(reactContext.applicationContext)
    WearDataLayerBridge.setIncomingMessageListener(this)
  }

  override fun getName(): String = "WearDataLayerBridge"

  @ReactMethod
  fun getDataLayerPaths(promise: Promise) {
    val paths = Arguments.createMap().apply {
      putString("liveLocation", WearPaths.LIVE_LOCATION)
      putString("liveRender", WearPaths.LIVE_RENDER)
      putString("previewRender", WearPaths.PREVIEW_RENDER)
      putString("previewScrub", WearPaths.PREVIEW_SCRUB)
    }
    promise.resolve(paths)
  }

  @ReactMethod
  fun sendPhaseZeroTestMessage(promise: Promise) {
    val payload = """{"type":"phase0-test","source":"phone"}""".toByteArray(Charsets.UTF_8)
    WearDataLayerBridge.sendMessageToWatch(
      path = WearPaths.PREVIEW_RENDER,
      payload = payload,
      onSuccess = { promise.resolve(true) },
      onError = { error -> promise.reject("E_WEAR_SEND", error) },
    )
  }

  @ReactMethod
  fun sendMessage(path: String, payload: String, promise: Promise) {
    val normalizedPath = path.trim()
    if (normalizedPath.isEmpty()) {
      promise.reject("E_WEAR_SEND_PATH", "Data Layer path cannot be empty.")
      return
    }

    WearDataLayerBridge.sendMessageToWatch(
      path = normalizedPath,
      payload = payload.toByteArray(Charsets.UTF_8),
      onSuccess = { promise.resolve(true) },
      onError = { error -> promise.reject("E_WEAR_SEND", error) },
    )
  }

  override fun onIncomingMessage(path: String, payload: String, sourceNodeId: String) {
    if (!reactContext.hasActiveReactInstance()) {
      return
    }

    val event = Arguments.createMap().apply {
      putString("path", path)
      putString("payload", payload)
      putString("sourceNodeId", sourceNodeId)
    }

    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("wearDataLayerMessage", event)
  }

  override fun onHostResume() {
    WearDataLayerBridge.startListening()
    WearDataLayerBridge.setIncomingMessageListener(this)
  }

  override fun onHostPause() {
    // Keep listener active to support background sync and test message handling.
  }

  override fun onHostDestroy() {
    WearDataLayerBridge.setIncomingMessageListener(null)
  }

  override fun invalidate() {
    WearDataLayerBridge.setIncomingMessageListener(null)
    reactContext.removeLifecycleEventListener(this)
    super.invalidate()
  }
}
