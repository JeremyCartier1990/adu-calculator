import "server-only";

import { permanent } from "./partner-store";
import { requestRentCast, setRentCastPersistentLoader } from "./rentcast";

/**
 * RentCast answers are stored forever (lib/partner-store.ts), so an address or
 * rent query is bought once. The in-memory layer in rentcast.ts sits in front.
 */
let enabled = false;

export function enableSharedRentCastCache(): void {
  if (enabled) return;
  enabled = true;
  setRentCastPersistentLoader((url) => permanent("rentcast", url, () => requestRentCast(url)));
}
