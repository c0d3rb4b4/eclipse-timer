import catalog from "../generated/catalog.generated.json";
import type { EclipseRecord } from "@eclipse-timer/shared";

export function loadCatalog(): EclipseRecord[] {
  return catalog as EclipseRecord[];
}
