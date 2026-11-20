"use client";

// Pieces shared by the homeowner funnel and the team builder.

export type Facts = Record<FactKey, string>;
export type FactKey = "squareFootage" | "lotSize" | "bedrooms" | "bathrooms" | "yearBuilt" | "homeValue";
export type SavedReport = { id: string; editKey: string };

export const FACT_FIELDS: Array<{ key: FactKey; label: string; suffix?: string; prefix?: string }> = [
  { key: "squareFootage", label: "Home size", suffix: "sqft" },
  { key: "lotSize", label: "Lot size", suffix: "sqft" },
  { key: "bedrooms", label: "Bedrooms" },
  { key: "bathrooms", label: "Bathrooms" },
  { key: "yearBuilt", label: "Year built" },
  { key: "homeValue", label: "Estimated value", prefix: "$" },
];

export const EMPTY_FACTS: Facts = { squareFootage: "", lotSize: "", bedrooms: "", bathrooms: "", yearBuilt: "", homeValue: "" };

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  return (await response.json()) as T;
}

/** Format US digits as (310) 555-0123 while typing; a pasted or autofilled +1 is dropped. */
export function formatUsPhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (digits.length <= 3) return digits.length === 3 ? `(${digits})` : digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** US flag as SVG, since flag emoji don't render on Windows. */
export function UsFlag() {
  return (
    <svg viewBox="0 0 19 10" className="h-3.5 w-[26px] shrink-0 overflow-hidden rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" aria-hidden="true">
      <rect width="19" height="10" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((row) => (
        <rect key={row} y={(row * 10) / 13} width="19" height={10 / 13} fill="#b22234" />
      ))}
      <rect width="7.6" height={(7 * 10) / 13} fill="#3c3b6e" />
    </svg>
  );
}
