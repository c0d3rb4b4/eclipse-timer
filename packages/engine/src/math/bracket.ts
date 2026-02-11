export type Bracket = { a: number; b: number; fa: number; fb: number };

export function findBrackets(
  f: (t: number) => number,
  tStart: number,
  tEnd: number,
  step: number
): Bracket[] {
  const out: Bracket[] = [];

  let prevT = tStart;
  let prevF = f(prevT);

  for (let t = tStart + step; t <= tEnd + 1e-12; t += step) {
    const ft = f(t);

    if (Number.isFinite(prevF) && Number.isFinite(ft)) {
      if (prevF === 0) {
        // exact hit; make a tiny bracket around it
        out.push({ a: prevT - step * 0.5, b: prevT + step * 0.5, fa: f(prevT - step * 0.5), fb: f(prevT + step * 0.5) });
      } else if (prevF * ft < 0) {
        out.push({ a: prevT, b: t, fa: prevF, fb: ft });
      }
    }

    prevT = t;
    prevF = ft;
  }

  return out;
}
