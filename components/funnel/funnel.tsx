"use client";

import { useEffect, useRef, useState } from "react";
import { AnalysisSection } from "@/components/funnel/analysis";
import { AddressInput } from "@/components/funnel/address-input";
import { ArrowBox } from "@/components/eyebrow";
import { Hero } from "@/components/hero";
import { trackLeadConversion } from "@/lib/redtrack";
import { rememberEditKey } from "@/lib/report-keys";
import { validateAddress } from "@/lib/address";
import type { PropertyLookup } from "@/lib/api-types";
import { BRAND } from "@/lib/brand";
import { parsePositive } from "@/lib/money";
import type { ConfirmedProperty } from "@/lib/report";
import { EMPTY_FACTS, FACT_FIELDS, formatUsPhone, postJson, UsFlag, type FactKey, type Facts, type SavedReport } from "./shared";

type Step = "address" | "confirm" | "contact" | "analysis";
export function Funnel() {
  const [step, setStep] = useState<Step>("address");
  const [address, setAddress] = useState("");
  const [addressError, setAddressError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookupNote, setLookupNote] = useState<string | null>(null);
  const [facts, setFacts] = useState<Facts>(EMPTY_FACTS);
  const [edited, setEdited] = useState<Set<FactKey>>(new Set());
  const [lookup, setLookup] = useState<Extract<PropertyLookup, { ok: true }> | null>(null);
  const [property, setProperty] = useState<ConfirmedProperty | null>(null);
  const [report, setReport] = useState<SavedReport | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const addressRef = useRef<HTMLInputElement>(null);

  async function startLookup(raw: string) {
    const parsed = validateAddress(raw);
    if (!parsed.ok) {
      setAddressError(parsed.message);
      addressRef.current?.focus();
      return;
    }
    setAddressError(null);
    setLooking(true);
    try {
      const data = await postJson<PropertyLookup>("/api/property", { address: parsed.address });
      if (data.ok) {
        setLookup(data);
        setAddress(data.formattedAddress ?? parsed.address);
        setFacts({
          squareFootage: data.property.squareFootage?.toString() ?? "",
          lotSize: data.property.lotSize?.toString() ?? "",
          bedrooms: data.property.bedrooms?.toString() ?? "",
          bathrooms: data.property.bathrooms?.toString() ?? "",
          yearBuilt: data.property.yearBuilt?.toString() ?? "",
          homeValue: data.value.price?.toString() ?? "",
        });
        setLookupNote(null);
      } else {
        setLookup(null);
        setAddress(parsed.address);
        setFacts(EMPTY_FACTS);
        setLookupNote(
          data.code === "not_found"
            ? "We couldn't find public records for this address. Fill in what you know; estimates work without them."
            : "Property records aren't available right now. Fill in what you know; estimates work without them.",
        );
      }
    } catch {
      setLookup(null);
      setAddress(parsed.address);
      setFacts(EMPTY_FACTS);
      setLookupNote("The lookup didn't finish. Fill in what you know; estimates work without them.");
    } finally {
      setEdited(new Set());
      setLooking(false);
      setStep("confirm");
    }
  }

  function confirmProperty() {
    const number = (key: FactKey) => parsePositive(facts[key]);
    setProperty({
      address,
      squareFootage: number("squareFootage"),
      lotSize: number("lotSize"),
      bedrooms: number("bedrooms"),
      bathrooms: number("bathrooms"),
      yearBuilt: number("yearBuilt"),
      propertyType: lookup?.property.propertyType ?? null,
      homeValue: number("homeValue"),
      latitude: lookup?.property.latitude ?? null,
      longitude: lookup?.property.longitude ?? null,
      source: lookup ? "rentcast" : "manual",
      edited: [...edited],
    });
    setStep("contact");
  }

  function openAnalysis(saved: SavedReport | null, note: string | null) {
    if (saved) {
      trackLeadConversion(saved.id);
      rememberEditKey(saved.id, saved.editKey);
    }
    setReport(saved);
    setSaveNote(note);
    setStep("analysis");
  }

  useEffect(() => {
    if (step === "analysis") document.getElementById("analysis")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  return (
    <>
      <Hero>
        <form
          className="flex flex-col gap-2 rounded-xl border border-line bg-white p-2 shadow-[0_24px_60px_rgba(31,30,27,0.14)] sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void startLookup(address);
          }}
        >
          <AddressInput
            value={address}
            onChange={setAddress}
            onPick={(picked) => void startLookup(picked)}
            invalid={Boolean(addressError)}
            inputRef={addressRef}
            tone="light"
          />
          <button
            type="submit"
            disabled={looking}
            className="inline-flex min-h-13 shrink-0 items-center justify-center gap-3 rounded-lg bg-ink py-2 pl-2 pr-5 text-base font-medium text-white transition hover:bg-ink/85 disabled:cursor-wait disabled:opacity-80"
          >
            <ArrowBox />
            {looking ? "Finding your home…" : "Get my ROI report"}
          </button>
        </form>
        <p role="status" className={`mt-3 inline-block rounded-md bg-paper/85 px-2.5 py-1 text-sm backdrop-blur ${addressError ? "text-clay" : "text-ink-soft"}`}>
          {addressError ?? "Free · About 2 minutes · No obligation"}
        </p>
      </Hero>

      <StepDialog open={step === "confirm"} onClose={() => setStep("address")} label="Confirm your property">
        <ConfirmStep
          address={address}
          fromRecords={Boolean(lookup)}
          note={lookupNote}
          facts={facts}
          onFact={(key, value) => {
            setFacts((current) => ({ ...current, [key]: value }));
            setEdited((current) => new Set(current).add(key));
          }}
          onChangeAddress={() => {
            setStep("address");
            setTimeout(() => addressRef.current?.focus(), 50);
          }}
          onConfirm={confirmProperty}
        />
      </StepDialog>

      <StepDialog open={step === "contact"} onClose={() => setStep("confirm")} label="Where should we send your report?">
        {property ? <ContactStep property={property} onBack={() => setStep("confirm")} onDone={openAnalysis} /> : null}
      </StepDialog>

      {step === "analysis" && property ? <AnalysisSection property={property} report={report} saveNote={saveNote} /> : null}
    </>
  );
}

