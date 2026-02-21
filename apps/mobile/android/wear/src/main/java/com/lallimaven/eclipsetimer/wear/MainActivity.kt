package com.lallimaven.eclipsetimer.wear

import android.os.Bundle
import android.util.Log
import android.widget.TextView
import androidx.activity.ComponentActivity
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable

class MainActivity : ComponentActivity(), MessageClient.OnMessageReceivedListener {
  private lateinit var statusText: TextView
  private val messageClient by lazy { Wearable.getMessageClient(this) }
  private val nodeClient by lazy { Wearable.getNodeClient(this) }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)
    statusText = findViewById(R.id.status_text)
  }

  override fun onStart() {
    super.onStart()
    messageClient.addListener(this)
    sendPhaseZeroLocationTest()
  }

  override fun onStop() {
    messageClient.removeListener(this)
    super.onStop()
  }

  override fun onMessageReceived(messageEvent: MessageEvent) {
    if (messageEvent.path != WearPaths.LIVE_RENDER && messageEvent.path != WearPaths.PREVIEW_RENDER) {
      return
    }

    val payload = messageEvent.data.toString(Charsets.UTF_8)
    statusText.text = getString(R.string.status_phone_ack, payload)
  }

  private fun sendPhaseZeroLocationTest() {
    val payload = """{"type":"phase0-test","source":"wear"}""".toByteArray(Charsets.UTF_8)

    nodeClient.connectedNodes
      .addOnSuccessListener { nodes ->
        val targetNode = nodes.firstOrNull()
        if (targetNode == null) {
          statusText.text = getString(R.string.status_no_phone)
          return@addOnSuccessListener
        }

        messageClient.sendMessage(targetNode.id, WearPaths.LIVE_LOCATION, payload)
          .addOnSuccessListener {
            statusText.text = getString(R.string.status_sent_waiting_ack)
          }
          .addOnFailureListener { error ->
            Log.w(TAG, "Failed to send phase-0 test message to phone.", error)
            statusText.text = getString(R.string.status_send_failed)
          }
      }
      .addOnFailureListener { error ->
        Log.w(TAG, "Failed to get connected nodes.", error)
        statusText.text = getString(R.string.status_send_failed)
      }
  }

  companion object {
    private const val TAG = "WearMainActivity"
  }
}
