type AddressLabelSource = {
  formattedAddress?: string | null;
  name?: string | null;
  streetNumber?: string | null;
  street?: string | null;
  district?: string | null;
  city?: string | null;
  subregion?: string | null;
  region?: string | null;
  country?: string | null;
};

function normalizeAddressSegment(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function joinAddressSegments(values: Array<string | null | undefined>, separator: string) {
  const parts: string[] = [];
  for (const value of values) {
    const normalized = normalizeAddressSegment(value);
    if (!normalized) continue;
    parts.push(normalized);
  }
  if (!parts.length) return null;
  return parts.join(separator);
}

function dedupeAddressSegments(values: Array<string | null | undefined>) {
  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = normalizeAddressSegment(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(normalized);
  }

  return deduped;
}

export function formatAddressLabel(address: AddressLabelSource | null | undefined): string | null {
  if (!address) return null;

  const formatted = normalizeAddressSegment(address.formattedAddress);
  if (formatted) return formatted;

  const streetLine = joinAddressSegments([address.streetNumber, address.street], " ");
  const primary = normalizeAddressSegment(address.name) ?? streetLine ?? address.district;
  const localityParts = dedupeAddressSegments([address.city, address.subregion, address.region]);
  const locality = localityParts.length ? localityParts.join(", ") : null;
  const segments = dedupeAddressSegments([primary, locality, address.country]);

  if (!segments.length) return null;
  return segments.join(", ");
}
