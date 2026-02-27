import { describe, expect, it, vi } from "vitest";

import {
  expandShortMapUrl,
  extractFirstUrl,
  isSupportedMapHost,
  parseSharedMapCoordinates,
  parseSharedMapLink,
  parseSharedMapLinkAsync,
} from "../src/utils/sharedMapLink";

describe("shared map link parser", () => {
  describe("extractFirstUrl", () => {
    it("extracts the first http(s) url from share text", () => {
      const extracted = extractFirstUrl(
        "Check this spot: https://maps.apple.com/?ll=37.334,-122.009 and tell me what you think.",
      );

      expect(extracted).toBe("https://maps.apple.com/?ll=37.334,-122.009");
    });

    it("trims trailing punctuation from extracted urls", () => {
      const extracted = extractFirstUrl("https://maps.google.com/?q=37.334,-122.009.");
      expect(extracted).toBe("https://maps.google.com/?q=37.334,-122.009");
    });

    it("returns null when no url is present", () => {
      expect(extractFirstUrl("Pinned at Apple Park")).toBeNull();
    });
  });

  describe("isSupportedMapHost", () => {
    it("accepts allowed apple/google hosts", () => {
      expect(isSupportedMapHost(new URL("https://maps.apple.com/?ll=1,2"))).toBe(true);
      expect(isSupportedMapHost(new URL("https://maps.google.com/?q=1,2"))).toBe(true);
      expect(isSupportedMapHost(new URL("https://maps.app.goo.gl/abc"))).toBe(true);
    });

    it("accepts google.com only for /maps paths", () => {
      expect(isSupportedMapHost(new URL("https://www.google.com/maps?q=1,2"))).toBe(true);
      expect(isSupportedMapHost(new URL("https://google.com/maps/place/@1,2,12z"))).toBe(true);
      expect(isSupportedMapHost(new URL("https://www.google.com/search?q=1,2"))).toBe(false);
    });

    it("rejects non-allowlisted hosts", () => {
      expect(isSupportedMapHost(new URL("https://example.com/?q=1,2"))).toBe(false);
    });
  });

  describe("parseSharedMapCoordinates", () => {
    it.each([
      "ll",
      "q",
      "query",
      "center",
      "destination",
    ] as const)("parses coordinates from %s query parameter", (param) => {
      const parsed = parseSharedMapCoordinates(
        new URL(`https://maps.google.com/?${param}=37.3349,-122.0090`),
      );

      expect(parsed).toEqual({ lat: 37.3349, lon: -122.009 });
    });

    it("parses google @lat,lon path token", () => {
      const parsed = parseSharedMapCoordinates(
        new URL("https://www.google.com/maps/place/Apple+Park/@37.3349,-122.0090,15z"),
      );

      expect(parsed).toEqual({ lat: 37.3349, lon: -122.009 });
    });

    it("prefers supported query params before path token", () => {
      const parsed = parseSharedMapCoordinates(
        new URL("https://maps.google.com/maps/place/@37.0,-120.0,12z?q=40.1,-70.2"),
      );

      expect(parsed).toEqual({ lat: 40.1, lon: -70.2 });
    });

    it("normalizes latitude and longitude with map helpers", () => {
      const parsed = parseSharedMapCoordinates(new URL("https://maps.apple.com/?ll=91,190"));

      expect(parsed).toEqual({ lat: 85, lon: -170 });
    });

    it("returns null for malformed coordinate values", () => {
      expect(
        parseSharedMapCoordinates(new URL("https://maps.apple.com/?ll=not-a-coordinate")),
      ).toBe(null);
      expect(parseSharedMapCoordinates(new URL("https://maps.google.com/?q=37.334"))).toBe(null);
    });

    it("returns null for unsupported hosts", () => {
      expect(parseSharedMapCoordinates(new URL("https://example.com/?q=37.334,-122.009"))).toBe(
        null,
      );
    });
  });

  describe("parseSharedMapLink", () => {
    it("parses a shared apple maps link", () => {
      const parsed = parseSharedMapLink("https://maps.apple.com/?ll=37.3349,-122.0090");

      expect(parsed).toEqual({
        provider: "apple",
        lat: 37.3349,
        lon: -122.009,
        rawUrl: "https://maps.apple.com/?ll=37.3349,-122.0090",
      });
    });

    it("parses a google maps link embedded in share text", () => {
      const parsed = parseSharedMapLink(
        "Shared from Google Maps: https://www.google.com/maps/place/Apple+Park/@37.3349,-122.0090,15z",
      );

      expect(parsed).toEqual({
        provider: "google",
        lat: 37.3349,
        lon: -122.009,
        rawUrl: "https://www.google.com/maps/place/Apple+Park/@37.3349,-122.0090,15z",
      });
    });

    it("returns null for invalid host or payload", () => {
      expect(parseSharedMapLink("https://example.com/?ll=37.334,-122.009")).toBeNull();
      expect(parseSharedMapLink("https://maps.apple.com/?q=Coffee+shop")).toBeNull();
      expect(parseSharedMapLink("No links here")).toBeNull();
    });
  });

  describe("expandShortMapUrl", () => {
    it("returns the original url when host is not a short map host", async () => {
      const fetchImpl = vi.fn(async () => ({ url: "https://maps.google.com/?q=1,2" }));
      const expanded = await expandShortMapUrl("https://maps.google.com/?q=1,2", { fetchImpl });

      expect(expanded).toBe("https://maps.google.com/?q=1,2");
      expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("resolves maps.app.goo.gl redirect destination using fetch response url", async () => {
      const fetchImpl = vi.fn(async () => ({
        url: "https://www.google.com/maps/place/Apple+Park/@37.3349,-122.0090,15z",
      }));

      const expanded = await expandShortMapUrl("https://maps.app.goo.gl/abc123", { fetchImpl });
      expect(expanded).toBe("https://www.google.com/maps/place/Apple+Park/@37.3349,-122.0090,15z");
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    });
  });

  describe("parseSharedMapLinkAsync", () => {
    it("parses short links after redirect expansion", async () => {
      const fetchImpl = vi.fn(async () => ({
        url: "https://maps.google.com/?q=37.3349,-122.0090",
      }));

      const parsed = await parseSharedMapLinkAsync("https://maps.app.goo.gl/abc123", { fetchImpl });

      expect(parsed).toEqual({
        provider: "google",
        lat: 37.3349,
        lon: -122.009,
        rawUrl: "https://maps.app.goo.gl/abc123",
      });
    });

    it("parses short links from google preview payload coordinates when url has no coord params", async () => {
      const fetchImpl = vi.fn(async () => ({
        url: "https://www.google.com/maps/place/Somewhere",
        text: async () =>
          '<a href="/maps/preview/place?pb=%211m3%212d-1.55405635%213d52.276200949999996">Preview</a>',
      }));

      const parsed = await parseSharedMapLinkAsync("https://maps.app.goo.gl/RhH3TWEtdqJqRWpw6", {
        fetchImpl,
      });

      expect(parsed).toEqual({
        provider: "google",
        lat: 52.276200949999996,
        lon: -1.55405635,
        rawUrl: "https://maps.app.goo.gl/RhH3TWEtdqJqRWpw6",
      });
    });

    it("parses short links from google state payload coordinates when preview token is absent", async () => {
      const fetchImpl = vi.fn(async () => ({
        url: "https://www.google.com/maps/place/Somewhere",
        text: async () =>
          '...,"uk",[[19529.54214059542,-1.55405635,52.276200949999996],[0,0,0],[1024,768],13.1],"token"...',
      }));

      const parsed = await parseSharedMapLinkAsync("https://maps.app.goo.gl/abc123", { fetchImpl });

      expect(parsed).toEqual({
        provider: "google",
        lat: 52.276200949999996,
        lon: -1.55405635,
        rawUrl: "https://maps.app.goo.gl/abc123",
      });
    });

    it("re-fetches expanded url page when short-link response body is unavailable", async () => {
      const fetchImpl = vi.fn(async (input: string) => {
        if (input === "https://maps.app.goo.gl/abc123") {
          return {
            url: "https://www.google.com/maps/place/Somewhere",
          };
        }

        if (input === "https://www.google.com/maps/place/Somewhere") {
          return {
            url: input,
            text: async () =>
              '<a href="/maps/preview/place?pb=%211m3%212d-1.55405635%213d52.276200949999996">Preview</a>',
          };
        }

        return { url: input };
      });

      const parsed = await parseSharedMapLinkAsync("https://maps.app.goo.gl/abc123", { fetchImpl });

      expect(parsed).toEqual({
        provider: "google",
        lat: 52.276200949999996,
        lon: -1.55405635,
        rawUrl: "https://maps.app.goo.gl/abc123",
      });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it("returns null when expansion cannot produce parseable map coordinates", async () => {
      const fetchImpl = vi.fn(async () => ({
        url: "https://www.google.com/maps/place/Somewhere",
      }));

      const parsed = await parseSharedMapLinkAsync("https://maps.app.goo.gl/abc123", { fetchImpl });
      expect(parsed).toBeNull();
    });
  });
});
