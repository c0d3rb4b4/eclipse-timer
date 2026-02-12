import { useMemo } from "react";

import type { EclipseRecord } from "@eclipse-timer/shared";

import { localYmdNow } from "../utils/date";
import { kindCodeForRecord, kindLabelFromCode, nasaGifUrlForRecord } from "../utils/eclipse";

export type LandingEclipseItem = {
  id: string;
  dateYmd: string;
  kindLabel: string;
  gifUrl: string;
  isPast: boolean;
};

export function useLandingEclipses(catalog: EclipseRecord[]) {
  const todayYmd = useMemo(() => localYmdNow(), []);
  const landingEclipses: LandingEclipseItem[] = useMemo(
    () =>
      [...catalog]
        .sort((a, b) => a.dateYmd.localeCompare(b.dateYmd))
        .map((e) => {
          const kindCode = kindCodeForRecord(e);
          return {
            id: e.id,
            dateYmd: e.dateYmd,
            kindLabel: kindLabelFromCode(kindCode),
            gifUrl: nasaGifUrlForRecord(e),
            isPast: e.dateYmd < todayYmd,
          };
        }),
    [catalog, todayYmd]
  );

  const firstFutureIndex = useMemo(
    () => landingEclipses.findIndex((e) => !e.isPast),
    [landingEclipses]
  );

  return { landingEclipses, firstFutureIndex };
}
