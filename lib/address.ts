/** Collapse whitespace. Keeps the homeowner's casing for display. */
export function cleanAddress(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

/** Cache key form. RentCast matching is case-insensitive. */
export function normalizeAddress(input: string): string {
  return cleanAddress(input).toLowerCase();
}

export function validateAddress(
  input: unknown,
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
