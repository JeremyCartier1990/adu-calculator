"use client";

import { useState, type FormEvent } from "react";
import type { EstimateSnapshot } from "@/lib/lead";
import { formatMoney } from "@/lib/money";

type LeadFormProps = {
  addressHint: string;
  snapshot: EstimateSnapshot;
};

type FieldErrors = Partial<Record<"name" | "phone" | "email" | "address" | "form", string>>;

export function LeadForm({ addressHint, snapshot }: LeadFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState(addressHint);
  const [addressEdited, setAddressEdited] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const addressValue = addressEdited ? address : addressHint || address;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setPending(true);
    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email,
          address: addressValue,
          companyWebsite: honeypot,
          estimate: snapshot,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
        errors?: FieldErrors;
      };
      if (!response.ok || !data.ok) {
        setErrors(data.errors ?? {});
        setFormError(data.message ?? "We couldn't send that. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setFormError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section id="consultation" className="bg-pine text-paper" aria-labelledby="consult-heading">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-[0.9fr_1.1fr] md:py-24">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#e7b9a4]">Free consultation</p>
          <h2 id="consult-heading" className="mt-3 max-w-md font-serif text-4xl tracking-tight">
            Want a real number for your lot?
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-[#e7efe9]">
            Leave your name and the property address. Home First Remodel will follow up about a free consultation.
            The estimate on this page comes with the request so we can start from the project you priced.
          </p>
          <p className="mt-6 text-sm leading-6 text-[#d5e4dc]">
            Current estimate: {snapshot.projectLabel}, {snapshot.sqft.toLocaleString("en-US")} sqft, about{" "}
            {formatMoney(snapshot.totalCost)}.
          </p>
        </div>

        <div className="rounded-3xl bg-surface p-5 text-ink shadow-[0_18px_50px_rgba(0,0,0,0.18)] sm:p-6">
          {done ? (
            <p role="status" className="text-lg leading-8">
              Thank you. We received your request and will be in touch about a free consultation.
            </p>
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-4">
              <div className="absolute left-[-9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
                <label htmlFor="companyWebsite">Company website</label>
                <input
                  id="companyWebsite"
                  name="companyWebsite"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(event) => setHoneypot(event.target.value)}
                />
              </div>

              <Field
                id="lead-name"
                label="Name"
                autoComplete="name"
                value={name}
                error={errors.name}
                onChange={setName}
              />
              <Field
                id="lead-phone"
                label="Phone"
                autoComplete="tel"
                inputMode="tel"
                value={phone}
                error={errors.phone}
                onChange={setPhone}
              />
              <Field
                id="lead-email"
                label="Email"
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                error={errors.email}
                onChange={setEmail}
              />
              <Field
                id="lead-address"
                label="Property address"
                autoComplete="street-address"
                value={addressValue}
                error={errors.address}
                onChange={(value) => {
                  setAddressEdited(true);
                  setAddress(value);
                }}
              />

              {formError ? (
                <p role="alert" className="text-sm text-clay">
                  {formError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={pending}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-clay px-5 text-base font-semibold text-white transition-colors hover:bg-clay-dark disabled:cursor-wait disabled:opacity-70"
              >
                {pending ? "Sending…" : "Request a free consultation"}
              </button>
              <p className="text-xs leading-5 text-ink-soft">
                Estimates only — sending this form is not a contract. We use your details to reply about a consultation.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  autoComplete,
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "tel" | "email" | "text";
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-12 w-full rounded-xl border border-line bg-white px-3 text-base outline-none focus:border-pine focus:ring-2 focus:ring-pine"
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-clay">
          {error}
        </p>
      ) : null}
    </div>
  );
}
