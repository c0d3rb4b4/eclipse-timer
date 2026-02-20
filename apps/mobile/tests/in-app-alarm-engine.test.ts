import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInAppAlarmEngine } from "../src/services/inAppAlarmEngine";

describe("in-app alarm engine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-02T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("speaks at a1, countdown from a2, and final at event time", () => {
    const spoken: string[] = [];
    const engine = createInAppAlarmEngine({
      speak: (text) => spoken.push(text),
    });

    const eventMs = Date.now() + 15_000;
    engine.arm({
      enabled: true,
      alarmLeadSecondsA1: 10,
      alarmCountdownStartSecondsA2: 5,
      events: [
        {
          id: "2027-08-02T:c1",
          eclipseId: "2027-08-02T",
          contactKey: "c1",
          contactLabel: "C1",
          eventIso: new Date(eventMs).toISOString(),
          eventMs,
        },
      ],
    });

    expect(spoken).toEqual([]);

    vi.advanceTimersByTime(5_000);
    expect(spoken).toEqual(["10 seconds to C1"]);

    vi.advanceTimersByTime(5_000);
    expect(spoken).toEqual(["10 seconds to C1", "5"]);

    vi.advanceTimersByTime(1_000);
    expect(spoken).toEqual(["10 seconds to C1", "5", "4"]);

    vi.advanceTimersByTime(1_000);
    expect(spoken).toEqual(["10 seconds to C1", "5", "4", "3"]);

    vi.advanceTimersByTime(1_000);
    expect(spoken).toEqual(["10 seconds to C1", "5", "4", "3", "2"]);

    vi.advanceTimersByTime(1_000);
    expect(spoken).toEqual(["10 seconds to C1", "5", "4", "3", "2", "1"]);

    vi.advanceTimersByTime(1_000);
    expect(spoken).toEqual(["10 seconds to C1", "5", "4", "3", "2", "1", "We're at C1"]);
  });

  it("deduplicates already-spoken phases when re-armed with the same event", () => {
    const spoken: string[] = [];
    const engine = createInAppAlarmEngine({
      speak: (text) => spoken.push(text),
    });

    const eventMs = Date.now() + 8_000;
    const eventIso = new Date(eventMs).toISOString();
    const input = {
      enabled: true,
      alarmLeadSecondsA1: 7,
      alarmCountdownStartSecondsA2: 3,
      events: [
        {
          id: "2027-08-02T:max",
          eclipseId: "2027-08-02T",
          contactKey: "max",
          contactLabel: "MAX",
          eventIso,
          eventMs,
        },
      ],
    };

    engine.arm(input);
    vi.advanceTimersByTime(1_000);
    expect(spoken).toEqual(["7 seconds to MAX"]);

    engine.arm(input);
    vi.advanceTimersByTime(8_000);

    expect(spoken.filter((line) => line === "7 seconds to MAX")).toHaveLength(1);
    expect(spoken.filter((line) => line === "We're at MAX")).toHaveLength(1);
  });
});
