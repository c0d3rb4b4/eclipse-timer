import { describe, expect, it } from "vitest";

import { resolveAppTheme } from "../src/theme/resolveAppTheme";

describe("theme resolution", () => {
  it("uses explicit light/dark preferences", () => {
    expect(resolveAppTheme("light", "dark")).toBe("light");
    expect(resolveAppTheme("dark", "light")).toBe("dark");
  });

  it("uses system preference when app preference is system", () => {
    expect(resolveAppTheme("system", "light")).toBe("light");
    expect(resolveAppTheme("system", "dark")).toBe("dark");
    expect(resolveAppTheme("system", null)).toBe("dark");
  });
});
