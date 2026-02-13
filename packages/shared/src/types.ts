export type EclipseKind = "total" | "annular" | "partial" | "hybrid";
export type EclipseKindAtLocation = "none" | "partial" | "total" | "annular";
export type OverlayPoint = [number, number]; // [latDeg, lonDeg]

export type Observer = {
  latDeg: number;
  lonDeg: number; // East-positive
  elevM?: number;
};

export type EclipseRecord = {
  id: string;
  dateYmd: string; // "2027-08-02"
  kind: EclipseKind;

  // Polynomial reference time
  t0TtHours: number; // 10.000
  deltaTSeconds: number; // 71.7

  // “tan f1 / tan f2”
  tanF1: number;
  tanF2: number;

  // Polynomials in tHours = t1 - t0 (decimal hours)
  x: number[]; // up to cubic
  y: number[];
  d: number[]; // typically up to quadratic
  mu: number[]; // typically linear/quadratic
  l1: number[];
  l2: number[];

  // Optional metadata (handy for validation)
  greatestEclipseUtc?: string;
  greatestDurationUtc?: string;
  greatestEclipseLatDeg?: number;
  greatestEclipseLonDeg?: number;
  overlayVisiblePolygons?: OverlayPoint[][];
  overlayCentralPolygons?: OverlayPoint[][];
};

export type Circumstances = {
  eclipseId: string;
  visible: boolean;
  kindAtLocation: EclipseKindAtLocation;

  c1Utc?: string;
  c2Utc?: string;
  maxUtc?: string;
  c3Utc?: string;
  c4Utc?: string;

  magnitude?: number;
  durationSeconds?: number;

  // Optional debug
  _debug?: Record<string, unknown>;
};
