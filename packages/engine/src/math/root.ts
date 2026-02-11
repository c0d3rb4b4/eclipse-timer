export type RootResult = {
  tHours: number;     // hours relative to t0 (TDT)
  ok: boolean;
  iterations: number;
};

export function bisectRoot(
  f: (t: number) => number,
  a: number,
  b: number,
  tol: number,
  maxIter = 100
): RootResult | null {
  let fa = f(a);
  let fb = f(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb)) return null;
  if (fa === 0) return { tHours: a, ok: true, iterations: 0 };
  if (fb === 0) return { tHours: b, ok: true, iterations: 0 };
  if (fa * fb > 0) return null;

  let lo = a;
  let hi = b;
  let flo = fa;
  let fhi = fb;

  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2;
    const fmid = f(mid);
    if (!Number.isFinite(fmid)) return null;

    if (Math.abs(hi - lo) <= tol || fmid === 0) {
      return { tHours: mid, ok: true, iterations: i + 1 };
    }

    if (flo * fmid <= 0) {
      hi = mid;
      fhi = fmid;
    } else {
      lo = mid;
      flo = fmid;
    }
  }

  return { tHours: (lo + hi) / 2, ok: false, iterations: maxIter };
}
