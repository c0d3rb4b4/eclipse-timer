import { normalizeLongitude, sanitizeLatitude } from "./map";

export type ParsedSharedMapLink = {
  provider: "google" | "apple";
  lat: number;
  lon: number;
  rawUrl: string;
};

type FetchResponseLike = {
  url?: string;
  text?: () => Promise<string>;
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
const GOOGLE_PB_COORD_RE = new RegExp(
  `(?:%21|!)2d(${NUMBER_PART})(?:%21|!)3d(${NUMBER_PART})`,
  "i",
);
const GOOGLE_STATE_COORD_RE = new RegExp(
  `\\[\\[(${NUMBER_PART})\\s*,\\s*(${NUMBER_PART})\\s*,\\s*(${NUMBER_PART})\\]\\s*,\\s*\\[0\\s*,\\s*0\\s*,\\s*0\\]\\s*,\\s*\\[\\d+\\s*,\\s*\\d+\\]\\s*,\\s*(${NUMBER_PART})\\]`,
  "i",
);
const GOOGLE_STATE_COORD_FALLBACK_RE = new RegExp(
  `\\[\\[\\s*(${NUMBER_PART})\\s*,\\s*(${NUMBER_PART})\\s*,\\s*(${NUMBER_PART})\\s*\\]\\s*,\\s*\\[[^\\]]{1,80}\\]\\s*,\\s*\\[[^\\]]{1,80}\\]\\s*,\\s*(${NUMBER_PART})\\s*\\]`,
  "i",
);
const GOOGLE_STATICMAP_CENTER_RE = new RegExp(
  `center=(${NUMBER_PART})(?:%2c|%2C|,)(${NUMBER_PART})`,
  "i",
);

type ExpandedShortMapUrlResult = {
  expandedUrl: string;
  responseText: string | null;
};

function normalizeHost(hostname: string): string {
  return hostname.trim().replace(/\.+$/, "").toLowerCase();
}

function isGoogleShortHost(hostname: string): boolean {
  return normalizeHost(hostname) === "maps.app.goo.gl";
}

function isGoogleConsentHost(hostname: string): boolean {
  return normalizeHost(hostname) === "consent.google.com";
}

function extractPlaceIdFromDataParam(dataParam: string): string | null {
  // Extract place ID from Google Maps data parameter
  // Format: data=!4m2!3m1!1s<PLACE_ID>!...
  const match = dataParam.match(/!1s([0-9a-fx:]+)/i);
  return match?.[1] ?? null;
}

function simplifyGoogleMapsUrl(mapsUrl: string): string | null {
  try {
    const parsed = new URL(mapsUrl);
    if (!parsed.hostname.includes("google.com")) return null;

    // Try to extract place ID from data parameter
    const dataParam = parsed.pathname.match(/\/data=([^/]+)/)?.[1];
    if (dataParam) {
      const placeId = extractPlaceIdFromDataParam(decodeURIComponent(dataParam));
      if (placeId) {
        // Construct minimal URL with just place ID
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeId)}&query_place_id=${encodeURIComponent(placeId)}`;
      }
    }

    // Fallback: strip query params and keep just the path
    return `https://www.google.com${parsed.pathname}`;
  } catch {
    return null;
  }
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

function parseGooglePreviewCoordinatesFromText(input: string): { lat: number; lon: number } | null {
  if (!input) return null;

  const match =
    input.match(GOOGLE_PB_COORD_RE) ??
    (() => {
      try {
        return decodeURIComponent(input).match(GOOGLE_PB_COORD_RE);
      } catch {
        return null;
      }
    })();
  if (!match) return null;

  const [, lonRaw = "", latRaw = ""] = match;
  const lon = Number(lonRaw);
  const lat = Number(latRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return sanitizeCoordinates({ lat, lon });
}

function parseGoogleStateCoordinatesFromText(input: string): { lat: number; lon: number } | null {
  if (!input) return null;

  const match = input.match(GOOGLE_STATE_COORD_RE) ?? input.match(GOOGLE_STATE_COORD_FALLBACK_RE);
  if (!match) return null;

  const [, _distanceRaw = "", lonRaw = "", latRaw = "", _zoomRaw = ""] = match;
  const lon = Number(lonRaw);
  const lat = Number(latRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  return sanitizeCoordinates({ lat, lon });
}

function parseGoogleStaticMapCenterFromText(input: string): { lat: number; lon: number } | null {
  if (!input) return null;

  const match = input.match(GOOGLE_STATICMAP_CENTER_RE);
  if (!match) return null;

  const [, latRaw = "", lonRaw = ""] = match;
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  return sanitizeCoordinates({ lat, lon });
}

function parseGoogleCoordinatesFromText(input: string): { lat: number; lon: number } | null {
  return (
    parseGooglePreviewCoordinatesFromText(input) ??
    parseGoogleStateCoordinatesFromText(input) ??
    parseGoogleStaticMapCenterFromText(input)
  );
}

async function expandShortMapUrlWithResponse(
  url: string,
  options: ExpandShortMapUrlOptions = {},
  readResponseText = true,
): Promise<ExpandedShortMapUrlResult> {
  const parsed = parseUrl(url);
  if (!parsed || !isGoogleShortHost(parsed.hostname)) {
    console.info("[share.debug] expand_not_short", url);
    return { expandedUrl: url, responseText: null };
  }

  const fetchImpl =
    options.fetchImpl ??
    (typeof fetch === "function" ? (fetch as unknown as FetchLike) : undefined);
  if (!fetchImpl) {
    console.info("[share.debug] expand_no_fetch");
    return { expandedUrl: url, responseText: null };
  }

  const timeoutMs =
    typeof options.timeoutMs === "number" && Number.isFinite(options.timeoutMs)
      ? Math.max(1, Math.floor(options.timeoutMs))
      : DEFAULT_EXPAND_TIMEOUT_MS;

  console.info("[share.debug] expand_fetching", { url, timeoutMs });

  try {
    const response = await withTimeout(
      fetchImpl(parsed.toString(), {
        method: "GET",
        redirect: "follow",
      }),
      timeoutMs,
    );

    console.info("[share.debug] expand_response", {
      expandedUrl: response.url,
      hasText: typeof response.text === "function",
    });

    let responseText: string | null = null;
    if (readResponseText && typeof response.text === "function") {
      try {
        responseText = await withTimeout(Promise.resolve(response.text()), timeoutMs);
        console.info("[share.debug] expand_text_length", responseText?.length ?? 0);
      } catch (err) {
        console.info("[share.debug] expand_text_error", err);
        responseText = null;
      }
    }

    if (typeof response.url === "string" && response.url.trim()) {
      return {
        expandedUrl: response.url,
        responseText,
      };
    }

    return {
      expandedUrl: url,
      responseText,
    };
  } catch (err) {
    // Fall back to the original short URL on timeout/fetch failure.
    console.info("[share.debug] expand_fetch_error", err);
    return { expandedUrl: url, responseText: null };
  }
}

async function fetchMapPageText(
  url: string,
  options: ExpandShortMapUrlOptions = {},
  maxConsentRedirects = 2,
): Promise<string | null> {
  const parsed = parseUrl(url);
  if (!parsed || !isSupportedMapHost(parsed)) return null;

  const fetchImpl =
    options.fetchImpl ??
    (typeof fetch === "function" ? (fetch as unknown as FetchLike) : undefined);
  if (!fetchImpl) return null;

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

    if (typeof response.text !== "function") return null;
    const responseText = await withTimeout(Promise.resolve(response.text()), timeoutMs);

    // Check if we got redirected to a consent page
    const responseUrl = typeof response.url === "string" ? parseUrl(response.url) : null;
    if (responseUrl && isGoogleConsentHost(responseUrl.hostname)) {
      console.info("[share.debug] fetch_hit_consent_page", { url, responseUrl: response.url });

      if (maxConsentRedirects > 0) {
        // Extract the real Maps URL from the consent page
        const extractedUrl =
          typeof response.url === "string" ? extractUrlFromGoogleConsent(response.url) : null;
        if (extractedUrl) {
          console.info("[share.debug] fetch_extracted_from_consent", extractedUrl);
          // Recursively fetch the extracted URL, but limit redirects to prevent infinite loops
          return await fetchMapPageText(extractedUrl, options, maxConsentRedirects - 1);
        }
      } else {
        // Out of retries, try one last thing: simplify the URL
        console.info("[share.debug] fetch_consent_retries_exhausted_trying_simplified");
        const simplifiedUrl = simplifyGoogleMapsUrl(url);
        if (simplifiedUrl && simplifiedUrl !== url) {
          console.info("[share.debug] fetch_trying_simplified_url", simplifiedUrl);
          try {
            const simpleResponse = await withTimeout(
              fetchImpl(simplifiedUrl, {
                method: "GET",
                redirect: "follow",
              }),
              timeoutMs,
            );
            if (typeof simpleResponse.text === "function") {
              const simpleText = await withTimeout(
                Promise.resolve(simpleResponse.text()),
                timeoutMs,
              );
              console.info("[share.debug] fetch_simplified_result_length", simpleText?.length ?? 0);
              // Check if we still hit consent
              const simpleUrl =
                typeof simpleResponse.url === "string" ? parseUrl(simpleResponse.url) : null;
              if (simpleUrl && !isGoogleConsentHost(simpleUrl.hostname)) {
                return simpleText;
              }
            }
          } catch (err) {
            console.info("[share.debug] fetch_simplified_failed", err);
          }
        }
      }
    }

    return responseText;
  } catch {
    return null;
  }
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

function extractUrlFromGoogleConsent(consentUrl: string): string | null {
  try {
    const parsed = new URL(consentUrl);
    if (!isGoogleConsentHost(parsed.hostname)) return null;

    const continueParam = parsed.searchParams.get("continue");
    if (!continueParam) return null;

    // Try to decode and validate the continue URL
    try {
      const decodedUrl = decodeURIComponent(continueParam);
      const continueUrlParsed = new URL(decodedUrl);
      if (isSupportedMapHost(continueUrlParsed)) {
        // Strip tracking parameters that might trigger consent loops
        const paramsToRemove = [
          "utm_source",
          "utm_medium",
          "utm_campaign",
          "entry",
          "coh",
          "g_ep",
          "skid",
        ];
        for (const param of paramsToRemove) {
          continueUrlParsed.searchParams.delete(param);
        }
        return continueUrlParsed.toString();
      }
    } catch {
      // If continue param isn't a valid URL, return null
    }

    return null;
  } catch {
    return null;
  }
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
  const result = await expandShortMapUrlWithResponse(url, options, false);
  return result.expandedUrl;
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

  console.info("[share.debug] parse_short_url", extracted);
  const { expandedUrl, responseText } = await expandShortMapUrlWithResponse(extracted, options);

  console.info("[share.debug] after_expand", {
    expandedUrl,
    urlChanged: expandedUrl !== extracted,
    responseLength: responseText?.length ?? 0,
  });

  if (expandedUrl !== extracted) {
    const expandedParsedUrl = parseUrl(expandedUrl);
    if (!expandedParsedUrl) {
      console.info("[share.debug] expanded_url_parse_failed", expandedUrl);
      return null;
    }

    // Check if we got redirected to a consent page
    if (isGoogleConsentHost(expandedParsedUrl.hostname)) {
      console.info("[share.debug] consent_page_detected");
      const actualMapsUrl = extractUrlFromGoogleConsent(expandedUrl);
      if (actualMapsUrl) {
        console.info("[share.debug] extracted_from_consent", actualMapsUrl);
        const actualParsedUrl = parseUrl(actualMapsUrl);
        if (actualParsedUrl) {
          const parsedFromConsent = parseSharedMapLinkFromUrl(actualParsedUrl, extracted);
          if (parsedFromConsent) {
            console.info("[share.debug] parsed_from_consent_url", parsedFromConsent);
            return parsedFromConsent;
          }

          // Couldn't parse directly, fetch the extracted Maps URL to get coordinates from HTML
          console.info("[share.debug] consent_url_no_direct_coords_fetching");
          const extractedMapsText = await fetchMapPageText(actualMapsUrl, options);
          console.info("[share.debug] extracted_maps_text_length", extractedMapsText?.length ?? 0);
          const parsedFromExtractedText = parseGoogleCoordinatesFromText(extractedMapsText ?? "");
          if (parsedFromExtractedText) {
            console.info("[share.debug] parsed_from_extracted_maps_html", parsedFromExtractedText);
            return {
              provider: "google",
              lat: parsedFromExtractedText.lat,
              lon: parsedFromExtractedText.lon,
              rawUrl: extracted,
            };
          }
        }
      }
    }

    const parsedExpandedLink = parseSharedMapLinkFromUrl(expandedParsedUrl, extracted);
    if (parsedExpandedLink) {
      console.info("[share.debug] parsed_from_expanded_url", parsedExpandedLink);
      return parsedExpandedLink;
    }
    console.info("[share.debug] expanded_url_no_coords", expandedUrl);
  }

  console.info("[share.debug] try_parse_from_response_text", responseText?.substring(0, 200));
  let parsedFromPreviewPayload = parseGoogleCoordinatesFromText(responseText ?? "");
  if (!parsedFromPreviewPayload) {
    console.info("[share.debug] response_text_parse_failed_try_refetch");
    const fallbackText = await fetchMapPageText(
      expandedUrl !== extracted ? expandedUrl : extracted,
      options,
    );
    console.info("[share.debug] refetch_text_length", fallbackText?.length ?? 0);
    parsedFromPreviewPayload = parseGoogleCoordinatesFromText(fallbackText ?? "");
  }

  if (!parsedFromPreviewPayload) {
    console.info("[share.debug] all_parsing_failed");
    return null;
  }

  console.info("[share.debug] parsed_from_text", parsedFromPreviewPayload);
  return {
    provider: "google",
    lat: parsedFromPreviewPayload.lat,
    lon: parsedFromPreviewPayload.lon,
    rawUrl: extracted,
  };
}
