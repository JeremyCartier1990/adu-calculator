import type { FinishLevelId, ProjectTypeId } from "./assumptions";

export type EstimateSnapshot = {
  projectType: ProjectTypeId;
  projectLabel: string;
  sqft: number;
  bedrooms: number;
  finish: FinishLevelId;
  totalCost: number;
  monthlyRent: number;
  annualNet: number;
  breakEvenYears: number | null;
  equity: number;
};

export type SanitizedLead = {
  name: string;
  phone: string;
  email: string;
  address: string;
  estimate: EstimateSnapshot | null;
};

export type LeadValidation =
  | { ok: true; dropped: true }
  | { ok: true; dropped: false; lead: SanitizedLead }
  | { ok: false; errors: Record<string, string> };

const PROJECT_TYPES = new Set<ProjectTypeId>(["garage_conversion", "attached_adu", "detached_adu"]);
const FINISHES = new Set<FinishLevelId>(["standard", "premium", "luxury"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Single-line text, no angle brackets, bounded length. */
export function cleanText(value: string, max: number): string {
  return value
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanPhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

function cleanEmail(value: string): string | null {
  const email = cleanText(value, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function finiteNumber(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) return null;
  return value;
}

function parseSnapshot(value: unknown): EstimateSnapshot | null {
  const record = asRecord(value);
  if (!record) return null;
  const projectType = record.projectType;
  const finish = record.finish;
  if (typeof projectType !== "string" || !PROJECT_TYPES.has(projectType as ProjectTypeId)) return null;
  if (typeof finish !== "string" || !FINISHES.has(finish as FinishLevelId)) return null;
  const projectLabel = typeof record.projectLabel === "string" ? cleanText(record.projectLabel, 40) : "";
  const sqft = finiteNumber(record.sqft, 200, 2000);
  const bedrooms = finiteNumber(record.bedrooms, 0, 6);
  const totalCost = finiteNumber(record.totalCost, 0, 20000000);
  const monthlyRent = finiteNumber(record.monthlyRent, 0, 100000);
  const annualNet = finiteNumber(record.annualNet, -5000000, 5000000);
  const equity = finiteNumber(record.equity, -50000000, 50000000);
  const breakEvenRaw = record.breakEvenYears;
  const breakEvenYears =
    breakEvenRaw == null
      ? null
      : finiteNumber(breakEvenRaw, 0, 200);
  if (
    !projectLabel ||
    sqft == null ||
    bedrooms == null ||
    totalCost == null ||
    monthlyRent == null ||
    annualNet == null ||
    equity == null ||
    (breakEvenRaw != null && breakEvenYears == null)
  ) {
    return null;
  }
  return {
    projectType: projectType as ProjectTypeId,
    projectLabel,
    sqft,
    bedrooms,
    finish: finish as FinishLevelId,
    totalCost,
    monthlyRent,
    annualNet,
    breakEvenYears,
    equity,
  };
}

export function validateLead(input: unknown): LeadValidation {
  const record = asRecord(input);
  if (!record) {
    return { ok: false, errors: { form: "Send your name, phone, email, and address." } };
  }

  const honeypot = typeof record.companyWebsite === "string" ? record.companyWebsite.trim() : "";
  if (honeypot) return { ok: true, dropped: true };

  const errors: Record<string, string> = {};
  const name = typeof record.name === "string" ? cleanText(record.name, 80) : "";
  const phone = typeof record.phone === "string" ? cleanPhone(record.phone) : null;
  const email = typeof record.email === "string" ? cleanEmail(record.email) : null;
  const address = typeof record.address === "string" ? cleanText(record.address, 160) : "";

  if (name.length < 2 || !/\p{L}/u.test(name)) errors.name = "Enter your name.";
  if (!phone) errors.phone = "Enter a phone number with at least 10 digits.";
  if (!email) errors.email = "Enter a valid email address.";
  if (address.length < 8 || !/\p{L}/u.test(address) || !/\d/.test(address)) {
    errors.address = "Enter the property street, city, and state.";
  }

  if (Object.keys(errors).length > 0 || !phone || !email) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    dropped: false,
    lead: {
      name,
      phone,
      email,
      address,
      estimate: parseSnapshot(record.estimate),
    },
  };
}
