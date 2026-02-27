import { normalizeLongitude, sanitizeLatitude } from "./map";

export type ParsedSharedMapLink = {
  provider: "google" | "apple";
  lat: number;
  lon: number;
  rawUrl: string;
};

type FetchResponseLike = {
  url?: string;
};

type FetchLike = (input: string, init?: Record<string, unknown>) => Promise<FetchResponseLike>;

export type ExpandShortMapUrlOptions = {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
};

export type ParseSharedMapLinkAsyncOptions = ExpandShortMapUrlOptions;

const SUPPORTED_COORD_QUERY_KEYS = ["ll", "q", "query", "center", "destination"] as const;
const URL_IN_TEXT_RE = /https?:\/\/[^\s<>"']+/i;
const NUMBER_PART = "[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[+-]?\\d+)?";
const DEFAULT_EXPAND_TIMEOUT_MS = 3_000;
const COORD_PREFIX_RE = new RegExp(
  `^\\s*(${NUMBER_PART})\\s*,\\s*(${NUMBER_PART})(?:\\s*$|[,)])`,
  "i",
);
const GOOGLE_PATH_COORD_RE = new RegExp(
  `@(${NUMBER_PART})\\s*,\\s*(${NUMBER_PART})(?:\\s*,|\\s*$)`,
  "i",
);

function normalizeHost(hostname: string): string {
  return hostname.trim().replace(/\.+$/, "").toLowerCase();
}

function isGoogleShortHost(hostname: string): boolean {
  return normalizeHost(hostname) === "maps.app.goo.gl";
}

function providerFromHost(hostname: string): ParsedSharedMapLink["provider"] | null {
  const host = normalizeHost(hostname);
  if (host === "maps.apple.com") return "apple";
  if (
    host === "maps.google.com" ||
    host === "google.com" ||
    host === "www.google.com" ||
    host === "maps.app.goo.gl"
  ) {
    return "google";
  }
  return null;
}

function trimTrailingUrlPunctuation(url: string): string {
  let trimmed = url.trim();
  while (/[.,!?;:)\]}]$/.test(trimmed)) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed;
}

function parseCoordinatePrefix(value: string): { lat: number; lon: number } | null {
  const match = value.match(COORD_PREFIX_RE);
  if (!match) return null;

  const [, latRaw = "", lonRaw = ""] = match;
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return { lat, lon };
}

function sanitizeCoordinates(coords: { lat: number; lon: number }): { lat: number; lon: number } {
  return {
    lat: sanitizeLatitude(coords.lat),
    lon: normalizeLongitude(coords.lon),
  };
}

function canUseGoogleMapsPathPattern(url: URL): boolean {
  const host = normalizeHost(url.hostname);
  if (host === "maps.google.com" || isGoogleShortHost(host)) return true;
  if (host === "google.com" || host === "www.google.com") {
    const path = url.pathname.toLowerCase();
    return path === "/maps" || path.startsWith("/maps/");
  }
  return false;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;

  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("expand-short-url-timeout"));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error: unknown) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function parseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function parseSharedMapLinkFromUrl(url: URL, rawUrl: string): ParsedSharedMapLink | null {
  if (!isSupportedMapHost(url)) return null;

  const coords = parseSharedMapCoordinates(url);
  if (!coords) return null;

  const provider = providerFromHost(url.hostname);
  if (!provider) return null;

  return {
    provider,
    lat: coords.lat,
    lon: coords.lon,
    rawUrl,
  };
}

export function extractFirstUrl(input: string): string | null {
  const text = input.trim();
  if (!text) return null;

  const matchedUrl = text.match(URL_IN_TEXT_RE)?.[0];
  if (matchedUrl) {
    return trimTrailingUrlPunctuation(matchedUrl);
  }

  return null;
}

export function isSupportedMapHost(url: URL): boolean {
  const host = normalizeHost(url.hostname);
  if (host === "maps.apple.com" || host === "maps.google.com" || host === "maps.app.goo.gl") {
    return true;
  }
  if (host === "google.com" || host === "www.google.com") {
    const path = url.pathname.toLowerCase();
    return path === "/maps" || path.startsWith("/maps/");
  }
  return false;
}

export function parseSharedMapCoordinates(url: URL): { lat: number; lon: number } | null {
  if (!isSupportedMapHost(url)) return null;

  for (const key of SUPPORTED_COORD_QUERY_KEYS) {
    const rawValues = url.searchParams.getAll(key);
    for (const rawValue of rawValues) {
      const parsed = parseCoordinatePrefix(rawValue);
      if (!parsed) continue;
      return sanitizeCoordinates(parsed);
    }
  }

  if (!canUseGoogleMapsPathPattern(url)) return null;
  const pathMatch = url.pathname.match(GOOGLE_PATH_COORD_RE);
  if (!pathMatch) return null;

  const [, latRaw = "", lonRaw = ""] = pathMatch;
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return sanitizeCoordinates({ lat, lon });
}

export async function expandShortMapUrl(
  url: string,
  options: ExpandShortMapUrlOptions = {},
): Promise<string> {
  const parsed = parseUrl(url);
  if (!parsed || !isGoogleShortHost(parsed.hostname)) return url;

  const fetchImpl =
    options.fetchImpl ??
    (typeof fetch === "function" ? (fetch as unknown as FetchLike) : undefined);
  if (!fetchImpl) return url;

  const timeoutMs =
    typeof options.timeoutMs === "number" && Number.isFinite(options.timeoutMs)
      ? Math.max(1, Math.floor(options.timeoutMs))
      : DEFAULT_EXPAND_TIMEOUT_MS;

  try {
    const response = await withTimeout(
      fetchImpl(parsed.toString(), {
        method: "GET",
        redirect: "follow",
      }),
      timeoutMs,
    );
    if (typeof response.url === "string" && response.url.trim()) {
      return response.url;
    }
  } catch {
    // Fall back to the original short URL on timeout/fetch failure.
  }

  return url;
}

export function parseSharedMapLink(input: string): ParsedSharedMapLink | null {
  const extracted = extractFirstUrl(input);
  if (!extracted) return null;

  const url = parseUrl(extracted);
  if (!url) return null;
  return parseSharedMapLinkFromUrl(url, extracted);
}

export async function parseSharedMapLinkAsync(
  input: string,
  options: ParseSharedMapLinkAsyncOptions = {},
): Promise<ParsedSharedMapLink | null> {
  const extracted = extractFirstUrl(input);
  if (!extracted) return null;

  const url = parseUrl(extracted);
  if (!url || !isSupportedMapHost(url)) return null;

  const directParsed = parseSharedMapLinkFromUrl(url, extracted);
  if (directParsed) return directParsed;

  if (!isGoogleShortHost(url.hostname)) return null;

  const expanded = await expandShortMapUrl(extracted, options);
  if (expanded === extracted) return null;

  const expandedUrl = parseUrl(expanded);
  if (!expandedUrl) return null;

  return parseSharedMapLinkFromUrl(expandedUrl, extracted);
}
