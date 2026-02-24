import { describe, expect, it } from "vitest";

import { envFlagEnabled, readSkipNotificationPermissionPromptFlag } from "../src/utils/env";

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

describe("readSkipNotificationPermissionPromptFlag", () => {
  it("reads EXPO_PUBLIC_SKIP_NOTIFICATION_PERMISSION_PROMPT", () => {
    const previous = process.env.EXPO_PUBLIC_SKIP_NOTIFICATION_PERMISSION_PROMPT;

    process.env.EXPO_PUBLIC_SKIP_NOTIFICATION_PERMISSION_PROMPT = "true";
    expect(readSkipNotificationPermissionPromptFlag()).toBe(true);

    process.env.EXPO_PUBLIC_SKIP_NOTIFICATION_PERMISSION_PROMPT = "false";
    expect(readSkipNotificationPermissionPromptFlag()).toBe(false);

    if (previous === undefined) {
      delete process.env.EXPO_PUBLIC_SKIP_NOTIFICATION_PERMISSION_PROMPT;
    } else {
      process.env.EXPO_PUBLIC_SKIP_NOTIFICATION_PERMISSION_PROMPT = previous;
    }
  });
});
