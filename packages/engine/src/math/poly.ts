/**
 * Evaluate polynomial c0 + c1*t + c2*t^2 + ...
 * t is a number (we'll use minutes).
 */
export function evalPoly(coeffs: readonly number[], t: number): number {
  // Horner's method
  let acc = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    acc = acc * t + (coeffs[i] ?? 0);
  }
  return acc;
}
