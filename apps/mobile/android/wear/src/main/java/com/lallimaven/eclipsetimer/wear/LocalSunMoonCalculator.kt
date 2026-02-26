package com.lallimaven.eclipsetimer.wear

import kotlin.math.PI
import kotlin.math.asin
import kotlin.math.atan
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin
import kotlin.math.tan

object LocalSunMoonCalculator {
  data class LiveGeometry(
    val showMoon: Boolean,
    val moonRadiusNorm: Float,
    val moonCenterXNorm: Float,
    val moonCenterYNorm: Float,
  )

  private data class EquatorialPosition(
    val rightAscensionRad: Double,
    val declinationRad: Double,
    val distanceKm: Double,
    val angularRadiusRad: Double,
  )

  private data class HorizontalPosition(
    val altitudeRad: Double,
    val azimuthRad: Double,
  )

  private data class Vec3(
    val x: Double,
    val y: Double,
    val z: Double,
  )

  fun calculateLiveGeometry(
    latitudeDeg: Double,
    longitudeDeg: Double,
    epochMillis: Long,
  ): LiveGeometry {
    val julianDay = epochMillis / MILLIS_PER_DAY + JULIAN_UNIX_EPOCH
    val daysSinceJ2000 = julianDay - JULIAN_J2000
    val centuriesSinceJ2000 = daysSinceJ2000 / 36525.0
    val obliquityRad = toRadians(23.439291 - 0.0130042 * centuriesSinceJ2000)

    val sunEquatorial = computeSunEquatorial(daysSinceJ2000, obliquityRad)
    val moonEquatorial = computeMoonEquatorial(daysSinceJ2000, obliquityRad)
    val moonTopocentric = applyMoonTopocentricCorrection(
      moonEquatorial = moonEquatorial,
      latitudeDeg = latitudeDeg,
      longitudeDeg = longitudeDeg,
      julianDay = julianDay,
    )

    val localSiderealRad = computeLocalSiderealRad(julianDay, longitudeDeg)
    val latitudeRad = toRadians(latitudeDeg)
    val sunHorizontal = convertToHorizontal(sunEquatorial, localSiderealRad, latitudeRad)
    val moonHorizontal = convertToHorizontal(moonTopocentric, localSiderealRad, latitudeRad)
    val sunVector = horizontalToEnuVector(sunHorizontal)
    val moonVector = horizontalToEnuVector(moonHorizontal)
    val centerSeparationRad = angularSeparationRad(sunVector, moonVector)

    val sunAboveHorizon = sunHorizontal.altitudeRad > MIN_BODY_ALTITUDE_RAD
    val moonAboveHorizon = moonHorizontal.altitudeRad > MIN_BODY_ALTITUDE_RAD
    val overlapThresholdRad =
      sunEquatorial.angularRadiusRad + moonTopocentric.angularRadiusRad + ECLIPSE_MARGIN_RAD
    val shouldShowMoon = sunAboveHorizon && moonAboveHorizon && centerSeparationRad <= overlapThresholdRad
    if (!shouldShowMoon || sunEquatorial.angularRadiusRad <= 0.0) {
      return LiveGeometry(
        showMoon = false,
        moonRadiusNorm = 0f,
        moonCenterXNorm = DEFAULT_CENTER_NORM.toFloat(),
        moonCenterYNorm = DEFAULT_CENTER_NORM.toFloat(),
      )
    }

    val tangentBasisEast = Vec3(
      x = cos(sunHorizontal.azimuthRad),
      y = -sin(sunHorizontal.azimuthRad),
      z = 0.0,
    )
    val tangentBasisNorth = Vec3(
      x = -sin(sunHorizontal.altitudeRad) * sin(sunHorizontal.azimuthRad),
      y = -sin(sunHorizontal.altitudeRad) * cos(sunHorizontal.azimuthRad),
      z = cos(sunHorizontal.altitudeRad),
    )

    val forward = max(dot(moonVector, sunVector), MIN_FORWARD_DOT)
    val offsetEastRad = dot(moonVector, tangentBasisEast) / forward
    val offsetNorthRad = dot(moonVector, tangentBasisNorth) / forward
    val normPerRad = DEFAULT_SUN_RADIUS_NORM / sunEquatorial.angularRadiusRad
    val moonRadiusNorm =
      (DEFAULT_SUN_RADIUS_NORM * (moonTopocentric.angularRadiusRad / sunEquatorial.angularRadiusRad))
        .coerceIn(MIN_MOON_RADIUS_NORM, MAX_MOON_RADIUS_NORM)
    val moonCenterXNorm = (DEFAULT_CENTER_NORM + offsetEastRad * normPerRad).coerceIn(0.0, 1.0)
    val moonCenterYNorm = (DEFAULT_CENTER_NORM - offsetNorthRad * normPerRad).coerceIn(0.0, 1.0)

    return LiveGeometry(
      showMoon = true,
      moonRadiusNorm = moonRadiusNorm.toFloat(),
      moonCenterXNorm = moonCenterXNorm.toFloat(),
      moonCenterYNorm = moonCenterYNorm.toFloat(),
    )
  }

