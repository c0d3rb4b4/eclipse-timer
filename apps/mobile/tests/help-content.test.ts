import { describe, expect, it } from "vitest";

import {
  HELP_DOC_LINKS,
  HELP_FAQ_ITEMS,
  HELP_TROUBLESHOOTING_ITEMS,
  isHttpsDocLink,
} from "../src/screens/helpContent";

describe("help content", () => {
  it("has concise faq and troubleshooting content", () => {
    expect(HELP_FAQ_ITEMS.length).toBeGreaterThanOrEqual(3);
    expect(HELP_TROUBLESHOOTING_ITEMS.length).toBeGreaterThanOrEqual(2);
  });

  it("uses valid https links for docs", () => {
    expect(HELP_DOC_LINKS.length).toBeGreaterThanOrEqual(3);
    for (const link of HELP_DOC_LINKS) {
      expect(isHttpsDocLink(link.url)).toBe(true);
    }
  });
});
