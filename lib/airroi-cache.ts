import "server-only";

import { requestAirRoi, setAirRoiPersistentLoader } from "./airroi";
import { permanent } from "./partner-store";

/**
 * AirROI charges about $0.20 per call, so each estimate is stored forever
 * (lib/partner-store.ts): the same ADU size at the same map point is bought once.
 */
let enabled = false;

export function enableSharedAirRoiCache(): void {
  if (enabled) return;
  enabled = true;
  setAirRoiPersistentLoader((url) => permanent("airroi", url, () => requestAirRoi(url)));
}