  private fun computeSunEquatorial(
    daysSinceJ2000: Double,
    obliquityRad: Double,
  ): EquatorialPosition {
    val meanAnomalyRad = toRadians(normalizeDegrees(357.5291 + 0.98560028 * daysSinceJ2000))
    val equationOfCenterRad =
      toRadians(1.9148) * sin(meanAnomalyRad) +
        toRadians(0.0200) * sin(2.0 * meanAnomalyRad) +
        toRadians(0.0003) * sin(3.0 * meanAnomalyRad)
    val perihelionRad = toRadians(102.9372)
    val eclipticLongitudeRad = meanAnomalyRad + equationOfCenterRad + perihelionRad + PI

    val rightAscensionRad = atan2(
      sin(eclipticLongitudeRad) * cos(obliquityRad),
      cos(eclipticLongitudeRad),
    )
    val declinationRad = asin(sin(eclipticLongitudeRad) * sin(obliquityRad))
    val distanceAu =
      1.00014 -
        0.01671 * cos(meanAnomalyRad) -
        0.00014 * cos(2.0 * meanAnomalyRad)
    val angularRadiusRad = toRadians(0.2666 / distanceAu)

    return EquatorialPosition(
      rightAscensionRad = rightAscensionRad,
      declinationRad = declinationRad,
      distanceKm = distanceAu * ASTRONOMICAL_UNIT_KM,
      angularRadiusRad = angularRadiusRad,
    )
  }

  private fun computeMoonEquatorial(
    daysSinceJ2000: Double,
    obliquityRad: Double,
  ): EquatorialPosition {
    val meanLongitudeRad = toRadians(normalizeDegrees(218.316 + 13.176396 * daysSinceJ2000))
    val meanAnomalyRad = toRadians(normalizeDegrees(134.963 + 13.064993 * daysSinceJ2000))
    val argumentOfLatitudeRad = toRadians(normalizeDegrees(93.272 + 13.229350 * daysSinceJ2000))
    val eclipticLongitudeRad = meanLongitudeRad + toRadians(6.289) * sin(meanAnomalyRad)
    val eclipticLatitudeRad = toRadians(5.128) * sin(argumentOfLatitudeRad)
    val distanceKm = 385_001.0 - 20_905.0 * cos(meanAnomalyRad)

    val rightAscensionRad = atan2(
      sin(eclipticLongitudeRad) * cos(obliquityRad) -
        tan(eclipticLatitudeRad) * sin(obliquityRad),
      cos(eclipticLongitudeRad),
    )
    val declinationRad = asin(
      sin(eclipticLatitudeRad) * cos(obliquityRad) +
        cos(eclipticLatitudeRad) * sin(obliquityRad) * sin(eclipticLongitudeRad),
    )
    val angularRadiusRad = asin((MOON_RADIUS_KM / distanceKm).coerceIn(-1.0, 1.0))

    return EquatorialPosition(
      rightAscensionRad = rightAscensionRad,
      declinationRad = declinationRad,
      distanceKm = distanceKm,
      angularRadiusRad = angularRadiusRad,
    )
  }

  private fun applyMoonTopocentricCorrection(
    moonEquatorial: EquatorialPosition,
    latitudeDeg: Double,
    longitudeDeg: Double,
    julianDay: Double,
  ): EquatorialPosition {
    val latitudeRad = toRadians(latitudeDeg)
    val localSiderealRad = computeLocalSiderealRad(julianDay, longitudeDeg)
    val hourAngleRad = normalizeSignedRadians(localSiderealRad - moonEquatorial.rightAscensionRad)
    val u = atan(0.99664719 * tan(latitudeRad))
    val observerX = cos(u)
    val observerY = 0.99664719 * sin(u)
    val sinParallax = EARTH_RADIUS_KM / moonEquatorial.distanceKm
    val rightAscensionCorrectionRad = atan2(
      -observerX * sinParallax * sin(hourAngleRad),
      cos(moonEquatorial.declinationRad) - observerX * sinParallax * cos(hourAngleRad),
    )
    val correctedRightAscensionRad = moonEquatorial.rightAscensionRad + rightAscensionCorrectionRad
    val correctedDeclinationRad = atan2(
      (sin(moonEquatorial.declinationRad) - observerY * sinParallax) * cos(rightAscensionCorrectionRad),
      cos(moonEquatorial.declinationRad) - observerX * sinParallax * cos(hourAngleRad),
    )

    return moonEquatorial.copy(
      rightAscensionRad = correctedRightAscensionRad,
      declinationRad = correctedDeclinationRad,
    )
  }

