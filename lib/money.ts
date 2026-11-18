export function dollars(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

export function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatMoneyCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function formatYears(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "Not within 15 years";
  return `${value.toFixed(1)} years`;
}

export function parseNumber(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export function parsePositive(value: string): number | null {
  const parsed = parseNumber(value);
  if (parsed == null || parsed <= 0) return null;
  return parsed;
}
