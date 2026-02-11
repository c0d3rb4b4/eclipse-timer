import type { EclipseRecord } from "@eclipse-timer/shared";

export function ttToUtcUsingDeltaT(ttDate: Date, e: EclipseRecord): Date {
  return new Date(ttDate.getTime() - e.deltaTSeconds * 1000);
}

export function toIsoUtc(d: Date): string {
  return d.toISOString();
}
