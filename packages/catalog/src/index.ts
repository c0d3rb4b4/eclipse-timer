import catalog from "../generated/catalog.generated.json";
import type { EclipseRecord, OverlayPoint } from "@eclipse-timer/shared";

declare function require(moduleId: string): unknown;

type OverlayData = {
  overlayVisiblePolygons: OverlayPoint[][];
  overlayCentralPolygons: OverlayPoint[][];
};

type OverlayChunk = Record<string, OverlayData>;

const catalogRecords = catalog as EclipseRecord[];
const hydratedCatalogById = new Map<string, EclipseRecord>();
const overlayChunkCache = new Map<number, OverlayChunk>();

let catalogById: Map<string, EclipseRecord> | null = null;

const overlayChunkLoaders: Record<number, () => OverlayChunk> = {
  1900: () => require("../generated/overlays.1900s.generated.json") as OverlayChunk,
  1910: () => require("../generated/overlays.1910s.generated.json") as OverlayChunk,
  1920: () => require("../generated/overlays.1920s.generated.json") as OverlayChunk,
  1930: () => require("../generated/overlays.1930s.generated.json") as OverlayChunk,
  1940: () => require("../generated/overlays.1940s.generated.json") as OverlayChunk,
  1950: () => require("../generated/overlays.1950s.generated.json") as OverlayChunk,
  1960: () => require("../generated/overlays.1960s.generated.json") as OverlayChunk,
  1970: () => require("../generated/overlays.1970s.generated.json") as OverlayChunk,
  1980: () => require("../generated/overlays.1980s.generated.json") as OverlayChunk,
  1990: () => require("../generated/overlays.1990s.generated.json") as OverlayChunk,
  2000: () => require("../generated/overlays.2000s.generated.json") as OverlayChunk,
  2010: () => require("../generated/overlays.2010s.generated.json") as OverlayChunk,
  2020: () => require("../generated/overlays.2020s.generated.json") as OverlayChunk,
  2030: () => require("../generated/overlays.2030s.generated.json") as OverlayChunk,
  2040: () => require("../generated/overlays.2040s.generated.json") as OverlayChunk,
  2050: () => require("../generated/overlays.2050s.generated.json") as OverlayChunk,
  2060: () => require("../generated/overlays.2060s.generated.json") as OverlayChunk,
  2070: () => require("../generated/overlays.2070s.generated.json") as OverlayChunk,
  2080: () => require("../generated/overlays.2080s.generated.json") as OverlayChunk,
  2090: () => require("../generated/overlays.2090s.generated.json") as OverlayChunk,
  2100: () => require("../generated/overlays.2100s.generated.json") as OverlayChunk,
};

function warn(message: string): void {
  const maybeConsole = (globalThis as { console?: { warn?: (msg: string) => void } }).console;
  maybeConsole?.warn?.(message);
}

function getCatalogById(): Map<string, EclipseRecord> {
  if (!catalogById) {
    catalogById = new Map(catalogRecords.map((record) => [record.id, record]));
  }
  return catalogById;
}

function getDecadeBucketFromId(id: string): number | null {
  const year = Number(id.slice(0, 4));
  if (!Number.isFinite(year)) return null;
  return Math.floor(year / 10) * 10;
}

function getOverlayChunkForId(id: string): OverlayChunk | null {
  const decade = getDecadeBucketFromId(id);
  if (decade == null) return null;

  const cached = overlayChunkCache.get(decade);
  if (cached) return cached;

  const loadChunk = overlayChunkLoaders[decade];
  if (!loadChunk) return null;

  try {
    const loaded = loadChunk();
    overlayChunkCache.set(decade, loaded);
    return loaded;
  } catch {
    warn(
      `[@eclipse-timer/catalog] overlay decade chunk ${decade}s not found — ` +
        "run 'pnpm data:overlays' inside packages/catalog to generate it."
    );
    const empty: OverlayChunk = {};
    overlayChunkCache.set(decade, empty);
    return empty;
  }
}

function getOverlayForId(id: string): OverlayData | undefined {
  const chunk = getOverlayChunkForId(id);
  if (!chunk) return undefined;
  return chunk[id];
}

export function loadCatalog(): EclipseRecord[] {
  return catalogRecords;
}

export function loadCatalogEntry(id: string): EclipseRecord | undefined {
  return getCatalogById().get(id);
}

export function loadCatalogEntryWithOverlays(id: string): EclipseRecord | undefined {
  const hydrated = hydratedCatalogById.get(id);
  if (hydrated) return hydrated;

  const record = loadCatalogEntry(id);
  if (!record) return undefined;

  const overlay = getOverlayForId(id);
  if (!overlay) return record;

  const withOverlays = {
    ...record,
    overlayVisiblePolygons: overlay.overlayVisiblePolygons,
    overlayCentralPolygons: overlay.overlayCentralPolygons,
  };
  hydratedCatalogById.set(id, withOverlays);
  return withOverlays;
}
