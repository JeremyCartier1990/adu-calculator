import "server-only";

import { unstable_cache } from "next/cache";
import { ASSUMPTIONS } from "./assumptions";
import { requestRentCast, setRentCastPersistentLoader, type RentCastPayload } from "./rentcast";

/**
 * Shared Next.js data cache. Entries last 24 hours and, via unstable_cache,
 * can survive a new deployment — important on a 50 lookup/month RentCast plan.
 * The in-memory layer in rentcast.ts sits in front of this.
 */
const loadCached = unstable_cache(
  async (url: string): Promise<RentCastPayload> => requestRentCast(url),
  ["rentcast-v1"],
  { revalidate: ASSUMPTIONS.cacheTtlSeconds },
);

let enabled = false;

export function enableSharedRentCastCache(): void {
  if (enabled) return;
  enabled = true;
  setRentCastPersistentLoader((url) => loadCached(url));
}
