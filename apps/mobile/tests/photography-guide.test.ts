import { describe, expect, it } from "vitest";

import {
  buildLandscapeCompositeLayout,
  buildPhotographyGuideSchedule,
} from "../src/utils/photographyGuide";

function isoUtc(hour: number, minute: number) {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `2027-08-02T${hh}:${mm}:00.000Z`;
}

describe("photography guide schedule", () => {
  it("builds a 5-shot partial schedule with MAX centered", () => {
    const result = buildPhotographyGuideSchedule({
      visible: true,
      totalPictures: 5,
      kindAtLocation: "partial",
      c1Utc: isoUtc(10, 0),
      maxUtc: isoUtc(11, 0),
      c4Utc: isoUtc(12, 0),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.schedule.rows.map((row) => row.iso)).toEqual([
      isoUtc(10, 0),
      isoUtc(10, 30),
      isoUtc(11, 0),
      isoUtc(11, 30),
      isoUtc(12, 0),
    ]);
    expect(result.schedule.rows.map((row) => row.phaseBucket)).toEqual([
      "pre-MAX",
      "pre-MAX",
      "MAX",
      "post-MAX",
      "post-MAX",
    ]);
    expect(result.schedule.rows[2]?.index).toBe(3);
  });

  it("uses C1->C2 and C3->C4 distributions for total eclipses when available", () => {
    const result = buildPhotographyGuideSchedule({
      visible: true,
      totalPictures: 7,
      kindAtLocation: "total",
      c1Utc: isoUtc(10, 0),
      c2Utc: isoUtc(10, 30),
      maxUtc: isoUtc(11, 0),
      c3Utc: isoUtc(11, 30),
      c4Utc: isoUtc(12, 0),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.schedule.rows.map((row) => row.iso)).toEqual([
      isoUtc(10, 0),
      isoUtc(10, 10),
      isoUtc(10, 20),
      isoUtc(11, 0),
      isoUtc(11, 40),
      isoUtc(11, 50),
      isoUtc(12, 0),
    ]);
    expect(result.schedule.rows[3]?.phaseBucket).toBe("MAX");
  });

  it("falls back to partial-style intervals when totality contacts are missing", () => {
    const result = buildPhotographyGuideSchedule({
      visible: true,
      totalPictures: 5,
      kindAtLocation: "total",
      c1Utc: isoUtc(10, 0),
      maxUtc: isoUtc(11, 0),
      c4Utc: isoUtc(12, 0),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.schedule.rows).toHaveLength(5);
    expect(result.schedule.rows[2]?.phaseBucket).toBe("MAX");
  });

  it("builds a stable 3-shot schedule around MAX", () => {
    const result = buildPhotographyGuideSchedule({
      visible: true,
      totalPictures: 3,
      kindAtLocation: "partial",
      c1Utc: isoUtc(10, 0),
      maxUtc: isoUtc(11, 0),
      c4Utc: isoUtc(12, 0),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.schedule.rows.map((row) => row.iso)).toEqual([
      isoUtc(9, 0),
      isoUtc(11, 0),
      isoUtc(13, 0),
    ]);
    expect(result.schedule.rows[1]?.phaseBucket).toBe("MAX");
  });

  it("rejects schedule generation when outside eclipse visibility", () => {
    const result = buildPhotographyGuideSchedule({
      visible: false,
      totalPictures: 5,
      kindAtLocation: "none",
      c1Utc: isoUtc(10, 0),
      maxUtc: isoUtc(11, 0),
      c4Utc: isoUtc(12, 0),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.reason).toBe("Must be within eclipse area.");
  });

  it("anchors MAX at horizontal center and 2/3 vertical in landscape composite", () => {
    const scheduleResult = buildPhotographyGuideSchedule({
      visible: true,
      totalPictures: 5,
      kindAtLocation: "partial",
      c1Utc: isoUtc(10, 0),
      maxUtc: isoUtc(11, 0),
      c4Utc: isoUtc(12, 0),
    });
    expect(scheduleResult.ok).toBe(true);
    if (!scheduleResult.ok) return;

    const layout = buildLandscapeCompositeLayout({
      schedule: scheduleResult.schedule,
      kindAtLocation: "partial",
      maxUtc: isoUtc(11, 0),
      frameWidth: 360,
      frameHeight: 216,
      travelVector: { x: 1, y: 0 },
    });
    const maxPlacement = layout.placements.find((placement) => placement.phaseBucket === "MAX");

    expect(layout.anchorX).toBeCloseTo(180, 6);
    expect(layout.anchorY).toBeCloseTo(144, 6);
    expect(maxPlacement).toBeDefined();
    expect(maxPlacement?.x).toBeCloseTo(layout.anchorX, 6);
    expect(maxPlacement?.y).toBeCloseTo(layout.anchorY, 6);
    expect(maxPlacement?.clamped).toBe(false);
  });

  it("clamps out-of-frame composite shots and only draws moon during occlusion", () => {
    const scheduleResult = buildPhotographyGuideSchedule({
      visible: true,
      totalPictures: 3,
      kindAtLocation: "partial",
      c1Utc: isoUtc(8, 0),
      maxUtc: isoUtc(11, 0),
      c4Utc: isoUtc(14, 0),
    });
    expect(scheduleResult.ok).toBe(true);
    if (!scheduleResult.ok) return;

    const layout = buildLandscapeCompositeLayout({
      schedule: scheduleResult.schedule,
      kindAtLocation: "partial",
      maxUtc: isoUtc(11, 0),
      frameWidth: 260,
      frameHeight: 146,
      travelVector: { x: 1, y: 0 },
    });
    const firstShot = layout.placements[0];
    const maxShot = layout.placements[1];
    const lastShot = layout.placements[2];

    expect(firstShot?.clamped).toBe(true);
    expect(maxShot?.clamped).toBe(false);
    expect(lastShot?.clamped).toBe(true);
    expect(firstShot?.moon).toBeUndefined();
    expect(maxShot?.moon).toBeDefined();
    expect(lastShot?.moon).toBeUndefined();
  });
});
