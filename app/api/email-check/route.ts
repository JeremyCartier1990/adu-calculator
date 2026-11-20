import { emailDomainAcceptsMail } from "@/lib/email-check";
import { clientIp, takeToken } from "@/lib/rate-limit";

// Domains most homeowners use; a near-miss of one of these is almost always a typo.
const COMMON_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "aol.com",
  "msn.com",
  "live.com",
  "me.com",
  "comcast.net",
  "att.net",
  "sbcglobal.net",
  "verizon.net",
  "cox.net",
  "charter.net",
  "protonmail.com",
];

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

/** The common domain one or two keystrokes away from `domain`, if any. */
function likelyDomain(domain: string): string | null {
  if (COMMON_DOMAINS.includes(domain)) return null;
  let best: { domain: string; score: number } | null = null;
  for (const candidate of COMMON_DOMAINS) {
    const score = distance(domain, candidate);
    if (score <= 2 && (!best || score < best.score)) best = { domain: candidate, score };
  }
  return best?.domain ?? null;
}

/**
 * Checks an email before the lead is saved: format, a likely typo of a common
 * provider, and whether the domain can receive mail. POST /api/reports runs the
 * same domain check, so this endpoint only improves the form's feedback.
 */
export async function POST(request: Request): Promise<Response> {
  if (!takeToken("email-check", clientIp(request), 60, 60 * 60 * 1000)) {
    return Response.json({ ok: false, code: "rate_limited" }, { status: 429 });
  }
  let email = "";
  try {
    const body = (await request.json()) as { email?: unknown };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
  } catch {
    return Response.json({ ok: false, code: "bad_request" }, { status: 400 });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return Response.json({ ok: true, valid: false, message: "Enter a valid email address." });
  }
  const [local, domain] = email.split("@");
  const typo = likelyDomain(domain);
  const suggestion = typo ? `${local}@${typo}` : null;
  if (!(await emailDomainAcceptsMail(email))) {
    return Response.json({
      ok: true,
      valid: false,
      suggestion,
      message: `${domain} can't receive email. Check the spelling.`,
    });
  }
  return Response.json({ ok: true, valid: true, suggestion });
}
