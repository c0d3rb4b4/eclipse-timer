import { describe, expect, it, vi } from "vitest";
import type { IncomingExternalLink, LinkingLike } from "../src/services/shareIntake";
import {
  normalizeSharePayloadToIncomingLinks,
  subscribeToLinkingExternalLinks,
  toIncomingExternalLink,
} from "../src/services/shareIntake";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("share intake", () => {
  describe("toIncomingExternalLink", () => {
    it("normalizes non-empty string values", () => {
      const normalized = toIncomingExternalLink("linking", "  https://maps.apple.com/?ll=1,2  ");
      expect(normalized).toEqual({
        source: "linking",
        value: "https://maps.apple.com/?ll=1,2",
      });
    });

    it("returns null for empty or non-string values", () => {
      expect(toIncomingExternalLink("share", "   ")).toBeNull();
      expect(toIncomingExternalLink("share", null)).toBeNull();
      expect(toIncomingExternalLink("share", 42)).toBeNull();
    });
  });

  describe("normalizeSharePayloadToIncomingLinks", () => {
    it("collects url/text/value fields and dedupes", () => {
      const links = normalizeSharePayloadToIncomingLinks({
        url: "https://maps.google.com/?q=1,2",
        text: "  https://maps.google.com/?q=1,2 ",
        value: "https://maps.apple.com/?ll=3,4",
      });

      expect(links).toEqual([
        { source: "share", value: "https://maps.google.com/?q=1,2" },
        { source: "share", value: "https://maps.apple.com/?ll=3,4" },
      ]);
    });

    it("includes webUrl from share-intent payloads", () => {
      const links = normalizeSharePayloadToIncomingLinks({
        text: "Shared from maps",
        webUrl: "https://www.google.com/maps/place/@37.3349,-122.0090,15z",
      });

      expect(links).toEqual([
        { source: "share", value: "https://www.google.com/maps/place/@37.3349,-122.0090,15z" },
        { source: "share", value: "Shared from maps" },
      ]);
    });

    it("supports raw string and array payloads", () => {
      expect(normalizeSharePayloadToIncomingLinks("https://maps.apple.com/?ll=1,2")).toEqual([
        { source: "share", value: "https://maps.apple.com/?ll=1,2" },
      ]);

      expect(
        normalizeSharePayloadToIncomingLinks([
          "https://maps.google.com/?q=1,2",
          "  ",
          "https://maps.apple.com/?ll=1,2",
        ]),
      ).toEqual([
        { source: "share", value: "https://maps.google.com/?q=1,2" },
        { source: "share", value: "https://maps.apple.com/?ll=1,2" },
      ]);
    });
  });

  describe("subscribeToLinkingExternalLinks", () => {
    it("emits initial URL and runtime URL events", async () => {
      const listeners: Array<(event: { url: string }) => void> = [];
      const linkingMock: LinkingLike = {
        addEventListener: (_eventType, listener) => {
          listeners.push(listener);
          return {
            remove: () => {
              const index = listeners.indexOf(listener);
              if (index >= 0) {
                listeners.splice(index, 1);
              }
            },
          };
        },
        getInitialURL: async () => "https://maps.apple.com/?ll=1,2",
      };

      const received: IncomingExternalLink[] = [];
      const unsubscribe = subscribeToLinkingExternalLinks(
        (link) => {
          received.push(link);
        },
        {
          linking: linkingMock,
        },
      );

      await Promise.resolve();
      listeners[0]?.({ url: "https://maps.google.com/?q=3,4" });

      expect(received).toEqual([
        { source: "linking", value: "https://maps.apple.com/?ll=1,2" },
        { source: "linking", value: "https://maps.google.com/?q=3,4" },
      ]);

      unsubscribe();
    });

    it("does not emit initial URL after unsubscription", async () => {
      const deferred = createDeferred<string | null>();
      const linkingMock: LinkingLike = {
        addEventListener: () => ({ remove: vi.fn() }),
        getInitialURL: () => deferred.promise,
      };

      const received: IncomingExternalLink[] = [];
      const unsubscribe = subscribeToLinkingExternalLinks(
        (link) => {
          received.push(link);
        },
        {
          linking: linkingMock,
        },
      );

      unsubscribe();
      deferred.resolve("https://maps.apple.com/?ll=1,2");
      await Promise.resolve();

      expect(received).toEqual([]);
    });
  });
});
