package com.lallimaven.eclipsetimer.wearable

import android.content.Context
import android.util.Log
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.NodeClient
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
  private lateinit var nodeClient: NodeClient

  @Volatile
  private var cachedWatchNodeId: String? = null

  @Synchronized
  fun initialize(context: Context) {
    if (isInitialized) {
      return
    }

    appContext = context.applicationContext
    messageClient = Wearable.getMessageClient(appContext)
    nodeClient = Wearable.getNodeClient(appContext)
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

  fun isListeningInProcess(): Boolean = isInitialized && isListening

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

    val knownWatchNodeId = cachedWatchNodeId
    if (!knownWatchNodeId.isNullOrBlank()) {
      if (shouldLogPayloadActivity(path)) {
        Log.i(
          TAG,
          "event=payload_send_attempt path=$path nodeId=$knownWatchNodeId strategy=cached_node_id",
        )
      }
      sendMessageToNode(
        nodeId = knownWatchNodeId,
        path = path,
        payload = payload,
        onSuccess = {
          if (shouldLogPayloadActivity(path)) {
            Log.i(TAG, "event=payload_send_success path=$path nodeId=$knownWatchNodeId")
          }
          onSuccess()
        },
        onFailure = {
          Log.w(
            TAG,
            "event=payload_send_failed path=$path nodeId=$knownWatchNodeId strategy=cached_node_id",
            it,
          )
          cachedWatchNodeId = null
          resolveNodeAndSend(path, payload, onSuccess, onError)
        },
      )
      return
    }

    resolveNodeAndSend(path, payload, onSuccess, onError)
  }

  private fun resolveNodeAndSend(
    path: String,
    payload: ByteArray,
    onSuccess: () -> Unit,
    onError: (String) -> Unit,
  ) {
    nodeClient.connectedNodes
      .addOnSuccessListener { nodes ->
        val targetNode = nodes.firstOrNull()
        if (targetNode == null) {
          cachedWatchNodeId = null
          Log.w(TAG, "event=connectivity_no_watch_node path=$path")
          onError("No connected Wear OS nodes.")
          return@addOnSuccessListener
        }

        cachedWatchNodeId = targetNode.id
        Log.i(TAG, "event=connectivity_node_resolved path=$path nodeId=${targetNode.id}")
        if (shouldLogPayloadActivity(path)) {
          Log.i(
            TAG,
            "event=payload_send_attempt path=$path nodeId=${targetNode.id} strategy=resolved_node",
          )
        }
        sendMessageToNode(
          nodeId = targetNode.id,
          path = path,
          payload = payload,
          onSuccess = {
            if (shouldLogPayloadActivity(path)) {
              Log.i(TAG, "event=payload_send_success path=$path nodeId=${targetNode.id}")
            }
            onSuccess()
          },
          onFailure = { error ->
            cachedWatchNodeId = null
            Log.w(TAG, "event=payload_send_failed path=$path nodeId=${targetNode.id}", error)
            onError(error.message ?: "Failed to send Data Layer message.")
          },
        )
      }
      .addOnFailureListener { error ->
        cachedWatchNodeId = null
        Log.w(TAG, "event=connectivity_node_resolve_failed path=$path", error)
        onError(error.message ?: "Failed to query connected Wear OS nodes.")
      }
  }

  private fun shouldLogPayloadActivity(path: String): Boolean = path != WearPaths.PREVIEW_SCRUB

  private fun sendMessageToNode(
    nodeId: String,
    path: String,
    payload: ByteArray,
    onSuccess: () -> Unit,
    onFailure: (Exception) -> Unit,
  ) {
    messageClient.sendMessage(nodeId, path, payload)
      .addOnSuccessListener { onSuccess() }
      .addOnFailureListener { error ->
        onFailure(error)
      }
  }

  override fun onMessageReceived(messageEvent: MessageEvent) {
    if (messageEvent.sourceNodeId.isNotBlank()) {
      cachedWatchNodeId = messageEvent.sourceNodeId
    }

    val payload = messageEvent.data.toString(Charsets.UTF_8)
    if (shouldLogPayloadActivity(messageEvent.path)) {
      Log.d(
        TAG,
        "event=payload_received path=${messageEvent.path} sourceNodeId=${messageEvent.sourceNodeId} payload=$payload",
      )
    }
    incomingMessageListener?.onIncomingMessage(messageEvent.path, payload, messageEvent.sourceNodeId)

    if (messageEvent.path == WearPaths.LIVE_LOCATION) {
      messageClient.sendMessage(
        messageEvent.sourceNodeId,
        WearPaths.LIVE_RENDER,
        ACK_PAYLOAD.toByteArray(Charsets.UTF_8),
      ).addOnFailureListener { error ->
        Log.w(
          TAG,
          "event=ack_send_failed path=${WearPaths.LIVE_RENDER} sourceNodeId=${messageEvent.sourceNodeId}",
          error,
        )
      }
    }
  }
}
