import "server-only";

import { resolveMx } from "dns/promises";

/**
 * True unless DNS says the email's domain cannot receive mail. Lookup errors
 * other than "no such domain / no MX" and slow lookups count as deliverable,
 * so a DNS hiccup never blocks a real lead.
 */
export async function emailDomainAcceptsMail(email: string, timeoutMs = 2500): Promise<boolean> {
  const domain = email.split("@")[1];
  if (!domain) return false;
  const lookup = resolveMx(domain).then(
    (records) => records.length > 0,
    (error: NodeJS.ErrnoException) => !(error.code === "ENOTFOUND" || error.code === "ENODATA"),
  );
  const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(true), timeoutMs));
  return Promise.race([lookup, timeout]);
}
