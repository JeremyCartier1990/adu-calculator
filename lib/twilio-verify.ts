type TwilioResult = { ok: true; status: string } | { ok: false; status: number };

function credentials(): { sid: string; token: string; service: string } | null {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const service = process.env.TWILIO_VERIFY_SERVICE_SID?.trim();
  if (!sid || !token || !service) return null;
  return { sid, token, service };
}

async function twilioForm(path: string, fields: Record<string, string>): Promise<TwilioResult> {
  const creds = credentials();
  if (!creds) return { ok: false, status: 0 };
  const response = await fetch(`https://verify.twilio.com/v2/Services/${creds.service}/${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${creds.sid}:${creds.token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(fields),
    cache: "no-store",
  });
  if (!response.ok) return { ok: false, status: response.status };
  try {
    const body = (await response.json()) as { status?: unknown };
    return { ok: true, status: typeof body.status === "string" ? body.status : "" };
  } catch {
    return { ok: false, status: response.status };
  }
}

export function sendSmsCode(phone: string): Promise<TwilioResult> {
  return twilioForm("Verifications", { To: phone, Channel: "sms" });
}

export function checkSmsCode(phone: string, code: string): Promise<TwilioResult> {
  return twilioForm("VerificationCheck", { To: phone, Code: code });
}