/** Modal step built on <dialog>, which brings focus trapping and Escape for free. */
function StepDialog({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto max-h-[92svh] w-[min(560px,calc(100vw-24px))] overflow-y-auto rounded-[28px] border border-line bg-surface p-0 text-ink shadow-[0_40px_120px_rgba(12,13,12,0.35)] backdrop:bg-ink/55 backdrop:backdrop-blur-sm"
    >
      {open ? children : null}
    </dialog>
  );
}

function Progress({ at }: { at: 1 | 2 }) {
  return (
    <div className="flex items-center gap-3 text-xs font-medium text-ink-soft">
      <span>Step {at} of 2</span>
      <span className="flex flex-1 gap-1.5" aria-hidden="true">
        <span className="h-1 flex-1 rounded-full bg-ink" />
        <span className={`h-1 flex-1 rounded-full ${at === 2 ? "bg-ink" : "bg-line"}`} />
      </span>
    </div>
  );
}

function ConfirmStep({
  address,
  fromRecords,
  note,
  facts,
  onFact,
  onChangeAddress,
  onConfirm,
}: {
  address: string;
  fromRecords: boolean;
  note: string | null;
  facts: Facts;
  onFact: (key: FactKey, value: string) => void;
  onChangeAddress: () => void;
  onConfirm: () => void;
}) {
  return (
    <form
      className="p-6 sm:p-8"
      onSubmit={(event) => {
        event.preventDefault();
        onConfirm();
      }}
    >
      <Progress at={1} />
      <h2 className="mt-6 font-display text-4xl leading-tight">Is this your property?</h2>
      <div className="mt-4 flex items-start justify-between gap-4 rounded-2xl bg-paper px-4 py-3">
        <p className="text-sm font-medium leading-6">{address}</p>
        <button type="button" onClick={onChangeAddress} className="shrink-0 text-sm font-medium text-pine underline-offset-4 hover:underline">
          Change
        </button>
      </div>
      <p className="mt-4 text-sm leading-6 text-ink-soft">
        {note ?? (fromRecords ? "From public records. Correct anything that's off; we size and value your ADU from these." : "")}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {FACT_FIELDS.map((field) => (
          <label key={field.key} className={field.key === "homeValue" ? "col-span-2" : ""}>
            <span className="text-xs font-medium uppercase tracking-wide text-ink-soft">{field.label}</span>
            <span className="mt-1 flex min-h-12 items-center rounded-xl border border-line bg-white focus-within:border-ink focus-within:ring-4 focus-within:ring-ink/10">
              {field.prefix ? <span className="pl-3 text-ink-soft">{field.prefix}</span> : null}
              <input
                inputMode="decimal"
                value={facts[field.key]}
                onChange={(event) => onFact(field.key, event.target.value)}
                className="min-h-12 w-full bg-transparent px-3 text-base tabular-nums outline-none"
              />
              {field.suffix ? <span className="pr-3 text-sm text-ink-soft">{field.suffix}</span> : null}
            </span>
          </label>
        ))}
      </div>
      <button
        type="submit"
        className="mt-7 inline-flex min-h-13 w-full items-center justify-center rounded-full bg-ink px-6 py-3.5 text-base font-semibold text-white hover:bg-ink/85"
      >
        Yes, this is my property
      </button>
    </form>
  );
}

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-sm font-medium">
      {children}
      <span className="ml-0.5 text-clay" aria-hidden="true">
        *
      </span>
    </span>
  );
}

