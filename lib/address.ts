/** Collapse whitespace. Keeps the homeowner's casing for display. */
export function cleanAddress(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

/** Cache key form. RentCast matching is case-insensitive. */
export function normalizeAddress(input: string): string {
  return cleanAddress(input).toLowerCase();
}

// "…, Venice, CA 90291", "… Venice CA", "…, California, USA": the state comes last, before an optional ZIP and country.
const CALIFORNIA_TAIL = /\b(ca|california)\.?(\s+\d{5}(-\d{4})?)?(\s*,?\s*(usa|us|united states))?\s*$/i;

/**
 * The public builder takes California addresses only for now: the costs, rents and
 * rules are California's. The team builder takes any US address. To open more states, widen CALIFORNIA_TAIL.
 */
export function isCaliforniaAddress(input: string): boolean {
  return CALIFORNIA_TAIL.test(cleanAddress(input));
}

export const CALIFORNIA_ONLY_MESSAGE = "We only cover California for now. Pick a California address, with the city and CA.";

export function validateAddress(
  input: unknown,
  { californiaOnly = true }: { californiaOnly?: boolean } = {},
): { ok: true; address: string } | { ok: false; message: string } {
  if (typeof input !== "string") {
    return { ok: false, message: "Enter a street address." };
  }
  const address = cleanAddress(input);
  if (address.length < 8 || address.length > 180) {
    return { ok: false, message: "Enter the street, city, and state." };
  }
  if (!/\d/.test(address) || !/\p{L}/u.test(address)) {
    return { ok: false, message: "That doesn't look like a full street address." };
  }
  if (californiaOnly && !isCaliforniaAddress(address)) {
    return { ok: false, message: CALIFORNIA_ONLY_MESSAGE };
  }
  return { ok: true, address };
}

/** Street and city only, lowercased and without punctuation, so "2543 Walnut Ave., Venice, CA 90291, USA" matches "2543 walnut ave, venice, ca". */
export function addressIdentity(input: string): string {
  return cleanAddress(input)
    .toLowerCase()
    .split(",")
    .slice(0, 2)
    .map((part) => part.replace(/[^a-z0-9]+/g, ""))
    .join("|");
}
