import "server-only";

import { unstable_cache } from "next/cache";
import { ASSUMPTIONS } from "./assumptions";
import { requestAirRoi, setAirRoiPersistentLoader } from "./airroi";

/**
 * Same 24-hour shared cache as RentCast. AirROI charges about $0.20 per call,
 * so a repeated ADU size at the same map point should not spend another credit.
 */
const loadCached = unstable_cache(
  async (url: string) => requestAirRoi(url),
  ["airroi-v1"],
  { revalidate: ASSUMPTIONS.cacheTtlSeconds },
);

let enabled = false;

export function enableSharedAirRoiCache(): void {
  if (enabled) return;
  enabled = true;
  setAirRoiPersistentLoader((url) => loadCached(url));
}
