package com.lallimaven.eclipsetimer.wearable

import android.content.Context
import android.util.Log
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable

object WearDataLayerBridge : MessageClient.OnMessageReceivedListener {
  private const val TAG = "WearDataLayerBridge"
  private const val ACK_PAYLOAD = """{"type":"phase0-ack","source":"phone"}"""

  interface IncomingMessageListener {
    fun onIncomingMessage(path: String, payload: String, sourceNodeId: String)
  }

  @Volatile
  private var incomingMessageListener: IncomingMessageListener? = null

  @Volatile
  private var isInitialized = false

  @Volatile
  private var isListening = false

  private lateinit var appContext: Context
  private lateinit var messageClient: MessageClient

  @Synchronized
  fun initialize(context: Context) {
    if (isInitialized) {
      return
    }

    appContext = context.applicationContext
    messageClient = Wearable.getMessageClient(appContext)
    isInitialized = true
    startListening()
    Log.i(TAG, "Wear Data Layer bridge initialized.")
  }

  @Synchronized
  fun startListening() {
    if (!isInitialized || isListening) {
      return
    }

    messageClient.addListener(this)
    isListening = true
  }

  @Synchronized
  fun stopListening() {
    if (!isInitialized || !isListening) {
      return
    }

    messageClient.removeListener(this)
    isListening = false
  }

  fun setIncomingMessageListener(listener: IncomingMessageListener?) {
    incomingMessageListener = listener
  }

  fun sendMessageToWatch(
    path: String,
    payload: ByteArray,
    onSuccess: () -> Unit,
    onError: (String) -> Unit,
  ) {
    if (!isInitialized) {
      onError("Wear bridge is not initialized.")
      return
    }

    Wearable.getNodeClient(appContext).connectedNodes
      .addOnSuccessListener { nodes ->
        val targetNode = nodes.firstOrNull()
        if (targetNode == null) {
          onError("No connected Wear OS nodes.")
          return@addOnSuccessListener
        }

        messageClient.sendMessage(targetNode.id, path, payload)
          .addOnSuccessListener { onSuccess() }
          .addOnFailureListener { error ->
            onError(error.message ?: "Failed to send Data Layer message.")
          }
      }
      .addOnFailureListener { error ->
        onError(error.message ?: "Failed to query connected Wear OS nodes.")
      }
  }

  override fun onMessageReceived(messageEvent: MessageEvent) {
    val payload = messageEvent.data.toString(Charsets.UTF_8)
    Log.d(TAG, "Message received on ${messageEvent.path}: $payload")
    incomingMessageListener?.onIncomingMessage(messageEvent.path, payload, messageEvent.sourceNodeId)

    if (messageEvent.path == WearPaths.LIVE_LOCATION) {
      messageClient.sendMessage(
        messageEvent.sourceNodeId,
        WearPaths.LIVE_RENDER,
        ACK_PAYLOAD.toByteArray(Charsets.UTF_8),
      ).addOnFailureListener { error ->
        Log.w(TAG, "Failed to send phase-0 ack to watch.", error)
      }
    }
  }
}
