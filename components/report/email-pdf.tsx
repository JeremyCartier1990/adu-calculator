"use client";

import { useState } from "react";

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type EmailCheck = { for: string; valid: boolean; suggestion: string | null; message: string | null };

/**
 * Asks for an email only when the homeowner wants the PDF in their inbox.
 * Checks the address (format, typo of a common provider, domain takes mail) before sending.
 */
export function EmailPdf({ reportId, editKey, beforeSend }: { reportId: string; editKey: string; beforeSend: () => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [check, setCheck] = useState<EmailCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<{ to: string; sent: boolean } | null>(null);

  const key = email.trim().toLowerCase();
  const result = check?.for === key ? check : null;

  async function verify(value = key): Promise<boolean> {
    if (!EMAIL_FORMAT.test(value)) {
      setError("Enter a valid email address.");
      return false;
    }
    if (check?.for === value) return check.valid;
    setChecking(true);
    try {
      const response = await fetch("/api/email-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const data = (await response.json()) as { ok: boolean; valid?: boolean; message?: string; suggestion?: string | null };
      // A rate limit or outage shouldn't block the email; the send route checks the domain again.
      if (!data.ok) return true;
      const valid = Boolean(data.valid);
      setCheck({ for: value, valid, suggestion: data.suggestion ?? null, message: data.message ?? null });
      if (!valid) setError(data.message ?? "Enter a valid email address.");
      return valid;
    } catch {
      return true;
    } finally {
      setChecking(false);
    }
  }

  async function send() {
    setError(null);
    if (!(await verify())) return;
    setPending(true);
    try {
      // Save the latest choices first, so the PDF matches the screen.
      await beforeSend();
      const response = await fetch(`/api/reports/${reportId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-edit-key": editKey },
        body: JSON.stringify({ email: key }),
      });
      const data = (await response.json()) as { ok: boolean; sent?: boolean; message?: string };
      if (!data.ok) setError(data.message ?? "We couldn't send that. Try again.");
      else setDone({ to: key, sent: Boolean(data.sent) });
    } catch {
      setError("We couldn't send that. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <p className="flex min-h-12 items-center rounded-lg bg-pine-soft px-4 text-sm text-pine" role="status">
        {done.sent ? `✓ Sent to ${done.to}. Check your inbox.` : `✓ Saved. We'll email your report to ${done.to}.`}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-12 items-center rounded-lg border border-line bg-white px-5 text-sm font-semibold hover:border-ink"
      >
        Email me the PDF
      </button>
    );
  }

  return (
    <form
      className="w-full max-w-md"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void send();
      }}
    >
      <label htmlFor="pdf-email" className="text-sm font-medium">
        Email for your PDF
      </label>
      <div className="mt-1 flex gap-2">
        <input
          id="pdf-email"
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(null);
          }}
          onBlur={() => {
            if (key) void verify();
          }}
          aria-invalid={Boolean(error) || undefined}
          className={`min-h-12 w-full rounded-lg border bg-white px-3 text-base outline-none focus:border-ink focus:ring-4 focus:ring-ink/10 ${
            error ? "border-clay" : result?.valid ? "border-good" : "border-line"
          }`}
        />
        <button
          type="submit"
          disabled={pending || checking}
          className="inline-flex min-h-12 shrink-0 items-center rounded-lg bg-ink px-5 text-sm font-semibold text-white hover:bg-ink/85 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
      {error ? <p className="mt-1 text-sm text-clay">{error}</p> : null}
      {result?.suggestion && result.suggestion !== key ? (
        <p className="mt-1 text-sm text-ink-soft">
          Did you mean{" "}
          <button
            type="button"
            className="font-medium text-pine underline underline-offset-4"
            onClick={() => {
              const suggested = result.suggestion!;
              setEmail(suggested);
              setError(null);
              void verify(suggested);
            }}
          >
            {result.suggestion}
          </button>
          ?
        </p>
      ) : null}
      {checking ? <p className="mt-1 text-sm text-ink-soft">Checking email…</p> : null}
      {!checking && !error && result?.valid && !result.suggestion ? <p className="mt-1 text-sm text-good">✓ Email verified</p> : null}
    </form>
  );
}
