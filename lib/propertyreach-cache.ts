import "server-only";

import { permanent } from "./partner-store";
import { setPropertyReachLoader } from "./propertyreach";

/** PropertyReach answers are stored forever (lib/partner-store.ts): each address costs one credit, once. */
let enabled = false;

export function enableSharedPropertyReachCache(): void {
  if (enabled) return;
  enabled = true;
  setPropertyReachLoader((url, request) => permanent("propertyreach", url, () => request(url)));
}
