import { describe, expect, it } from "vitest";

import { envFlagEnabled } from "../src/utils/env";

describe("envFlagEnabled", () => {
  it("returns true for true-like values", () => {
    expect(envFlagEnabled("true")).toBe(true);
    expect(envFlagEnabled("1")).toBe(true);
    expect(envFlagEnabled("yes")).toBe(true);
  });

  it("returns false for false-like values", () => {
    expect(envFlagEnabled(undefined)).toBe(false);
    expect(envFlagEnabled("false")).toBe(false);
    expect(envFlagEnabled("0")).toBe(false);
  });
});
