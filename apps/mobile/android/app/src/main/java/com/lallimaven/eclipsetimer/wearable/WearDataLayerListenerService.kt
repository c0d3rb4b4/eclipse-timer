package com.lallimaven.eclipsetimer.wearable

import android.util.Log
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService

class WearDataLayerListenerService : WearableListenerService() {
  override fun onMessageReceived(messageEvent: MessageEvent) {
    if (messageEvent.path != WearPaths.LIVE_LOCATION) {
      super.onMessageReceived(messageEvent)
      return
    }

    // When the React Native bridge listener is alive, let it own the handshake path.
    if (WearDataLayerBridge.isListeningInProcess()) {
      return
    }

    Wearable.getMessageClient(applicationContext).sendMessage(
      messageEvent.sourceNodeId,
      WearPaths.LIVE_RENDER,
      PHASE0_ACK_PAYLOAD.toByteArray(Charsets.UTF_8),
    ).addOnFailureListener { error ->
      Log.w(TAG, "Failed to send phase-0 ack from listener service.", error)
    }
  }

  companion object {
    private const val TAG = "WearDataLayerService"
    private const val PHASE0_ACK_PAYLOAD = """{"type":"phase0-ack","source":"phone"}"""
  }
}
