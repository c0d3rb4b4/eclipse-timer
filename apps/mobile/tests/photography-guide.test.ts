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

  it("anchors MAX at frame center in landscape composite", () => {
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
    expect(layout.anchorY).toBeCloseTo(108, 6);
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

  it("uses observer solar/lunar geometry so Gibraltar 2027 shots stay above horizon and small at 24mm", () => {
    const rowsIsoLocal = [
      "2027-08-02T08:39:01+01:00",
      "2027-08-02T09:13:30+01:00",
      "2027-08-02T09:48:00+01:00",
      "2027-08-02T10:25:55+01:00",
      "2027-08-02T11:03:51+01:00",
    ] as const;
    const rowUtcMs = rowsIsoLocal.map((iso) => Date.parse(iso));
    const startMs = rowUtcMs[0];
    const endMs = rowUtcMs[rowUtcMs.length - 1];
    expect(typeof startMs).toBe("number");
    expect(typeof endMs).toBe("number");
    if (typeof startMs !== "number" || typeof endMs !== "number") return;

    const schedule = {
      rows: rowUtcMs.map((utcMs, index) => {
        const progress = (utcMs - startMs) / (endMs - startMs);
        return {
          index: index + 1,
          iso: new Date(utcMs).toISOString(),
          utcMs,
          phaseBucket:
            index < 2
              ? ("pre-MAX" as const)
              : index === 2
                ? ("MAX" as const)
                : ("post-MAX" as const),
          progress,
          showMoon: true,
        };
      }),
      contacts: {
        c1: 0,
        c2: 0.25,
        max: 0.5,
        c3: 0.75,
        c4: 1,
      },
      startMs,
      endMs,
    };

    const layout = buildLandscapeCompositeLayout({
      schedule,
      kindAtLocation: "total",
      maxUtc: "2027-08-02T09:48:00+01:00",
      frameWidth: 360,
      frameHeight: 216,
      observer: {
        latDeg: 36.13173,
        lonDeg: -5.34095,
      },
      travelVector: { x: 1, y: 0 },
    });

    expect(layout.anchorX).toBeCloseTo(180, 6);
    expect(layout.anchorY).toBeCloseTo(108, 6);
    expect(layout.horizonY).toBeCloseTo(216, 1);

    const ys = layout.placements.map((placement) => placement.y);
    const xs = layout.placements.map((placement) => placement.x);
    for (let index = 1; index < ys.length; index += 1) {
      expect(ys[index]).toBeLessThan(ys[index - 1] ?? Number.POSITIVE_INFINITY);
      expect(xs[index]).toBeGreaterThan(xs[index - 1] ?? Number.NEGATIVE_INFINITY);
    }

    for (const placement of layout.placements) {
      expect(placement.clamped).toBe(false);
      expect(placement.sunRadius).toBeLessThan(4);
      expect(placement.sunRadius).toBeGreaterThan(1);
      expect(placement.y + placement.sunRadius).toBeLessThanOrEqual(layout.horizonY);
      expect(placement.showMoon).toBe(true);
      expect(placement.moon).toBeDefined();
      if (!placement.moon) continue;
      const centerDistance = Math.hypot(
        placement.moon.x - placement.x,
        placement.moon.y - placement.y,
      );
      expect(centerDistance).toBeLessThan(placement.sunRadius * 2.5);
    }
  });

  it("flags above/below horizon and exposes azimuth/altitude in observer-aware layouts", () => {
    const scheduleResult = buildPhotographyGuideSchedule({
      visible: true,
      totalPictures: 5,
      kindAtLocation: "partial",
      c1Utc: "2027-08-02T01:00:00.000Z",
      maxUtc: "2027-08-02T02:00:00.000Z",
      c4Utc: "2027-08-02T03:00:00.000Z",
    });
    expect(scheduleResult.ok).toBe(true);
    if (!scheduleResult.ok) return;

    const layout = buildLandscapeCompositeLayout({
      schedule: scheduleResult.schedule,
      kindAtLocation: "partial",
      maxUtc: "2027-08-02T02:00:00.000Z",
      frameWidth: 360,
      frameHeight: 216,
      observer: {
        latDeg: 36.13173,
        lonDeg: -5.34095,
      },
      travelVector: { x: 1, y: 0 },
    });

    expect(layout.placements.some((placement) => placement.isAboveHorizon)).toBe(false);
    for (const placement of layout.placements) {
      expect(typeof placement.sunAzimuthDeg).toBe("number");
      expect(typeof placement.sunAltitudeDeg).toBe("number");
      expect(placement.isAboveHorizon).toBe(false);
    }
  });
});