  private fun computeLocalSiderealRad(julianDay: Double, longitudeDeg: Double): Double {
    val centuriesSinceJ2000 = (julianDay - JULIAN_J2000) / 36525.0
    val gmstDeg =
      280.46061837 +
        360.98564736629 * (julianDay - JULIAN_J2000) +
        0.000387933 * centuriesSinceJ2000 * centuriesSinceJ2000 -
        (centuriesSinceJ2000 * centuriesSinceJ2000 * centuriesSinceJ2000) / 38710000.0
    return normalizeRadians(toRadians(gmstDeg + longitudeDeg))
  }

  private fun convertToHorizontal(
    equatorial: EquatorialPosition,
    localSiderealRad: Double,
    latitudeRad: Double,
  ): HorizontalPosition {
    val hourAngleRad = normalizeSignedRadians(localSiderealRad - equatorial.rightAscensionRad)
    val sinAltitude =
      sin(latitudeRad) * sin(equatorial.declinationRad) +
        cos(latitudeRad) * cos(equatorial.declinationRad) * cos(hourAngleRad)
    val altitudeRad = asin(sinAltitude.coerceIn(-1.0, 1.0))
    val azimuthRad = atan2(
      -sin(hourAngleRad),
      tan(equatorial.declinationRad) * cos(latitudeRad) - sin(latitudeRad) * cos(hourAngleRad),
    )
    return HorizontalPosition(
      altitudeRad = altitudeRad,
      azimuthRad = normalizeRadians(azimuthRad),
    )
  }

  private fun horizontalToEnuVector(horizontal: HorizontalPosition): Vec3 {
    val cosAltitude = cos(horizontal.altitudeRad)
    return Vec3(
      x = cosAltitude * sin(horizontal.azimuthRad),
      y = cosAltitude * cos(horizontal.azimuthRad),
      z = sin(horizontal.altitudeRad),
    )
  }

  private fun angularSeparationRad(first: Vec3, second: Vec3): Double {
    val cosine = dot(first, second).coerceIn(-1.0, 1.0)
    return kotlin.math.acos(cosine)
  }

  private fun dot(first: Vec3, second: Vec3): Double =
    first.x * second.x + first.y * second.y + first.z * second.z

  private fun normalizeRadians(value: Double): Double {
    val period = 2.0 * PI
    var normalized = value % period
    if (normalized < 0.0) {
      normalized += period
    }
    return normalized
  }

  private fun normalizeSignedRadians(value: Double): Double {
    var normalized = normalizeRadians(value)
    if (normalized > PI) {
      normalized -= 2.0 * PI
    }
    return normalized
  }

  private fun normalizeDegrees(value: Double): Double {
    var normalized = value % 360.0
    if (normalized < 0.0) {
      normalized += 360.0
    }
    return normalized
  }

  private fun toRadians(valueDeg: Double): Double = valueDeg * PI / 180.0

  private const val MILLIS_PER_DAY = 86_400_000.0
  private const val JULIAN_UNIX_EPOCH = 2_440_587.5
  private const val JULIAN_J2000 = 2_451_545.0
  private const val ASTRONOMICAL_UNIT_KM = 149_597_870.7
  private const val EARTH_RADIUS_KM = 6_378.14
  private const val MOON_RADIUS_KM = 1_737.4
  private const val DEFAULT_SUN_RADIUS_NORM = 0.24
  private const val DEFAULT_CENTER_NORM = 0.5
  private const val MIN_MOON_RADIUS_NORM = 0.05
  private const val MAX_MOON_RADIUS_NORM = 0.45
  private const val MIN_FORWARD_DOT = 0.000001
  private const val MIN_BODY_ALTITUDE_RAD = -1.5 * PI / 180.0
  private const val ECLIPSE_MARGIN_RAD = 0.08 * PI / 180.0
}
