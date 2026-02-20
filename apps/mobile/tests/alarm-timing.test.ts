import { describe, expect, it } from "vitest";
import {
  ALARM_COUNTDOWN_START_SECONDS_A2_MAX,
  ALARM_COUNTDOWN_START_SECONDS_A2_MIN,
  ALARM_LEAD_SECONDS_A1_MAX,
  ALARM_LEAD_SECONDS_A1_MIN,
  normalizeAlarmTiming,
} from "../src/state/appState";

describe("alarm timing normalization", () => {
  it("keeps valid values", () => {
    expect(normalizeAlarmTiming(10, 5)).toEqual({
      alarmLeadSecondsA1: 10,
      alarmCountdownStartSecondsA2: 5,
    });
  });

  it("clamps values into valid ranges", () => {
    expect(normalizeAlarmTiming(-99, 999)).toEqual({
      alarmLeadSecondsA1: ALARM_LEAD_SECONDS_A1_MIN,
      alarmCountdownStartSecondsA2: ALARM_COUNTDOWN_START_SECONDS_A2_MIN,
    });

    expect(normalizeAlarmTiming(999, 999)).toEqual({
      alarmLeadSecondsA1: ALARM_LEAD_SECONDS_A1_MAX,
      alarmCountdownStartSecondsA2: ALARM_COUNTDOWN_START_SECONDS_A2_MAX,
    });
  });

  it("forces a2 to remain lower than a1", () => {
    expect(normalizeAlarmTiming(8, 8)).toEqual({
      alarmLeadSecondsA1: 8,
      alarmCountdownStartSecondsA2: 7,
    });

    expect(normalizeAlarmTiming(2, 30)).toEqual({
      alarmLeadSecondsA1: 2,
      alarmCountdownStartSecondsA2: 1,
    });
  });
});
