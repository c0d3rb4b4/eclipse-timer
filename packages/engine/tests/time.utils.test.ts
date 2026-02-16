import { describe, expect, it } from "vitest";
import type { EclipseRecord } from "@eclipse-timer/shared";
import { t0TtDate, ttAtTHours } from "../src/time/t0";
import { ttToUtcUsingDeltaT, toIsoUtc } from "../src/time/utc";

function makeRecord(overrides: Partial<EclipseRecord> = {}): EclipseRecord {
  return {
    id: "test-0001",
    dateYmd: "2024-04-08",
    kind: "total",
    t0TtHours: 10,
    deltaTSeconds: 69.5,
    tanF1: 0.0046,
    tanF2: 0.00458,
    x: [0],
    y: [0],
    d: [0],
    mu: [0],
    l1: [0],
    l2: [0],
    ...overrides
  };
}

describe("time utilities", () => {
  it("builds TT date from dateYmd and fractional t0 hour", () => {
    const e = makeRecord({ t0TtHours: 10.123456 });
    expect(t0TtDate(e).toISOString()).toBe("2024-04-08T10:07:24.442Z");
  });

  it("handles rounding overflow at day boundary", () => {
    const e = makeRecord({
      dateYmd: "2031-12-31",
      t0TtHours: 23 + 59 / 60 + 59.9996 / 3600
    });
    expect(t0TtDate(e).toISOString()).toBe("2032-01-01T00:00:00.000Z");
  });

  it("computes TT instants offset from t0 in both directions", () => {
    const e = makeRecord({ t0TtHours: 10.123456 });
    expect(ttAtTHours(e, 1.5).toISOString()).toBe("2024-04-08T11:37:24.442Z");
    expect(ttAtTHours(e, -2.75).toISOString()).toBe("2024-04-08T07:22:24.442Z");
  });

  it("converts TT to UTC using positive and negative deltaT", () => {
    const pos = makeRecord({ t0TtHours: 10.123456, deltaTSeconds: 69.5 });
    const posT0 = t0TtDate(pos);
    expect(ttToUtcUsingDeltaT(posT0, pos).toISOString()).toBe("2024-04-08T10:06:14.942Z");

    const neg = makeRecord({
      dateYmd: "2031-12-31",
      t0TtHours: 23 + 59 / 60 + 59.9996 / 3600,
      deltaTSeconds: -2.2
    });
    const negT0 = t0TtDate(neg);
    expect(ttToUtcUsingDeltaT(negT0, neg).toISOString()).toBe("2032-01-01T00:00:02.200Z");
  });

  it("serializes UTC dates as ISO strings", () => {
    const d = new Date("2030-01-02T03:04:05.678Z");
    expect(toIsoUtc(d)).toBe("2030-01-02T03:04:05.678Z");
  });

  it("returns an invalid date for malformed dateYmd input", () => {
    const e = makeRecord({ dateYmd: "not-a-date" });
    const d = t0TtDate(e);
    expect(Number.isNaN(d.getTime())).toBe(true);
  });
});
