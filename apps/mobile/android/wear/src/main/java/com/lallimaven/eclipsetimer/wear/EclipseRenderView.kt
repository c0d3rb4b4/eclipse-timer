package com.lallimaven.eclipsetimer.wear

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.AttributeSet
import android.view.View
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

class EclipseRenderView @JvmOverloads constructor(
  context: Context,
  attrs: AttributeSet? = null,
) : View(context, attrs) {
  private val sunGlowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.FILL
    color = Color.rgb(255, 208, 121)
  }
  private val sunDiskPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.FILL
    color = Color.parseColor("#FFD36F")
  }
  private val sunRingPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = 3f
    color = Color.parseColor("#FFE2A6")
  }
  private val moonPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.FILL
    color = Color.parseColor("#0D1020")
  }
  private val moonRingPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeWidth = 2f
    color = Color.parseColor("#3D4267")
  }
  private val totalityCoronaPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeCap = Paint.Cap.ROUND
    color = Color.rgb(164, 215, 255)
  }
  private val totalityRingPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    color = Color.rgb(230, 243, 255)
  }

  private var showMoon = false
  private var sunRadiusNorm = DEFAULT_SUN_RADIUS_NORM
  private var moonRadiusNorm = 0f
  private var moonCenterXNorm = DEFAULT_CENTER_NORM
  private var moonCenterYNorm = DEFAULT_CENTER_NORM

  fun renderSunOnly(sunRadiusNorm: Float = DEFAULT_SUN_RADIUS_NORM) {
    showMoon = false
    this.sunRadiusNorm = sunRadiusNorm.coerceIn(MIN_SUN_RADIUS_NORM, MAX_SUN_RADIUS_NORM)
    invalidate()
  }

  fun renderLiveMoon(radiusNorm: Float, centerXNorm: Float, centerYNorm: Float) {
    showMoon = true
    sunRadiusNorm = DEFAULT_SUN_RADIUS_NORM
    moonRadiusNorm = radiusNorm.coerceIn(0f, 1f)
    moonCenterXNorm = centerXNorm.coerceIn(0f, 1f)
    moonCenterYNorm = centerYNorm.coerceIn(0f, 1f)
    invalidate()
  }

  fun renderPreviewMoon(
    sunRadiusNorm: Float,
    moonRadiusNorm: Float,
    moonCenterXNorm: Float,
    moonCenterYNorm: Float,
  ) {
    showMoon = true
    this.sunRadiusNorm = sunRadiusNorm.coerceIn(MIN_SUN_RADIUS_NORM, MAX_SUN_RADIUS_NORM)
    this.moonRadiusNorm = moonRadiusNorm.coerceIn(0f, 1f)
    this.moonCenterXNorm = moonCenterXNorm.coerceIn(0f, 1f)
    this.moonCenterYNorm = moonCenterYNorm.coerceIn(0f, 1f)
    invalidate()
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    canvas.drawColor(Color.parseColor("#050505"))

    val widthF = width.toFloat()
    val heightF = height.toFloat()
    val centerX = widthF / 2f
    val centerY = heightF / 2f
    val minDimension = min(widthF, heightF)
    val renderZoom = RENDER_ZOOM_MULTIPLIER

    val sunRadius = minDimension * sunRadiusNorm * renderZoom
    var moonRadius = 0f
    var moonCenterX = centerX
    var moonCenterY = centerY
    var totalityBlend = 0f

    if (showMoon) {
      moonRadius = minDimension * moonRadiusNorm * renderZoom
      val moonBaseCenterX = widthF * moonCenterXNorm
      val moonBaseCenterY = heightF * moonCenterYNorm
      moonCenterX = centerX + (moonBaseCenterX - centerX) * renderZoom
      moonCenterY = centerY + (moonBaseCenterY - centerY) * renderZoom
      totalityBlend = calculateTotalityBlend(
        sunRadius = sunRadius,
        sunCenterX = centerX,
        sunCenterY = centerY,
        moonRadius = moonRadius,
        moonCenterX = moonCenterX,
        moonCenterY = moonCenterY,
      )
    }

    val sunGlowOpacity = 1f - totalityBlend * 0.7f
    val sunDiskOpacity = 1f - totalityBlend * 0.94f
    sunGlowPaint.alpha = (BASE_SUN_GLOW_ALPHA * sunGlowOpacity).toInt().coerceIn(0, 255)
    sunDiskPaint.alpha = (BASE_SUN_DISK_ALPHA * sunDiskOpacity).toInt().coerceIn(0, 255)
    sunRingPaint.alpha = (BASE_SUN_RING_ALPHA * sunDiskOpacity).toInt().coerceIn(0, 255)

    val glowRadius = sunRadius * SUN_GLOW_MULTIPLIER
    canvas.drawCircle(centerX, centerY, glowRadius, sunGlowPaint)
    canvas.drawCircle(centerX, centerY, sunRadius, sunDiskPaint)
    canvas.drawCircle(centerX, centerY, max(1f, sunRadius - 1.5f), sunRingPaint)

    if (!showMoon) {
      return
    }

    if (totalityBlend > MIN_VISIBLE_TOTALITY_BLEND) {
      val totalityRingScale = 0.92f + totalityBlend * 0.1f
      val totalityCoronaScale = 0.88f + totalityBlend * 0.22f
      val totalityRingRadius =
        (moonRadius + minDimension * TOTALITY_RING_OFFSET_NORM) * totalityRingScale
      val totalityCoronaRadius =
        (moonRadius + minDimension * TOTALITY_CORONA_OFFSET_NORM) * totalityCoronaScale

      totalityCoronaPaint.strokeWidth = max(2f, minDimension * TOTALITY_CORONA_STROKE_NORM)
      totalityRingPaint.strokeWidth = max(1f, minDimension * TOTALITY_RING_STROKE_NORM)
      totalityCoronaPaint.alpha = (255f * totalityBlend * 0.66f).toInt().coerceIn(0, 255)
      totalityRingPaint.alpha = (255f * totalityBlend * 0.92f).toInt().coerceIn(0, 255)

      canvas.drawCircle(moonCenterX, moonCenterY, totalityCoronaRadius, totalityCoronaPaint)
    }

    canvas.drawCircle(moonCenterX, moonCenterY, moonRadius, moonPaint)
    canvas.drawCircle(moonCenterX, moonCenterY, max(1f, moonRadius - 1f), moonRingPaint)

    if (totalityBlend > MIN_VISIBLE_TOTALITY_BLEND) {
      val totalityRingScale = 0.92f + totalityBlend * 0.1f
      val totalityRingRadius =
        (moonRadius + minDimension * TOTALITY_RING_OFFSET_NORM) * totalityRingScale
      canvas.drawCircle(moonCenterX, moonCenterY, totalityRingRadius, totalityRingPaint)
    }
  }

  private fun calculateTotalityBlend(
    sunRadius: Float,
    sunCenterX: Float,
    sunCenterY: Float,
    moonRadius: Float,
    moonCenterX: Float,
    moonCenterY: Float,
  ): Float {
    if (moonRadius < sunRadius * TOTALITY_MIN_MOON_RADIUS_RATIO) {
      return 0f
    }

    val dx = moonCenterX - sunCenterX
    val dy = moonCenterY - sunCenterY
    val centerDistance = hypot(dx.toDouble(), dy.toDouble()).toFloat()
    val fullCoverageMargin = moonRadius - (sunRadius + centerDistance)
    val transitionWidth = max(2f, sunRadius * TOTALITY_BLEND_TRANSITION_RATIO)
    val normalizedBlend = (fullCoverageMargin + transitionWidth) / (transitionWidth * 1.1f)
    return smoothstep01(normalizedBlend)
  }

  private fun smoothstep01(value: Float): Float {
    val t = value.coerceIn(0f, 1f)
    return t * t * (3f - 2f * t)
  }

  companion object {
    private const val DEFAULT_SUN_RADIUS_NORM = 0.24f
    private const val SUN_GLOW_MULTIPLIER = 1.65f
    private const val RENDER_ZOOM_MULTIPLIER = 1.9f
    private const val DEFAULT_CENTER_NORM = 0.5f
    private const val MIN_SUN_RADIUS_NORM = 0.05f
    private const val MAX_SUN_RADIUS_NORM = 0.48f
    private const val BASE_SUN_GLOW_ALPHA = 52f
    private const val BASE_SUN_DISK_ALPHA = 255f
    private const val BASE_SUN_RING_ALPHA = 255f
    private const val TOTALITY_MIN_MOON_RADIUS_RATIO = 1.005f
    private const val TOTALITY_BLEND_TRANSITION_RATIO = 0.24f
    private const val TOTALITY_RING_OFFSET_NORM = 0.01f
    private const val TOTALITY_CORONA_OFFSET_NORM = 16f / 300f
    private const val TOTALITY_RING_STROKE_NORM = 4f / 300f
    private const val TOTALITY_CORONA_STROKE_NORM = 16f / 300f
    private const val MIN_VISIBLE_TOTALITY_BLEND = 0.002f
  }
}
