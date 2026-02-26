import { describe, expect, it } from "vitest";

import { formatAddressLabel } from "../src/utils/address";

describe("formatAddressLabel", () => {
  it("prefers platform formatted address when available", () => {
    const label = formatAddressLabel({
      formattedAddress: "111 8th Avenue, New York, NY",
      city: "New York",
      region: "NY",
      country: "United States",
    });

    expect(label).toBe("111 8th Avenue, New York, NY");
  });

  it("builds a readable label from reverse-geocoded parts", () => {
    const label = formatAddressLabel({
      name: "Tower Bridge",
      city: "London",
      region: "England",
      country: "United Kingdom",
    });

    expect(label).toBe("Tower Bridge, London, England, United Kingdom");
  });

  it("dedupes repeated segments and handles street line fallback", () => {
    const label = formatAddressLabel({
      streetNumber: "1",
      street: "Infinite Loop",
      city: "Cupertino",
      subregion: "Cupertino",
      region: "CA",
      country: "United States",
    });

    expect(label).toBe("1 Infinite Loop, Cupertino, CA, United States");
  });

  it("returns null when no address fields are useful", () => {
    const label = formatAddressLabel({
      formattedAddress: "   ",
      city: null,
      region: null,
      country: null,
    });

    expect(label).toBeNull();
  });
});
