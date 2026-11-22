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

export type AddressParts = { street: string | null; city: string | null; state: string | null; zipcode: string | null };

/**
 * "2543 Walnut Ave, Venice, CA 90291, USA" → street, city, state, ZIP. Addresses are
 * free text, so any part that can't be found is null rather than a guess.
 */
export function splitAddress(input: string): AddressParts {
  const parts = cleanAddress(input)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length > 0 && /^(usa|us|united states( of america)?)$/i.test(parts[parts.length - 1])) parts.pop();
  let state: string | null = null;
  let zipcode: string | null = null;
  const tail = parts.length > 1 ? parts[parts.length - 1].match(/^([a-z]{2}|california)\.?\s*(\d{5}(?:-\d{4})?)?$/i) : null;
  if (tail) {
    state = /^california$/i.test(tail[1]) ? "CA" : tail[1].toUpperCase();
    zipcode = tail[2] ?? null;
    parts.pop();
  } else if (parts.length > 1) {
    const zipOnly = parts[parts.length - 1].match(/^(\d{5}(?:-\d{4})?)$/);
    if (zipOnly) {
      zipcode = zipOnly[1];
      parts.pop();
    }
  }
  const city = parts.length > 1 ? (parts.pop() ?? null) : null;
  return { street: parts.length > 0 ? parts.join(", ") : null, city, state, zipcode };
}