type VerifyStatus = { twilio: boolean; verified: boolean; phone: string | null };

function ContactStep({
  property,
  onBack,
  onDone,
}: {
  property: ConfirmedProperty;
  onBack: () => void;
  onDone: (report: SavedReport | null, note: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [verify, setVerify] = useState<VerifyStatus | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetch("/api/verify/status")
      .then((response) => response.json() as Promise<VerifyStatus>)
      .then(setVerify)
      .catch(() => setVerify({ twilio: false, verified: false, phone: null }));
  }, []);

  const digits = phone.replace(/\D/g, "");
  const normalized = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : null;
  const alreadyVerified = Boolean(verify?.verified && verify.phone && verify.phone === normalized);
  const needsCode = Boolean(verify?.twilio) && !alreadyVerified;

  function check(): boolean {
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "Enter your name.";
    if (!normalized) next.phone = "Enter a 10-digit US phone number.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function sendCode() {
    if (!check()) return;
    setPending(true);
    setMessage(null);
    try {
      const data = await postJson<{ ok: boolean; code?: string; message?: string }>("/api/verify/start", {
        phone,
        address: property.address,
      });
      if (data.code === "phone_used") setErrors({ phone: data.message ?? "This phone number already has a report." });
      else if (!data.ok) setMessage(data.message ?? "We couldn't send a text to that number.");
      else setCodeSent(true);
    } catch {
      setMessage("We couldn't send a text to that number.");
    } finally {
      setPending(false);
    }
  }

  async function submit() {
    if (!check()) return;
    setPending(true);
    setMessage(null);
    try {
      if (needsCode) {
        const checked = await postJson<{ ok: boolean; message?: string }>("/api/verify/check", { phone, code });
        if (!checked.ok) {
          setErrors({ code: checked.message ?? "That code didn't match." });
          return;
        }
      }
      const data = await postJson<{
        ok: boolean;
        id?: string;
        editKey?: string;
        code?: string;
        message?: string;
        errors?: Record<string, string>;
      }>("/api/reports", { name, phone, property, companyWebsite: website });
      if (data.ok && data.id && data.editKey) {
        onDone({ id: data.id, editKey: data.editKey }, null);
        return;
      }
      if (data.code === "not_configured") {
        onDone(null, data.message ?? null);
        return;
      }
      const fieldErrors = data.errors ?? {};
      setErrors(fieldErrors);
      // A problem shown under a field isn't repeated below the form.
      setMessage(Object.keys(fieldErrors).length > 0 ? null : (data.message ?? "Something went wrong. Try again."));
    } catch {
      setMessage("Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  const field = "mt-1 min-h-12 w-full rounded-xl border bg-white px-3 text-base outline-none focus:border-ink focus:ring-4 focus:ring-ink/10";

  return (
    <form
      className="p-6 sm:p-8"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (needsCode && !codeSent) void sendCode();
        else void submit();
      }}
    >
      <Progress at={2} />
      <h2 className="mt-6 font-display text-4xl leading-tight">Who is this report for?</h2>
      <p className="mt-2 text-sm leading-6 text-ink-soft">
        Your report gets a private link and a PDF you can download or email yourself.{" "}
        {needsCode ? "We text a code to confirm your number." : ""}
      </p>

      <div className="mt-6 space-y-3">
        <label className="block">
          <RequiredLabel>Full name</RequiredLabel>
          <input
            autoComplete="name"
            aria-required="true"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={Boolean(errors.name) || undefined}
            className={`${field} ${errors.name ? "border-clay" : "border-line"}`}
          />
          {errors.name ? <span className="mt-1 block text-sm text-clay">{errors.name}</span> : null}
        </label>
        <label className="block">
          <RequiredLabel>Mobile phone</RequiredLabel>
          <span
            className={`mt-1 flex min-h-12 items-center rounded-xl border bg-white focus-within:border-ink focus-within:ring-4 focus-within:ring-ink/10 ${
              errors.phone ? "border-clay" : "border-line"
            } ${codeSent ? "bg-paper" : ""}`}
          >
            <span className="flex shrink-0 items-center gap-2 self-stretch border-r border-line pl-3 pr-3 text-base text-ink-soft" aria-label="United States, +1">
              <UsFlag />
              <span aria-hidden="true">+1</span>
            </span>
            <input
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              aria-required="true"
              placeholder="(310) 555-0123"
              value={phone}
              disabled={codeSent}
              onChange={(event) => setPhone(formatUsPhone(event.target.value))}
              aria-invalid={Boolean(errors.phone) || undefined}
              className="min-h-12 w-full rounded-r-xl bg-transparent px-3 text-base tabular-nums outline-none placeholder:text-ink-soft/60"
            />
          </span>
          {errors.phone ? <span className="mt-1 block text-sm text-clay">{errors.phone}</span> : null}
        </label>
        {codeSent ? (
          <label className="block">
            <span className="flex items-baseline justify-between text-sm font-medium">
              Code from the text
              <button type="button" className="text-sm font-normal text-pine hover:underline" onClick={() => setCodeSent(false)}>
                Change number
              </button>
            </span>
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              value={code}
              autoFocus
              onChange={(event) => setCode(event.target.value)}
              aria-invalid={Boolean(errors.code) || undefined}
              className={`${field} tracking-[0.3em] ${errors.code ? "border-clay" : "border-line"}`}
            />
            {errors.code ? <span className="mt-1 block text-sm text-clay">{errors.code}</span> : null}
          </label>
        ) : null}
        <label className="hidden" aria-hidden="true">
          Company website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
        </label>
      </div>

      {message ? (
        <p role="alert" className="mt-4 text-sm text-clay">
          {message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending || verify == null}
        className="mt-6 inline-flex min-h-13 w-full items-center justify-center rounded-full bg-ink px-6 py-3.5 text-base font-semibold text-white hover:bg-ink/85 disabled:opacity-60"
      >
        {pending ? "One moment…" : needsCode && !codeSent ? "Text me a code" : "Open my ROI report"}
      </button>
      <button type="button" onClick={onBack} className="mt-3 w-full text-sm font-medium text-ink-soft hover:text-ink">
        Back
      </button>
      <p className="mt-5 text-xs leading-5 text-ink-soft">
        By continuing, you agree that {BRAND.builder}, the builder behind {BRAND.name}, may contact you by phone and text, and by email
        if you share one, about your ADU project, including with automated technology. Consent isn&apos;t a condition of purchase. Message and data
        rates may apply.
      </p>
    </form>
  );
}

