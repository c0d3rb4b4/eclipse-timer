import catalog from "../generated/catalog.generated.json";
import type { EclipseRecord, OverlayPoint } from "@eclipse-timer/shared";

type OverlayData = {
  overlayVisiblePolygons: OverlayPoint[][];
  overlayCentralPolygons: OverlayPoint[][];
};

let overlayMap: Record<string, OverlayData> | null = null;

function getOverlays(): Record<string, OverlayData> {
  if (!overlayMap) {
    try {
      // Static path so Metro / bundlers can resolve it at build time.
      // If the file doesn't exist yet the catch returns an empty map.
      overlayMap = require("../generated/overlays.generated.json") as Record<string, OverlayData>;
    } catch {
      console.warn(
        "[@eclipse-timer/catalog] overlays.generated.json not found — " +
        "run 'pnpm data:overlays' inside packages/catalog to generate it."
      );
      overlayMap = {};
    }
  }
  return overlayMap;
}

export function loadCatalog(): EclipseRecord[] {
  const overlays = getOverlays();
  return (catalog as EclipseRecord[]).map((e) => {
    const ov = overlays[e.id];
    if (ov) {
      return {
        ...e,
        overlayVisiblePolygons: ov.overlayVisiblePolygons,
        overlayCentralPolygons: ov.overlayCentralPolygons,
      };
    }
    return e;
  });
}
