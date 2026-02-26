const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const MILLIS_PER_DAY = 86_400_000;
const JULIAN_UNIX_EPOCH = 2_440_587.5;
const JULIAN_J2000 = 2_451_545.0;
const ASTRONOMICAL_UNIT_KM = 149_597_870.7;
const EARTH_RADIUS_KM = 6_378.14;
const MOON_RADIUS_KM = 1_737.4;

type EquatorialPosition = {
  rightAscensionRad: number;
  declinationRad: number;
  distanceKm: number;
  angularRadiusRad: number;
};

type HorizontalPosition = {
  altitudeRad: number;
  azimuthRad: number;
};

export type HorizontalBodyPosition = {
  azimuthDeg: number;
  altitudeDeg: number;
  rightAscensionDeg: number;
  declinationDeg: number;
  distanceKm: number;
  angularRadiusDeg: number;
};

export type SunMoonHorizontalPosition = {
  sun: HorizontalBodyPosition;
  moon: HorizontalBodyPosition;
};

function toRadians(valueDeg: number): number {
  return valueDeg * DEG2RAD;
}

function toDegrees(valueRad: number): number {
  return valueRad * RAD2DEG;
}

function normalizeRadians(value: number): number {
  const period = Math.PI * 2;
  let normalized = value % period;
  if (normalized < 0) normalized += period;
  return normalized;
}

function normalizeSignedRadians(value: number): number {
  let normalized = normalizeRadians(value);
  if (normalized > Math.PI) normalized -= Math.PI * 2;
  return normalized;
}

function normalizeDegrees(value: number): number {
  let normalized = value % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}

function normalizeSignedDegrees(value: number): number {
  const normalized = ((value + 540) % 360) - 180;
  return normalized === -180 ? 180 : normalized;
}

function computeLocalSiderealRad(julianDay: number, longitudeDeg: number): number {
  const centuriesSinceJ2000 = (julianDay - JULIAN_J2000) / 36_525;
  const gmstDeg =
    280.46061837 +
    360.98564736629 * (julianDay - JULIAN_J2000) +
    0.000387933 * centuriesSinceJ2000 * centuriesSinceJ2000 -
    (centuriesSinceJ2000 * centuriesSinceJ2000 * centuriesSinceJ2000) / 38_710_000;
  return normalizeRadians(toRadians(gmstDeg + longitudeDeg));
}

function computeSunEquatorial(daysSinceJ2000: number, obliquityRad: number): EquatorialPosition {
  const meanAnomalyRad = toRadians(normalizeDegrees(357.5291 + 0.98560028 * daysSinceJ2000));
  const equationOfCenterRad =
    toRadians(1.9148) * Math.sin(meanAnomalyRad) +
    toRadians(0.02) * Math.sin(2 * meanAnomalyRad) +
    toRadians(0.0003) * Math.sin(3 * meanAnomalyRad);
  const perihelionRad = toRadians(102.9372);
  const eclipticLongitudeRad = meanAnomalyRad + equationOfCenterRad + perihelionRad + Math.PI;

  const rightAscensionRad = Math.atan2(
    Math.sin(eclipticLongitudeRad) * Math.cos(obliquityRad),
    Math.cos(eclipticLongitudeRad),
  );
  const declinationRad = Math.asin(Math.sin(eclipticLongitudeRad) * Math.sin(obliquityRad));
  const distanceAu =
    1.00014 - 0.01671 * Math.cos(meanAnomalyRad) - 0.00014 * Math.cos(2 * meanAnomalyRad);
  const angularRadiusRad = toRadians(0.2666 / distanceAu);

  return {
    rightAscensionRad,
    declinationRad,
    distanceKm: distanceAu * ASTRONOMICAL_UNIT_KM,
    angularRadiusRad,
  };
}

function computeMoonEquatorial(daysSinceJ2000: number, obliquityRad: number): EquatorialPosition {
  const meanLongitudeRad = toRadians(normalizeDegrees(218.316 + 13.176396 * daysSinceJ2000));
  const meanAnomalyRad = toRadians(normalizeDegrees(134.963 + 13.064993 * daysSinceJ2000));
  const argumentOfLatitudeRad = toRadians(normalizeDegrees(93.272 + 13.22935 * daysSinceJ2000));
  const eclipticLongitudeRad = meanLongitudeRad + toRadians(6.289) * Math.sin(meanAnomalyRad);
  const eclipticLatitudeRad = toRadians(5.128) * Math.sin(argumentOfLatitudeRad);
  const distanceKm = 385_001 - 20_905 * Math.cos(meanAnomalyRad);

  const rightAscensionRad = Math.atan2(
    Math.sin(eclipticLongitudeRad) * Math.cos(obliquityRad) -
      Math.tan(eclipticLatitudeRad) * Math.sin(obliquityRad),
    Math.cos(eclipticLongitudeRad),
  );
  const declinationRad = Math.asin(
    Math.sin(eclipticLatitudeRad) * Math.cos(obliquityRad) +
      Math.cos(eclipticLatitudeRad) * Math.sin(obliquityRad) * Math.sin(eclipticLongitudeRad),
  );
  const angularRadiusRad = Math.asin(Math.max(-1, Math.min(1, MOON_RADIUS_KM / distanceKm)));

  return {
    rightAscensionRad,
    declinationRad,
    distanceKm,
    angularRadiusRad,
  };
}

