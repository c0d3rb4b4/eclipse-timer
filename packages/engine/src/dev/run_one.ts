import type { EclipseRecord } from "@eclipse-timer/shared";
import sampleCatalog from "../../../catalog/src/catalog.sample.json";
import { computeCircumstances } from "../circumstances/compute";

declare const console: {
  log: (...args: unknown[]) => void;
};

const catalog = sampleCatalog as EclipseRecord[];
const e = catalog[0];
if (!e) throw new Error("No eclipse in catalog");

const gibraltar = { latDeg: 36.1408, lonDeg: -5.3536 };
const centralAt1000 = { latDeg: 26 + 53.3 / 60, lonDeg: 31 + 0.8 / 60 };

console.log("Gibraltar:");
console.log(JSON.stringify(computeCircumstances(e, gibraltar), null, 2));

console.log("\nCentral line @ 10:00 UT row:");
console.log(JSON.stringify(computeCircumstances(e, centralAt1000), null, 2));
