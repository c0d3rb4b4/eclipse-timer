import { describe, expect, it } from "vitest";
import { buildReminderScheduleRequests } from "../src/services/reminderSchedule";

const baseSettings = {
  vibrationEnabled: true,
  soundEnabled: true,
  remindOneHourBefore: true,
  remindTenMinutesBefore: true,
};

describe("eclipse reminder scheduling", () => {
  it("builds fixed -1h and -10m reminders from first-event anchors", () => {
    const nowMs = Date.parse("2030-01-02T10:00:00.000Z");
    const firstEventIso = "2030-01-02T11:10:00.000Z";

    const result = buildReminderScheduleRequests(
      baseSettings,
      [
        {
          id: "2030-01-02T",
          eclipseId: "2030-01-02T",
          eclipseDateYmd: "2030-01-02",
          eclipseLabel: "2030-01-02T",
          firstEventIso,
        },
      ],
      nowMs,
    );

    expect(result.skippedPastCount).toBe(0);
    expect(result.requests).toHaveLength(2);
    expect(result.requests.map((request) => request.leadMinutes).sort((a, b) => a - b)).toEqual([
      10, 60,
    ]);
    expect(result.requests.map((request) => request.fireDate.toISOString())).toEqual([
      "2030-01-02T10:10:00.000Z",
      "2030-01-02T11:00:00.000Z",
    ]);
  });

  it("skips past reminders and dedupes entries by id", () => {
    const nowMs = Date.parse("2030-01-02T10:00:00.000Z");

    const result = buildReminderScheduleRequests(
      {
        ...baseSettings,
        remindOneHourBefore: false,
        remindTenMinutesBefore: true,
      },
      [
        {
          id: "2030-01-02T",
          eclipseId: "2030-01-02T",
          eclipseDateYmd: "2030-01-02",
          eclipseLabel: "2030-01-02T",
          firstEventIso: "2030-01-02T10:08:00.000Z",
        },
        {
          id: "2030-01-02T",
          eclipseId: "2030-01-02T",
          eclipseDateYmd: "2030-01-02",
          eclipseLabel: "2030-01-02T",
          firstEventIso: "2030-01-02T10:08:00.000Z",
        },
      ],
      nowMs,
    );

    expect(result.requests).toHaveLength(0);
    expect(result.skippedPastCount).toBe(1);
  });
});
