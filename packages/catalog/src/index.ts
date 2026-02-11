import catalog from "./catalog.sample.json";
import type { EclipseRecord } from "@eclipse-timer/shared";

export function loadCatalog(): EclipseRecord[] {
  return catalog as EclipseRecord[];
}