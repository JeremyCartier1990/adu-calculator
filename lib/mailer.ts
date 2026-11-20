import "server-only";

import { BRAND } from "./brand";

// Report emails through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).
// Needs RESEND_API_KEY and EMAIL_FROM, an address on a domain verified in Resend.

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

/** Sends the PDF report. True when Resend accepted it. */
export async function sendReportEmail(input: {
  to: string;
  name: string;
  address: string;
  reportUrl: string;
  pdf: Uint8Array;
  fileName: string;
}): Promise<boolean> {
  if (!emailConfigured()) return false;
  const first = input.name.split(" ")[0] || "there";
  const html = `
    <p>Hi ${escape(first)},</p>
    <p>Your ADU ROI report for <strong>${escape(input.address)}</strong> is attached as a PDF.</p>
    <p>Your private link always shows the latest numbers: <a href="${escape(input.reportUrl)}">${escape(input.reportUrl)}</a></p>
    <p>${escape(BRAND.builder)} can walk you through the numbers and next steps; just reply to this email.</p>
    <p>— ${escape(BRAND.name)}</p>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM!.trim(),
      to: [input.to],
      subject: `Your ADU ROI report: ${input.address}`,
      html,
      attachments: [{ filename: input.fileName, content: Buffer.from(input.pdf).toString("base64") }],
    }),
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  console.info(JSON.stringify({ event: "report_email", status: response?.status ?? null }));
  return Boolean(response?.ok);
}
