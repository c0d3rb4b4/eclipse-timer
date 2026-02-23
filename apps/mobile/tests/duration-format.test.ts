import { describe, expect, it } from "vitest";

import { formatTimerDuration } from "../src/utils/duration";

describe("timer duration formatting", () => {
  it("returns fallback for invalid durations", () => {
    expect(formatTimerDuration(undefined)).toBe("--");
    expect(formatTimerDuration(0)).toBe("--");
    expect(formatTimerDuration(Number.NaN)).toBe("--");
  });

  it("uses minutes and seconds when total minutes are 60 or less", () => {
    expect(formatTimerDuration(3599)).toBe("59m 59s");
    expect(formatTimerDuration(3600)).toBe("60m 00s");
  });

  it("uses hh:mm:ss when total minutes are greater than 60", () => {
    expect(formatTimerDuration(3661)).toBe("01:01:01");
    expect(formatTimerDuration(7325)).toBe("02:02:05");
  });
});
