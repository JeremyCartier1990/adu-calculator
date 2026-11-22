"use client";

import { useEffect, useRef, useState } from "react";
import { AnalysisSection } from "@/components/funnel/analysis";
import { AddressInput } from "@/components/funnel/address-input";
import { ArrowBox } from "@/components/eyebrow";
import { Hero } from "@/components/hero";
import { captureAttribution, readAttribution } from "@/lib/attribution";
import { trackLeadConversion } from "@/lib/redtrack";
import { rememberEditKey } from "@/lib/report-keys";
import { validateAddress } from "@/lib/address";
import type { PropertyLookup } from "@/lib/api-types";
import { bedroomsForSqft, projectTitle, type ProjectTypeId } from "@/lib/assumptions";
import { BRAND } from "@/lib/brand";
import { calculateEstimate, fallbackMonthlyRent } from "@/lib/calculate";
import { formatMoney, formatNumber, parsePositive } from "@/lib/money";
import { openingSetup } from "@/lib/optimize";
import type { ConfirmedProperty } from "@/lib/report";
import { EMPTY_FACTS, FACT_FIELDS, formatUsPhone, postJson, UsFlag, type FactKey, type Facts, type SavedReport } from "./shared";

type Step = "address" | "confirm" | "contact" | "analysis";
// While the lookup runs, the button says what's happening, so the wait reads as work being done.
const LOOKUP_STEPS = ["Finding your home…", "Reading property records…", "Checking ADU rules for your lot…"];

export function Funnel({ preview }: { preview?: React.ReactNode }) {
  const [step, setStep] = useState<Step>("address");
  const [address, setAddress] = useState("");
  const [addressError, setAddressError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookupNote, setLookupNote] = useState<string | null>(null);
  const [facts, setFacts] = useState<Facts>(EMPTY_FACTS);
  const [edited, setEdited] = useState<Set<FactKey>>(new Set());
  const [interest, setInterest] = useState<ProjectTypeId | null>(null);
  const [lookup, setLookup] = useState<Extract<PropertyLookup, { ok: true }> | null>(null);
  const [property, setProperty] = useState<ConfirmedProperty | null>(null);
  const [report, setReport] = useState<SavedReport | null>(null);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const [lookupStep, setLookupStep] = useState(0);
  useEffect(() => {
    if (!looking) return;
    const timer = setInterval(() => setLookupStep((at) => Math.min(at + 1, LOOKUP_STEPS.length - 1)), 1400);
    return () => {
      clearInterval(timer);
      setLookupStep(0);
    };
  }, [looking]);

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
      interest,
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

  useEffect(captureAttribution, []);

  // Every "Get my report" link on the page lands in the address field, ready to type.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const link = (event.target as Element | null)?.closest?.('a[href="#start"]');
      if (!link) return;
      event.preventDefault();
      document.getElementById("start")?.scrollIntoView({ behavior: "smooth", block: "start" });
      addressRef.current?.focus({ preventScroll: true });
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Phones: once the address form scrolls away, a bar at the bottom brings it back.
  const formRef = useRef<HTMLFormElement>(null);
  const [formVisible, setFormVisible] = useState(true);
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const observer = new IntersectionObserver(([entry]) => setFormVisible(entry.isIntersecting));
    observer.observe(form);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <Hero preview={step === "address" ? preview : null}>
        <form
          ref={formRef}
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
            {looking ? LOOKUP_STEPS[lookupStep] : "Get my free report"}
          </button>
        </form>
        {addressError ? (
          <p role="status" className="mt-3 inline-block rounded-md bg-paper/90 px-2.5 py-1 text-sm text-clay backdrop-blur">
            {addressError}
          </p>
        ) : (
          <ul className="mt-3 inline-flex flex-wrap justify-center gap-x-3 gap-y-1 rounded-md bg-paper/85 px-3 py-1.5 text-[13px] text-ink-soft backdrop-blur sm:gap-x-4 sm:text-sm">
            {["100% free", "No sales call", "1 minute"].map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-pine" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3.5 8.5l3 3 6-7" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        )}
      </Hero>

      <StepDialog open={step === "confirm"} onClose={() => setStep("address")} label="Confirm your property">
        <ConfirmStep
          address={address}
          fromRecords={Boolean(lookup)}
          note={lookupNote}
          facts={facts}
          interest={interest}
          onInterest={setInterest}
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

      {step === "address" && !formVisible ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
          <a
            href="#start"
            className="flex min-h-12 w-full items-center justify-center gap-3 rounded-lg bg-ink py-1.5 pl-1.5 pr-5 text-base font-semibold text-white"
          >
            <ArrowBox />
            Get my free report
          </a>
        </div>
      ) : null}
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
      className="step-dialog m-auto max-h-[92svh] w-[min(560px,calc(100vw-24px))] overflow-y-auto rounded-[28px] border border-line bg-surface p-0 text-ink shadow-[0_40px_120px_rgba(12,13,12,0.35)] backdrop:bg-ink/55 backdrop:backdrop-blur-sm max-sm:mb-0 max-sm:max-h-[94svh] max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:pb-[env(safe-area-inset-bottom)]"
    >
      {open ? children : null}
    </dialog>
  );
}

