import { describe, expect, it } from "vitest";

import {
  ONBOARDING_WALKTHROUGH_STEPS,
  onboardingRouteLabel,
} from "../src/navigation/onboardingWalkthrough";

describe("onboarding walkthrough", () => {
  it("covers landing, timer, and settings in order", () => {
    expect(ONBOARDING_WALKTHROUGH_STEPS.length).toBeGreaterThanOrEqual(3);
    expect(ONBOARDING_WALKTHROUGH_STEPS[0]?.route).toBe("Landing");
    expect(ONBOARDING_WALKTHROUGH_STEPS[1]?.route).toBe("Timer");
    expect(ONBOARDING_WALKTHROUGH_STEPS[2]?.route).toBe("Settings");
  });

  it("has route labels for onboarding navigation actions", () => {
    expect(onboardingRouteLabel("Landing")).toBe("Eclipse List");
    expect(onboardingRouteLabel("Timer")).toBe("Timer");
    expect(onboardingRouteLabel("Settings")).toBe("Settings");
  });
});
