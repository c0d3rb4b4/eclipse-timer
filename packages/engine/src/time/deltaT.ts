/**
 * MVP ΔT (TT - UT1) approximation in seconds.
 * This is intentionally a placeholder.
 *
 * For 1900–2100 you can implement a published polynomial model later.
 * For now: return a rough constant so the plumbing works.
 */
export function deltaTSecondsApprox(_utc: Date): number {
  // Roughly ~69s around 2026; varies by year.
  // TODO: replace with proper model + tests.
  return 69;
}