/** The address counts as step one, so the visitor opens the first dialog already a third of the way in. */
function Progress({ at }: { at: 2 | 3 }) {
  return (
    <div className="flex items-center gap-3 text-xs font-medium text-ink-soft">
      <span>Step {at} of 3</span>
      <span className="flex flex-1 gap-1.5" aria-hidden="true">
        {[1, 2, 3].map((index) => (
          <span key={index} className={`h-1 flex-1 rounded-full ${index < at ? "bg-pine" : index === at ? "bg-ink" : "bg-line"}`} />
        ))}
      </span>
    </div>
  );
}

function ConfirmStep({
  address,
  fromRecords,
  note,
  facts,
  interest,
  onInterest,
  onFact,
  onChangeAddress,
  onConfirm,
}: {
  address: string;
  fromRecords: boolean;
  note: string | null;
  facts: Facts;
  interest: ProjectTypeId | null;
  onInterest: (interest: ProjectTypeId | null) => void;
  onFact: (key: FactKey, value: string) => void;
  onChangeAddress: () => void;
  onConfirm: () => void;
}) {
  // Records found: show them as a summary, one tap to accept. Nothing found: the fields, all optional.
  const [editing, setEditing] = useState(!fromRecords);
  const known = FACT_FIELDS.filter((field) => facts[field.key].trim() !== "");
  return (
    <form
      className="p-5 sm:p-8"
      onSubmit={(event) => {
        event.preventDefault();
        onConfirm();
      }}
    >
      <Progress at={2} />
      <h2 className="mt-5 font-display text-3xl leading-tight sm:text-4xl">{fromRecords ? "We found your home" : "Tell us about your home"}</h2>
      <div className="mt-4 flex items-start justify-between gap-4 rounded-2xl bg-paper px-4 py-3">
        <p className="text-sm font-medium leading-6">{address}</p>
        <button type="button" onClick={onChangeAddress} className="-my-2 min-h-10 shrink-0 text-sm font-medium text-pine underline-offset-4 hover:underline">
          Change
        </button>
      </div>

      {editing ? (
        <>
          <p className="mt-4 text-sm leading-6 text-ink-soft">
            {note ?? "Correct anything that's off; we size and value your ADU from these."} {fromRecords ? "" : "Every field is optional."}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {FACT_FIELDS.map((field) => (
              <label key={field.key} className={field.key === "homeValue" ? "col-span-2" : ""}>
                <span className="text-xs font-medium uppercase tracking-wide text-ink-soft">{field.label}</span>
                <span className="mt-1 flex min-h-12 items-center rounded-xl border border-line bg-white focus-within:border-ink focus-within:ring-4 focus-within:ring-ink/10">
                  {field.prefix ? <span className="pl-3 text-ink-soft">{field.prefix}</span> : null}
                  <input
                    inputMode="decimal"
                    value={facts[field.key]}
                    onChange={(event) => onFact(field.key, event.target.value)}
                    className="min-h-12 w-full min-w-0 bg-transparent px-3 text-base tabular-nums outline-none"
                  />
                  {field.suffix ? <span className="pr-3 text-sm text-ink-soft">{field.suffix}</span> : null}
                </span>
              </label>
            ))}
          </div>
        </>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-3">
            {known.map((field) => (
              <div key={field.key} className={field.key === "homeValue" ? "col-span-2 sm:col-span-1" : ""}>
                <dt className="text-xs text-ink-soft">{field.label}</dt>
                <dd className="mt-0.5 text-base font-semibold tabular-nums">
                  {field.prefix}
                  {field.key === "yearBuilt" ? facts[field.key] : formatNumber(parsePositive(facts[field.key]) ?? 0)}
                  {field.suffix ? <span className="text-sm font-normal text-ink-soft"> {field.suffix}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
          <button type="button" onClick={() => setEditing(true)} className="mt-2 min-h-10 text-sm font-medium text-pine underline-offset-4 hover:underline">
            Something&apos;s off? Edit the details
          </button>
        </>
      )}

      <fieldset className="mt-5 min-w-0">
        <legend className="text-sm font-medium">What are you thinking of building?</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {INTERESTS.map((option) => (
            <label key={option.label} className="relative">
              <input
                type="radio"
                name="interest"
                className="peer sr-only"
                checked={interest === option.id}
                onChange={() => onInterest(option.id)}
              />
              <span className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-line bg-white px-3 text-center text-sm font-medium leading-5 peer-checked:border-ink peer-checked:bg-ink peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-ink/15">
                {option.label}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs leading-5 text-ink-soft">Not sure? Your report opens on the type with the best return, and compares the others.</p>
      </fieldset>

      <button
        type="submit"
        autoFocus
        className="mt-6 inline-flex min-h-13 w-full items-center justify-center rounded-full bg-ink px-6 py-3.5 text-base font-semibold text-white hover:bg-ink/85"
      >
        {fromRecords && !editing ? "Looks right, continue" : "Continue"}
      </button>
    </form>
  );
}

const INTERESTS: Array<{ id: ProjectTypeId | null; label: string }> = [
  { id: null, label: "Not sure yet" },
  { id: "detached_adu", label: "Backyard ADU" },
  { id: "attached_adu", label: "Attached ADU" },
  { id: "garage_conversion", label: "Garage conversion" },
];

/** What the report will say, from planning rents, shown blurred until the phone is confirmed. */
function ReportTeaser({ property }: { property: ConfirmedProperty }) {
  const size = { homeSquareFootage: property.squareFootage, homeValue: property.homeValue, lotSize: property.lotSize };
  const setup = openingSetup(size, property.interest);
  const estimate = calculateEstimate({
    ...setup,
    monthlyRent: fallbackMonthlyRent(setup.sqft, bedroomsForSqft(setup.sqft)),
    rentLow: null,
    rentHigh: null,
    rentSource: "assumption",
    ...size,
    rentalUse: "long_term",
  });
  const rows: Array<[string, string]> = [
    ["Cost to build", formatMoney(estimate.total)],
    ["Value it adds", `+${formatMoney(estimate.blendedUplift)}`],
    ["Monthly rent", formatMoney(estimate.scenarios.longTerm.monthlyGross)],
  ];
  return (
    <div className="mt-4 rounded-2xl bg-ink p-4 text-white">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
        Your report · {property.interest ? `${formatNumber(setup.sqft)} sqft ${projectTitle(setup.projectType).toLowerCase().replace("adu", "ADU")}` : property.address.split(",")[0]}
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs leading-4 text-white/65">{label}</dt>
            <dd className="mt-1 select-none font-display text-lg tabular-nums blur-[6px]" aria-hidden="true">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 flex items-center gap-2 text-xs text-white/70">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <rect x="3" y="7" width="10" height="7" rx="1.5" />
          <path d="M5.5 7V5a2.5 2.5 0 015 0v2" />
        </svg>
        Ready. Confirm your phone to unlock it.
      </p>
    </div>
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

  async function submit(typedCode = code) {
    if (!check()) return;
    setPending(true);
    setMessage(null);
    try {
      if (needsCode) {
        const checked = await postJson<{ ok: boolean; message?: string }>("/api/verify/check", { phone, code: typedCode });
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
      }>("/api/reports", {
        name,
        phone,
        property,
        companyWebsite: website,
        attribution: readAttribution(),
      });
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
      className="p-5 sm:p-8"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (needsCode && !codeSent) void sendCode();
        else void submit();
      }}
    >
      <Progress at={3} />
      <h2 className="mt-5 font-display text-3xl leading-tight sm:text-4xl">Your report is ready</h2>
      <ReportTeaser property={property} />
      <p className="mt-4 text-sm leading-6 text-ink-soft">
        {needsCode ? "We text you a code to confirm it's you. " : ""}Your report gets a private link and a PDF to download.
      </p>

      <div className="mt-6 space-y-3">
        <label className="block">
          <RequiredLabel>Your name</RequiredLabel>
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
              onChange={(event) => {
                const next = event.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(next);
                // A full code from the text (or autofill) opens the report without another tap.
                if (next.length === 6 && !pending) void submit(next);
              }}
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
        {pending ? "One moment…" : needsCode && !codeSent ? "Text me my code" : "Unlock my report"}
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

