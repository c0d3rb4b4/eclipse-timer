import * as Location from "expo-location";

import { formatAddressLabel } from "../utils/address";

export async function geocodeAddressQuery(query: string) {
  const normalized = query.trim();
  if (!normalized) return [];
  return Location.geocodeAsync(normalized);
}

export async function resolveAddressLabelForCoordinates(lat: number, lon: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  try {
    const resolved = await Location.reverseGeocodeAsync({
      latitude: lat,
      longitude: lon,
    });
    const first = resolved[0];
    if (!first) return null;
    return formatAddressLabel(first);
  } catch {
    return null;
  }
}
