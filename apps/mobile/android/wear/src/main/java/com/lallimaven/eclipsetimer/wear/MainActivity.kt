package com.lallimaven.eclipsetimer.wear

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.InputDevice
import android.view.MotionEvent
import android.view.View
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import org.json.JSONObject
import java.time.Instant
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.sqrt

class MainActivity : ComponentActivity(), MessageClient.OnMessageReceivedListener {
  private enum class RenderMode {
    LIVE,
    PREVIEW,
  }

  private data class LiveRenderPayload(
    val showMoon: Boolean,
    val moonRadiusNorm: Float,
    val moonCenterXNorm: Float,
    val moonCenterYNorm: Float,
  )

  private data class PreviewRenderPayload(
    val previewSessionId: String,
    val initialProgress: Float,
    val sunRadiusNorm: Float,
    val moonRadiusNorm: Float,
    val moonClosestOffsetNorm: Float,
    val moonTravelHalfSpanNorm: Float,
    val travelVectorXNorm: Float,
    val travelVectorYNorm: Float,
    val c1ProgressNorm: Float?,
    val c2ProgressNorm: Float?,
    val maxProgressNorm: Float?,
    val c3ProgressNorm: Float?,
    val c4ProgressNorm: Float?,
  )

  private data class PreviewScrubPayload(
    val previewSessionId: String,
    val progressNorm: Float,
    val source: String,
  )

  private data class MotionAnchor(
    val progressNorm: Float,
    val axisOffsetNorm: Float,
  )

  private lateinit var eclipseRenderView: EclipseRenderView
  private lateinit var statusText: TextView
  private var activeDeepLinkLabel: String? = null
  private var locationCallback: LocationCallback? = null
  private var lastSentLocation: Location? = null
  private var lastSentElapsedRealtimeMs: Long = 0L
  private var renderMode = RenderMode.LIVE
  private var hasSeenLiveRenderPayload = false
  private var lastLiveRenderElapsedRealtimeMs: Long = 0L
  private var hasAppliedStaleFallback = false
  private var latestLivePayload: LiveRenderPayload? = null
  private var activePreviewPayload: PreviewRenderPayload? = null
  private var activePreviewSessionId: String? = null
  private var previewProgressNorm = 0f
  private var connectedPhoneNodeId: String? = null
  private var lastSentPreviewScrubProgressNorm = Float.NaN
  private var lastSentPreviewScrubElapsedRealtimeMs = 0L
  private val staleCheckHandler = Handler(Looper.getMainLooper())
  private val staleCheckRunnable = object : Runnable {
    override fun run() {
      applyStaleRenderFallbackIfNeeded()
      staleCheckHandler.postDelayed(this, LIVE_STALE_CHECK_INTERVAL_MS)
    }
  }

