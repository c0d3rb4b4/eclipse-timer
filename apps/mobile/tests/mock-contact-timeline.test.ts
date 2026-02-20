import { describe, expect, it } from "vitest";
import {
  applyMockContactTimeline,
  type ContactItem,
  nextEventCountdownFromItems,
} from "../src/utils/contacts";

describe("mock contact timeline", () => {
  it("applies C1 offset and per-contact gaps from an anchor time", () => {
    const anchorMs = Date.parse("2030-01-02T10:00:00.000Z");
    const items: ContactItem[] = [
      { key: "c1", label: "C1", iso: "2030-01-02T12:00:00.000Z" },
      { key: "c2", label: "C2", iso: "2030-01-02T12:01:00.000Z" },
      { key: "max", label: "MAX", iso: "2030-01-02T12:02:00.000Z" },
      { key: "c3", label: "C3" },
      { key: "c4", label: "C4", iso: "2030-01-02T12:04:00.000Z" },
    ];

    const mocked = applyMockContactTimeline(
      items,
      {
        enabled: true,
        firstContactOffsetMinutes: 5,
        subsequentContactGapMinutes: 1,
      },
      anchorMs,
    );

    expect(mocked[0]?.iso).toBe("2030-01-02T10:05:00.000Z");
    expect(mocked[1]?.iso).toBe("2030-01-02T10:06:00.000Z");
    expect(mocked[2]?.iso).toBe("2030-01-02T10:07:00.000Z");
    expect(mocked[3]?.iso).toBeUndefined();
    expect(mocked[4]?.iso).toBe("2030-01-02T10:08:00.000Z");
  });

  it("uses mocked contacts for next-event countdown", () => {
    const items: ContactItem[] = [
      { key: "c1", label: "C1", iso: "2030-01-02T10:05:00.000Z" },
      { key: "c2", label: "C2", iso: "2030-01-02T10:06:00.000Z" },
      { key: "max", label: "MAX", iso: "2030-01-02T10:07:00.000Z" },
    ];

    const nowMs = Date.parse("2030-01-02T10:05:30.000Z");
    expect(nextEventCountdownFromItems(items, nowMs)).toBe("C2 in 0d 0h 0m 30s");
  });
});