function applyMoonTopocentricCorrection(input: {
  moonEquatorial: EquatorialPosition;
  latitudeDeg: number;
  longitudeDeg: number;
  julianDay: number;
}): EquatorialPosition {
  const latitudeRad = toRadians(input.latitudeDeg);
  const localSiderealRad = computeLocalSiderealRad(input.julianDay, input.longitudeDeg);
  const hourAngleRad = normalizeSignedRadians(
    localSiderealRad - input.moonEquatorial.rightAscensionRad,
  );
  const u = Math.atan(0.99664719 * Math.tan(latitudeRad));
  const observerX = Math.cos(u);
  const observerY = 0.99664719 * Math.sin(u);
  const sinParallax = EARTH_RADIUS_KM / input.moonEquatorial.distanceKm;
  const rightAscensionCorrectionRad = Math.atan2(
    -observerX * sinParallax * Math.sin(hourAngleRad),
    Math.cos(input.moonEquatorial.declinationRad) -
      observerX * sinParallax * Math.cos(hourAngleRad),
  );
  const correctedRightAscensionRad =
    input.moonEquatorial.rightAscensionRad + rightAscensionCorrectionRad;
  const correctedDeclinationRad = Math.atan2(
    (Math.sin(input.moonEquatorial.declinationRad) - observerY * sinParallax) *
      Math.cos(rightAscensionCorrectionRad),
    Math.cos(input.moonEquatorial.declinationRad) -
      observerX * sinParallax * Math.cos(hourAngleRad),
  );

  return {
    ...input.moonEquatorial,
    rightAscensionRad: correctedRightAscensionRad,
    declinationRad: correctedDeclinationRad,
  };
}

function convertToHorizontal(input: {
  equatorial: EquatorialPosition;
  localSiderealRad: number;
  latitudeRad: number;
}): HorizontalPosition {
  const hourAngleRad = normalizeSignedRadians(
    input.localSiderealRad - input.equatorial.rightAscensionRad,
  );
  const sinAltitude =
    Math.sin(input.latitudeRad) * Math.sin(input.equatorial.declinationRad) +
    Math.cos(input.latitudeRad) *
      Math.cos(input.equatorial.declinationRad) *
      Math.cos(hourAngleRad);
  const altitudeRad = Math.asin(Math.max(-1, Math.min(1, sinAltitude)));
  const azimuthRad = Math.atan2(
    -Math.sin(hourAngleRad),
    Math.tan(input.equatorial.declinationRad) * Math.cos(input.latitudeRad) -
      Math.sin(input.latitudeRad) * Math.cos(hourAngleRad),
  );

  return {
    altitudeRad,
    azimuthRad: normalizeRadians(azimuthRad),
  };
}

function toHorizontalBodyPosition(
  equatorial: EquatorialPosition,
  horizontal: HorizontalPosition,
): HorizontalBodyPosition {
  return {
    azimuthDeg: normalizeDegrees(toDegrees(horizontal.azimuthRad)),
    altitudeDeg: toDegrees(horizontal.altitudeRad),
    rightAscensionDeg: normalizeDegrees(toDegrees(equatorial.rightAscensionRad)),
    declinationDeg: normalizeSignedDegrees(toDegrees(equatorial.declinationRad)),
    distanceKm: equatorial.distanceKm,
    angularRadiusDeg: toDegrees(equatorial.angularRadiusRad),
  };
}

export function calculateSunMoonHorizontalPosition(input: {
  latitudeDeg: number;
  longitudeDeg: number;
  epochMs: number;
}): SunMoonHorizontalPosition {
  const julianDay = input.epochMs / MILLIS_PER_DAY + JULIAN_UNIX_EPOCH;
  const daysSinceJ2000 = julianDay - JULIAN_J2000;
  const centuriesSinceJ2000 = daysSinceJ2000 / 36_525;
  const obliquityRad = toRadians(23.439291 - 0.0130042 * centuriesSinceJ2000);

  const sunEquatorial = computeSunEquatorial(daysSinceJ2000, obliquityRad);
  const moonEquatorial = computeMoonEquatorial(daysSinceJ2000, obliquityRad);
  const moonTopocentric = applyMoonTopocentricCorrection({
    moonEquatorial,
    latitudeDeg: input.latitudeDeg,
    longitudeDeg: input.longitudeDeg,
    julianDay,
  });

  const localSiderealRad = computeLocalSiderealRad(julianDay, input.longitudeDeg);
  const latitudeRad = toRadians(input.latitudeDeg);
  const sunHorizontal = convertToHorizontal({
    equatorial: sunEquatorial,
    localSiderealRad,
    latitudeRad,
  });
  const moonHorizontal = convertToHorizontal({
    equatorial: moonTopocentric,
    localSiderealRad,
    latitudeRad,
  });

  return {
    sun: toHorizontalBodyPosition(sunEquatorial, sunHorizontal),
    moon: toHorizontalBodyPosition(moonTopocentric, moonHorizontal),
  };
}