  private val messageClient by lazy { Wearable.getMessageClient(this) }
  private val nodeClient by lazy { Wearable.getNodeClient(this) }
  private val fusedLocationClient: FusedLocationProviderClient by lazy {
    LocationServices.getFusedLocationProviderClient(this)
  }
  private val locationPermissionLauncher = registerForActivityResult(
    ActivityResultContracts.RequestPermission(),
  ) { granted ->
    if (granted || hasLocationPermission()) {
      logInfo(
        "location_permission_granted",
        "granted" to granted,
      )
      startLocationSync()
      return@registerForActivityResult
    }
    logWarn("location_permission_denied")
    showErrorStatus(R.string.status_location_permission_denied)
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)
    eclipseRenderView = findViewById(R.id.eclipse_render_view)
    statusText = findViewById(R.id.status_text)
    clearStatusMessage()
    eclipseRenderView.renderSunOnly()
    applyDeepLink(intent)
  }

  override fun onStart() {
    super.onStart()
    messageClient.addListener(this)
    staleCheckHandler.postDelayed(staleCheckRunnable, LIVE_STALE_CHECK_INTERVAL_MS)
    ensureLocationPermissionAndStartSync()
  }

  override fun onStop() {
    staleCheckHandler.removeCallbacks(staleCheckRunnable)
    stopLocationSync()
    messageClient.removeListener(this)
    super.onStop()
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    applyDeepLink(intent)
  }

  override fun onMessageReceived(messageEvent: MessageEvent) {
    if (messageEvent.sourceNodeId.isNotBlank()) {
      connectedPhoneNodeId = messageEvent.sourceNodeId
    }

    if (messageEvent.path == WearPaths.LIVE_RENDER) {
      val payload = messageEvent.data.toString(Charsets.UTF_8)
      logInfo(
        "payload_received",
        "path" to WearPaths.LIVE_RENDER,
        "sourceNodeId" to messageEvent.sourceNodeId,
      )
      val parsed = parseLiveRenderPayload(payload)
      if (parsed == null) {
        logWarn(
          "payload_invalid",
          "path" to WearPaths.LIVE_RENDER,
        )
        if (renderMode != RenderMode.PREVIEW) {
          eclipseRenderView.renderSunOnly()
          showErrorStatus(R.string.status_live_payload_invalid)
          hasAppliedStaleFallback = true
        }
        return
      }

      latestLivePayload = parsed
      hasSeenLiveRenderPayload = true
      hasAppliedStaleFallback = false
      lastLiveRenderElapsedRealtimeMs = SystemClock.elapsedRealtime()
      if (renderMode != RenderMode.PREVIEW) {
        renderLivePayload(parsed)
      }
      clearStatusMessage()
      return
    }

    if (messageEvent.path == WearPaths.PREVIEW_RENDER) {
      logInfo(
        "payload_received",
        "path" to WearPaths.PREVIEW_RENDER,
        "sourceNodeId" to messageEvent.sourceNodeId,
      )
      handlePreviewRenderMessage(messageEvent.data.toString(Charsets.UTF_8))
      return
    }

    if (messageEvent.path == WearPaths.PREVIEW_SCRUB) {
      handlePreviewScrubMessage(messageEvent.data.toString(Charsets.UTF_8))
    }
  }

  override fun onGenericMotionEvent(event: MotionEvent): Boolean {
    if (
      renderMode == RenderMode.PREVIEW &&
      event.action == MotionEvent.ACTION_SCROLL &&
      event.isFromSource(InputDevice.SOURCE_ROTARY_ENCODER)
    ) {
      val rotaryDelta = -event.getAxisValue(MotionEvent.AXIS_SCROLL)
      if (rotaryDelta == 0f) {
        return super.onGenericMotionEvent(event)
      }

      previewProgressNorm = (previewProgressNorm + rotaryDelta * PREVIEW_ROTARY_SENSITIVITY).coerceIn(0f, 1f)
      renderPreviewFrame()
      sendPreviewScrubToPhone()
      return true
    }
    return super.onGenericMotionEvent(event)
  }

  private fun ensureLocationPermissionAndStartSync() {
    if (hasLocationPermission()) {
      startLocationSync()
      return
    }
    logInfo("location_permission_requested")
    locationPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
  }

  private fun hasLocationPermission(): Boolean {
    val fineLocationGranted = ContextCompat.checkSelfPermission(
      this,
      Manifest.permission.ACCESS_FINE_LOCATION,
    ) == PackageManager.PERMISSION_GRANTED

    val coarseLocationGranted = ContextCompat.checkSelfPermission(
      this,
      Manifest.permission.ACCESS_COARSE_LOCATION,
    ) == PackageManager.PERMISSION_GRANTED

    return fineLocationGranted || coarseLocationGranted
  }

  @SuppressLint("MissingPermission")
  private fun startLocationSync() {
    if (!hasLocationPermission() || locationCallback != null) {
      return
    }
    sendLastKnownLocation()

    val request = LocationRequest.Builder(
      Priority.PRIORITY_HIGH_ACCURACY,
      LOCATION_UPDATE_INTERVAL_MS,
    )
      .setMinUpdateIntervalMillis(MIN_LOCATION_UPDATE_INTERVAL_MS)
      .setWaitForAccurateLocation(false)
      .build()

    val callback = object : LocationCallback() {
      override fun onLocationResult(locationResult: LocationResult) {
        val location = locationResult.lastLocation ?: return
        if (shouldSendLocation(location)) {
          sendLocationToPhone(location)
        }
      }
    }

    locationCallback = callback
    fusedLocationClient.requestLocationUpdates(request, callback, mainLooper)
      .addOnFailureListener { error ->
        logWarn("location_updates_start_failed", error)
        showErrorStatus(R.string.status_location_failed)
      }
  }

  private fun stopLocationSync() {
    val callback = locationCallback ?: return
    fusedLocationClient.removeLocationUpdates(callback)
    locationCallback = null
  }

  @SuppressLint("MissingPermission")
  private fun sendLastKnownLocation() {
    if (!hasLocationPermission()) {
      return
    }
    fusedLocationClient.lastLocation
      .addOnSuccessListener { location ->
        if (location != null && shouldSendLocation(location)) {
          sendLocationToPhone(location)
        }
      }
      .addOnFailureListener { error ->
        logWarn("location_last_known_failed", error)
      }
  }

  private fun shouldSendLocation(location: Location): Boolean {
    val previousLocation = lastSentLocation ?: return true
    val movedDistanceMeters = location.distanceTo(previousLocation)
    if (movedDistanceMeters >= MIN_LOCATION_DISTANCE_METERS) {
      return true
    }

    val elapsedSinceLastSendMs = SystemClock.elapsedRealtime() - lastSentElapsedRealtimeMs
    return elapsedSinceLastSendMs >= FORCE_LOCATION_SEND_INTERVAL_MS
  }

  private fun sendLocationToPhone(location: Location) {
    val capturedAtMillis = if (location.time > 0L) location.time else System.currentTimeMillis()
    val payload = JSONObject().apply {
      put("type", "live-location")
      put("source", "wear")
      put("capturedAtUtc", Instant.ofEpochMilli(capturedAtMillis).toString())
      put("latitudeDeg", location.latitude)
      put("longitudeDeg", location.longitude)
      if (location.hasAccuracy()) {
        put("accuracyMeters", location.accuracy.toDouble())
      }
    }.toString().toByteArray(Charsets.UTF_8)

    nodeClient.connectedNodes
      .addOnSuccessListener { nodes ->
        val targetNode = nodes.firstOrNull()
        if (targetNode == null) {
          logWarn(
            "connectivity_no_phone_node",
            "path" to WearPaths.LIVE_LOCATION,
          )
          showErrorStatus(R.string.status_no_phone)
          return@addOnSuccessListener
        }

        connectedPhoneNodeId = targetNode.id
        logInfo(
          "payload_send_attempt",
          "path" to WearPaths.LIVE_LOCATION,
          "targetNodeId" to targetNode.id,
        )
        messageClient.sendMessage(targetNode.id, WearPaths.LIVE_LOCATION, payload)
          .addOnSuccessListener {
            lastSentLocation = Location(location)
            lastSentElapsedRealtimeMs = SystemClock.elapsedRealtime()
            clearStatusMessage()
            logInfo(
              "payload_send_success",
              "path" to WearPaths.LIVE_LOCATION,
              "targetNodeId" to targetNode.id,
            )
          }
          .addOnFailureListener { error ->
            logWarn(
              "payload_send_failed",
              error,
              "path" to WearPaths.LIVE_LOCATION,
              "targetNodeId" to targetNode.id,
            )
            showErrorStatus(R.string.status_send_failed)
          }
      }
      .addOnFailureListener { error ->
        logWarn(
          "connectivity_node_resolve_failed",
          error,
          "path" to WearPaths.LIVE_LOCATION,
        )
        showErrorStatus(R.string.status_send_failed)
      }
  }

  private fun renderLivePayload(payload: LiveRenderPayload) {
    if (renderMode != RenderMode.LIVE) {
      logInfo(
        "mode_switch",
        "from" to renderMode.name.lowercase(),
        "to" to RenderMode.LIVE.name.lowercase(),
      )
    }
    renderMode = RenderMode.LIVE
    if (payload.showMoon) {
      eclipseRenderView.renderLiveMoon(
        payload.moonRadiusNorm,
        payload.moonCenterXNorm,
        payload.moonCenterYNorm,
      )
      return
    }
    eclipseRenderView.renderSunOnly()
  }

  private fun handlePreviewRenderMessage(rawPayload: String) {
    val parsed = runCatching { JSONObject(rawPayload) }.getOrNull()
    if (parsed == null) {
      logWarn(
        "payload_invalid",
        "path" to WearPaths.PREVIEW_RENDER,
      )
      showErrorStatus(R.string.status_preview_payload_invalid)
      return
    }

    when (parsed.optString("mode")) {
      "preview-unavailable" -> {
        exitPreviewMode()
      }

      "preview" -> {
        val previewPayload = parsePreviewRenderPayload(parsed)
        if (previewPayload == null) {
          logWarn(
            "payload_invalid",
            "path" to WearPaths.PREVIEW_RENDER,
            "mode" to "preview",
          )
          showErrorStatus(R.string.status_preview_payload_invalid)
          return
        }
        enterPreviewMode(previewPayload)
      }

      else -> {
        logWarn(
          "payload_invalid",
          "path" to WearPaths.PREVIEW_RENDER,
          "mode" to parsed.optString("mode"),
        )
        showErrorStatus(R.string.status_preview_payload_invalid)
      }
    }
  }

  private fun enterPreviewMode(payload: PreviewRenderPayload) {
    val isNewSession = payload.previewSessionId != activePreviewSessionId
    activePreviewPayload = payload

    if (isNewSession || renderMode != RenderMode.PREVIEW) {
      previewProgressNorm = payload.initialProgress.coerceIn(0f, 1f)
      activePreviewSessionId = payload.previewSessionId
      lastSentPreviewScrubProgressNorm = Float.NaN
      lastSentPreviewScrubElapsedRealtimeMs = 0L
    }

    if (renderMode != RenderMode.PREVIEW) {
      logInfo(
        "mode_switch",
        "from" to renderMode.name.lowercase(),
        "to" to RenderMode.PREVIEW.name.lowercase(),
        "previewSessionId" to payload.previewSessionId,
      )
    }

    renderMode = RenderMode.PREVIEW
    renderPreviewFrame()
    clearStatusMessage()
  }

  private fun exitPreviewMode() {
    val wasPreviewMode = renderMode == RenderMode.PREVIEW
    activePreviewPayload = null
    activePreviewSessionId = null
    renderMode = RenderMode.LIVE

    val livePayload = latestLivePayload
    if (livePayload != null) {
      renderLivePayload(livePayload)
    } else {
      eclipseRenderView.renderSunOnly()
    }
    applyStaleRenderFallbackIfNeeded()

    if (wasPreviewMode) {
      logInfo(
        "mode_switch",
        "from" to RenderMode.PREVIEW.name.lowercase(),
        "to" to RenderMode.LIVE.name.lowercase(),
        "reason" to "preview_unavailable",
      )
      clearStatusMessage()
    }
  }

  private fun renderPreviewFrame() {
    val payload = activePreviewPayload ?: return

    val axisOffsetNorm = interpolatePreviewAxisOffset(
      progressNorm = previewProgressNorm,
      anchors = buildPreviewMotionAnchors(payload),
    )
    val moonOffsetXNorm =
      axisOffsetNorm * payload.travelVectorXNorm - payload.moonClosestOffsetNorm * payload.travelVectorYNorm
    val moonOffsetYNorm =
      axisOffsetNorm * payload.travelVectorYNorm + payload.moonClosestOffsetNorm * payload.travelVectorXNorm
    val moonCenterXNorm = (0.5f + moonOffsetXNorm).coerceIn(0f, 1f)
    val moonCenterYNorm = (0.5f + moonOffsetYNorm).coerceIn(0f, 1f)

    eclipseRenderView.renderPreviewMoon(
      sunRadiusNorm = payload.sunRadiusNorm,
      moonRadiusNorm = payload.moonRadiusNorm,
      moonCenterXNorm = moonCenterXNorm,
      moonCenterYNorm = moonCenterYNorm,
    )
  }

  private fun buildPreviewMotionAnchors(payload: PreviewRenderPayload): List<MotionAnchor> {
    val moonClosestOffsetNorm = payload.moonClosestOffsetNorm
    val sunRadiusNorm = payload.sunRadiusNorm
    val moonRadiusNorm = payload.moonRadiusNorm

    val externalTouchAxisOffsetNorm = axisDistanceForTouchOffset(
      touchOffsetNorm = sunRadiusNorm + moonRadiusNorm,
      moonClosestOffsetNorm = moonClosestOffsetNorm,
    )
    val internalTouchAxisOffsetNorm = axisDistanceForTouchOffset(
      touchOffsetNorm = abs(sunRadiusNorm - moonRadiusNorm),
      moonClosestOffsetNorm = moonClosestOffsetNorm,
    )

    val anchors = mutableListOf(
      MotionAnchor(progressNorm = 0f, axisOffsetNorm = -externalTouchAxisOffsetNorm),
      MotionAnchor(progressNorm = 1f, axisOffsetNorm = externalTouchAxisOffsetNorm),
    )

    fun maybePush(progressNorm: Float?, axisOffsetNorm: Float) {
      if (progressNorm == null || !progressNorm.isFinite()) {
        return
      }
      anchors.add(
        MotionAnchor(
          progressNorm = progressNorm.coerceIn(0f, 1f),
          axisOffsetNorm = axisOffsetNorm,
        ),
      )
    }

    maybePush(payload.c1ProgressNorm, -externalTouchAxisOffsetNorm)
    maybePush(payload.c2ProgressNorm, -internalTouchAxisOffsetNorm)
    maybePush(payload.maxProgressNorm, 0f)
    maybePush(payload.c3ProgressNorm, internalTouchAxisOffsetNorm)
    maybePush(payload.c4ProgressNorm, externalTouchAxisOffsetNorm)

    return anchors.sortedBy { it.progressNorm }
  }

  private fun axisDistanceForTouchOffset(
    touchOffsetNorm: Float,
    moonClosestOffsetNorm: Float,
  ): Float {
    val radialSquared = touchOffsetNorm * touchOffsetNorm
    val closestSquared = moonClosestOffsetNorm * moonClosestOffsetNorm
    val axisSquared = radialSquared - closestSquared
    if (!axisSquared.isFinite() || axisSquared <= 0f) {
      return 0f
    }
    return sqrt(axisSquared)
  }

  private fun interpolatePreviewAxisOffset(
    progressNorm: Float,
    anchors: List<MotionAnchor>,
  ): Float {
    if (anchors.isEmpty()) {
      return 0f
    }

    val clampedProgress = progressNorm.coerceIn(0f, 1f)
    val first = anchors.first()
    val last = anchors.last()
    if (clampedProgress <= first.progressNorm) {
      return first.axisOffsetNorm
    }
    if (clampedProgress >= last.progressNorm) {
      return last.axisOffsetNorm
    }

    for (index in 1 until anchors.size) {
      val previous = anchors[index - 1]
      val next = anchors[index]
      if (clampedProgress > next.progressNorm) {
        continue
      }

      val span = next.progressNorm - previous.progressNorm
      if (span <= 0f) {
        return next.axisOffsetNorm
      }

      val segmentProgress = (clampedProgress - previous.progressNorm) / span
      return previous.axisOffsetNorm + (next.axisOffsetNorm - previous.axisOffsetNorm) * segmentProgress
    }

    return last.axisOffsetNorm
  }

  private fun handlePreviewScrubMessage(rawPayload: String) {
    if (renderMode != RenderMode.PREVIEW) {
      return
    }

    val scrubPayload = parsePreviewScrubPayload(rawPayload) ?: return
    if (scrubPayload.source == "watch") {
      return
    }

    val activeSessionId = activePreviewSessionId
    if (activeSessionId.isNullOrBlank() || scrubPayload.previewSessionId != activeSessionId) {
      return
    }

    if (abs(scrubPayload.progressNorm - previewProgressNorm) < PREVIEW_PROGRESS_EPSILON) {
      return
    }

    previewProgressNorm = scrubPayload.progressNorm
    renderPreviewFrame()
  }

  private fun sendPreviewScrubToPhone() {
    val previewSessionId = activePreviewSessionId
    if (previewSessionId.isNullOrBlank()) {
      return
    }

    val nextProgress = previewProgressNorm.coerceIn(0f, 1f)
    val nowElapsedRealtimeMs = SystemClock.elapsedRealtime()
    if (!shouldSendPreviewScrub(nextProgress, nowElapsedRealtimeMs)) {
      return
    }

    val payload = JSONObject().apply {
      put("version", 1)
      put("mode", "preview-scrub")
      put("previewSessionId", previewSessionId)
      put("progress", nextProgress.toDouble())
      put("source", "watch")
    }.toString().toByteArray(Charsets.UTF_8)

    sendPreviewScrubPayloadToPhone(payload, nextProgress, nowElapsedRealtimeMs)
  }

  private fun sendPreviewScrubPayloadToPhone(
    payload: ByteArray,
    nextProgress: Float,
    nowElapsedRealtimeMs: Long,
  ) {
    val knownPhoneNodeId = connectedPhoneNodeId
    if (!knownPhoneNodeId.isNullOrBlank()) {
      messageClient.sendMessage(knownPhoneNodeId, WearPaths.PREVIEW_SCRUB, payload)
        .addOnSuccessListener {
          lastSentPreviewScrubProgressNorm = nextProgress
          lastSentPreviewScrubElapsedRealtimeMs = nowElapsedRealtimeMs
        }
        .addOnFailureListener { error ->
          connectedPhoneNodeId = null
          logWarn(
            "payload_send_failed",
            error,
            "path" to WearPaths.PREVIEW_SCRUB,
            "targetNodeId" to knownPhoneNodeId,
            "cache" to "nodeId",
          )
          resolvePhoneNodeAndSendPreviewScrub(payload, nextProgress, nowElapsedRealtimeMs)
        }
      return
    }

    resolvePhoneNodeAndSendPreviewScrub(payload, nextProgress, nowElapsedRealtimeMs)
  }

  private fun resolvePhoneNodeAndSendPreviewScrub(
    payload: ByteArray,
    nextProgress: Float,
    nowElapsedRealtimeMs: Long,
  ) {
    nodeClient.connectedNodes
      .addOnSuccessListener { nodes ->
        val targetNode = nodes.firstOrNull() ?: return@addOnSuccessListener
        connectedPhoneNodeId = targetNode.id
        messageClient.sendMessage(targetNode.id, WearPaths.PREVIEW_SCRUB, payload)
          .addOnSuccessListener {
            lastSentPreviewScrubProgressNorm = nextProgress
            lastSentPreviewScrubElapsedRealtimeMs = nowElapsedRealtimeMs
          }
          .addOnFailureListener { error ->
            connectedPhoneNodeId = null
            logWarn(
              "payload_send_failed",
              error,
              "path" to WearPaths.PREVIEW_SCRUB,
              "targetNodeId" to targetNode.id,
            )
          }
      }
      .addOnFailureListener { error ->
        connectedPhoneNodeId = null
        logWarn(
          "connectivity_node_resolve_failed",
          error,
          "path" to WearPaths.PREVIEW_SCRUB,
        )
      }
  }

  private fun shouldSendPreviewScrub(nextProgress: Float, nowElapsedRealtimeMs: Long): Boolean {
    val previousProgress = lastSentPreviewScrubProgressNorm
    if (!previousProgress.isFinite()) {
      return true
    }

    if (abs(nextProgress - previousProgress) < PREVIEW_PROGRESS_EPSILON) {
      return false
    }

    val elapsedMs = nowElapsedRealtimeMs - lastSentPreviewScrubElapsedRealtimeMs
    return elapsedMs >= PREVIEW_SCRUB_MIN_SEND_INTERVAL_MS
  }

  private fun applyStaleRenderFallbackIfNeeded() {
    if (renderMode == RenderMode.PREVIEW || !hasSeenLiveRenderPayload || hasAppliedStaleFallback) {
      return
    }

    val elapsedSinceLiveRenderMs = SystemClock.elapsedRealtime() - lastLiveRenderElapsedRealtimeMs
    if (elapsedSinceLiveRenderMs < LIVE_STALE_RENDER_TIMEOUT_MS) {
      return
    }

    eclipseRenderView.renderSunOnly()
    hasAppliedStaleFallback = true
    logWarn(
      "live_payload_stale_fallback",
      "staleMs" to elapsedSinceLiveRenderMs,
      "timeoutMs" to LIVE_STALE_RENDER_TIMEOUT_MS,
    )
    showErrorStatus(R.string.status_live_payload_stale)
  }

  private fun logInfo(event: String, vararg fields: Pair<String, Any?>) {
    Log.i(TAG, buildLogMessage(event, fields))
  }

  private fun logWarn(event: String, vararg fields: Pair<String, Any?>) {
    Log.w(TAG, buildLogMessage(event, fields))
  }

  private fun logWarn(event: String, error: Throwable?, vararg fields: Pair<String, Any?>) {
    if (error == null) {
      logWarn(event, *fields)
      return
    }
    Log.w(TAG, buildLogMessage(event, fields), error)
  }

  private fun buildLogMessage(event: String, fields: Array<out Pair<String, Any?>>): String {
    val payload = JSONObject()
    payload.put("event", event)
    payload.put("mode", renderMode.name.lowercase())
    for ((key, value) in fields) {
      if (value != null) {
        payload.put(key, value)
      }
    }
    return payload.toString()
  }

  private fun parseLiveRenderPayload(rawPayload: String): LiveRenderPayload? {
    val parsed = runCatching { JSONObject(rawPayload) }.getOrNull() ?: return null
    if (parsed.optInt("version", -1) != 1 || parsed.optString("mode") != "live") {
      return null
    }

    val showMoon = parsed.optBoolean("showMoon", false)
    if (!showMoon) {
      return LiveRenderPayload(
        showMoon = false,
        moonRadiusNorm = 0f,
        moonCenterXNorm = 0.5f,
        moonCenterYNorm = 0.5f,
      )
    }

    val moon = parsed.optJSONObject("moon") ?: return null
    val radiusNorm = moon.optDouble("radiusNorm", Double.NaN)
    val centerXNorm = moon.optDouble("centerXNorm", Double.NaN)
    val centerYNorm = moon.optDouble("centerYNorm", Double.NaN)
    if (!radiusNorm.isFinite() || !centerXNorm.isFinite() || !centerYNorm.isFinite()) {
      return null
    }

    return LiveRenderPayload(
      showMoon = true,
      moonRadiusNorm = radiusNorm.toFloat().coerceIn(0f, 1f),
      moonCenterXNorm = centerXNorm.toFloat().coerceIn(0f, 1f),
      moonCenterYNorm = centerYNorm.toFloat().coerceIn(0f, 1f),
    )
  }

  private fun parsePreviewRenderPayload(parsed: JSONObject): PreviewRenderPayload? {
    if (parsed.optInt("version", -1) != 1 || parsed.optString("mode") != "preview") {
      return null
    }

    val previewSessionId = parsed.optString("previewSessionId")
    if (previewSessionId.isBlank()) {
      return null
    }

    val initialProgress = parsed.optDouble("initialProgress", Double.NaN)
    val visual = parsed.optJSONObject("visual") ?: return null
    val sunRadiusNorm = visual.optDouble("sunRadiusNorm", Double.NaN)
    val moonRadiusNorm = visual.optDouble("moonRadiusNorm", Double.NaN)
    val moonClosestOffsetNorm = visual.optDouble("moonClosestOffsetNorm", Double.NaN)
    val moonTravelHalfSpanNorm = visual.optDouble("moonTravelHalfSpanNorm", Double.NaN)
    val travelVectorXNorm = visual.optDouble("travelVectorXNorm", Double.NaN)
    val travelVectorYNorm = visual.optDouble("travelVectorYNorm", Double.NaN)
    val c1ProgressNorm = visual.optDouble("c1ProgressNorm", Double.NaN)
    val c2ProgressNorm = visual.optDouble("c2ProgressNorm", Double.NaN)
    val maxProgressNorm = visual.optDouble("maxProgressNorm", Double.NaN)
    val c3ProgressNorm = visual.optDouble("c3ProgressNorm", Double.NaN)
    val c4ProgressNorm = visual.optDouble("c4ProgressNorm", Double.NaN)
    if (
      !initialProgress.isFinite() ||
      !sunRadiusNorm.isFinite() ||
      !moonRadiusNorm.isFinite() ||
      !moonClosestOffsetNorm.isFinite() ||
      !moonTravelHalfSpanNorm.isFinite()
    ) {
      return null
    }

    return PreviewRenderPayload(
      previewSessionId = previewSessionId,
      initialProgress = initialProgress.toFloat().coerceIn(0f, 1f),
      sunRadiusNorm = sunRadiusNorm.toFloat().coerceIn(0f, 1f),
      moonRadiusNorm = moonRadiusNorm.toFloat().coerceIn(0f, 1f),
      moonClosestOffsetNorm = moonClosestOffsetNorm.toFloat().coerceIn(-1f, 1f),
      moonTravelHalfSpanNorm = moonTravelHalfSpanNorm.toFloat().coerceIn(0f, 1f),
      travelVectorXNorm = if (travelVectorXNorm.isFinite()) {
        travelVectorXNorm.toFloat().coerceIn(-1f, 1f)
      } else {
        1f
      },
      travelVectorYNorm = if (travelVectorYNorm.isFinite()) {
        travelVectorYNorm.toFloat().coerceIn(-1f, 1f)
      } else {
        0f
      },
      c1ProgressNorm = if (c1ProgressNorm.isFinite()) c1ProgressNorm.toFloat().coerceIn(0f, 1f) else null,
      c2ProgressNorm = if (c2ProgressNorm.isFinite()) c2ProgressNorm.toFloat().coerceIn(0f, 1f) else null,
      maxProgressNorm = if (maxProgressNorm.isFinite()) {
        maxProgressNorm.toFloat().coerceIn(0f, 1f)
      } else {
        null
      },
      c3ProgressNorm = if (c3ProgressNorm.isFinite()) c3ProgressNorm.toFloat().coerceIn(0f, 1f) else null,
      c4ProgressNorm = if (c4ProgressNorm.isFinite()) c4ProgressNorm.toFloat().coerceIn(0f, 1f) else null,
    )
  }

  private fun parsePreviewScrubPayload(rawPayload: String): PreviewScrubPayload? {
    val parsed = runCatching { JSONObject(rawPayload) }.getOrNull() ?: return null
    if (parsed.optInt("version", -1) != 1 || parsed.optString("mode") != "preview-scrub") {
      return null
    }

    val previewSessionId = parsed.optString("previewSessionId")
    if (previewSessionId.isBlank()) {
      return null
    }

    val progress = parsed.optDouble("progress", Double.NaN)
    if (!progress.isFinite()) {
      return null
    }

    val source = parsed.optString("source")
    if (source != "phone" && source != "watch") {
      return null
    }

    return PreviewScrubPayload(
      previewSessionId = previewSessionId,
      progressNorm = progress.toFloat().coerceIn(0f, 1f),
      source = source,
    )
  }

  private fun applyDeepLink(sourceIntent: Intent?) {
    val data = sourceIntent?.data
    if (data == null || !data.scheme.equals(DEEP_LINK_SCHEME, ignoreCase = true)) {
      activeDeepLinkLabel = null
      return
    }

    val label = formatDeepLinkLabel(data)
    activeDeepLinkLabel = label
  }

  private fun showErrorStatus(messageResId: Int, vararg formatArgs: Any) {
    statusText.visibility = View.VISIBLE
    statusText.text = if (formatArgs.isNotEmpty()) {
      getString(messageResId, *formatArgs)
    } else {
      getString(messageResId)
    }
  }

  private fun clearStatusMessage() {
    statusText.text = ""
    statusText.visibility = View.GONE
  }

  private fun formatDeepLinkLabel(uri: Uri): String {
    val host = uri.host.orEmpty()
    val path = uri.path.orEmpty()
    val query = uri.query?.takeIf { it.isNotBlank() }?.let { "?$it" }.orEmpty()

    if (host.isNotBlank() || path.isNotBlank()) {
      return "$host$path$query"
    }
    return uri.toString()
  }

  private fun hasActiveDeepLink(): Boolean = !activeDeepLinkLabel.isNullOrBlank()

  companion object {
    private const val DEEP_LINK_SCHEME = "eclipsetimer"
    private const val TAG = "WearMainActivity"
    private const val LOCATION_UPDATE_INTERVAL_MS = 15_000L
    private const val MIN_LOCATION_UPDATE_INTERVAL_MS = 5_000L
    private const val MIN_LOCATION_DISTANCE_METERS = 25f
    private const val FORCE_LOCATION_SEND_INTERVAL_MS = 60_000L
    private const val LIVE_STALE_RENDER_TIMEOUT_MS = 90_000L
    private const val LIVE_STALE_CHECK_INTERVAL_MS = 5_000L
    private const val PREVIEW_ROTARY_SENSITIVITY = 0.025f
    private const val PREVIEW_SCRUB_MIN_SEND_INTERVAL_MS = 25L
    private const val PREVIEW_PROGRESS_EPSILON = 0.001f
  }
}
