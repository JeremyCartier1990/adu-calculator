"use client";

import { useEffect, useRef, useState } from "react";
import { LeadForm } from "@/components/lead-form";
import { ResultsPanel } from "@/components/results-panel";
import { validateAddress, normalizeAddress } from "@/lib/address";
import type { PropertyLookup, RentLookup } from "@/lib/api-types";
import {
  ASSUMPTIONS,
  bedroomLabel,
  bedroomsForSqft,
  FINISH_LEVELS,
  PROJECT_TYPES,
  snapSqft,
  type FinishLevelId,
  type ProjectTypeId,
} from "@/lib/assumptions";
import { calculateEstimate, fallbackMonthlyRent, type RentSource } from "@/lib/calculate";
import type { EstimateSnapshot } from "@/lib/lead";
import { dollars, parsePositive } from "@/lib/money";
import { SAMPLE_ADDRESS, SAMPLE_FACTS } from "@/lib/sample-home";

type Facts = {
  squareFootage: string;
  lotSize: string;
  bedrooms: string;
  bathrooms: string;
  yearBuilt: string;
  propertyType: string;
  homeValue: string;
};

type Origin = "empty" | "sample" | "rentcast";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "message"; tone: "info" | "warn"; text: string };

type RentHit = {
  rent: number;
  rentRangeLow: number | null;
  rentRangeHigh: number | null;
};

const EMPTY_FACTS: Facts = {
  squareFootage: "",
  lotSize: "",
  bedrooms: "",
  bathrooms: "",
  yearBuilt: "",
  propertyType: "",
  homeValue: "",
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T;
  return data;
}

export function Estimator() {
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [liveData, setLiveData] = useState(false);
  const [origin, setOrigin] = useState<Origin>("empty");
  const [factsEdited, setFactsEdited] = useState(false);
  const [facts, setFacts] = useState<Facts>(EMPTY_FACTS);
  const [valueRange, setValueRange] = useState<{ low: number; high: number } | null>(null);
  const [projectType, setProjectType] = useState<ProjectTypeId>("detached_adu");
  const [finish, setFinish] = useState<FinishLevelId>("premium");
  const [sqft, setSqft] = useState(ASSUMPTIONS.size.defaults.detached_adu);
  const [rentOverride, setRentOverride] = useState<string | null>(null);
  const [rentByKey, setRentByKey] = useState<Record<string, RentHit>>({});
  const [pendingRentKey, setPendingRentKey] = useState<string | null>(null);
  const [rentNote, setRentNote] = useState<string | null>(null);

  const liveRef = useRef(false);
  const overrideRef = useRef<string | null>(null);
  const rentByKeyRef = useRef(rentByKey);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef(new Set<string>());
  const lookupSeq = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    liveRef.current = liveData;
    overrideRef.current = rentOverride;
    rentByKeyRef.current = rentByKey;
  }, [liveData, rentOverride, rentByKey]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const beds = bedroomsForSqft(sqft);
  const snapped = snapSqft(sqft);
  const rentKey = `${normalizeAddress(address)}|${snapped}|${beds}`;
  const hit = liveData ? rentByKey[rentKey] : undefined;
  const typedRent = rentOverride == null ? null : parsePositive(rentOverride);

  let monthlyRent: number;
  let rentLow: number | null;
  let rentHigh: number | null;
  let rentSource: RentSource;
  if (typedRent != null) {
    monthlyRent = typedRent;
    rentLow = null;
    rentHigh = null;
    rentSource = "manual";
  } else if (hit) {
    monthlyRent = hit.rent;
    rentLow = hit.rentRangeLow;
    rentHigh = hit.rentRangeHigh;
    rentSource = "rentcast";
  } else {
    monthlyRent = fallbackMonthlyRent(sqft, beds);
    rentLow = dollars(monthlyRent * (1 - ASSUMPTIONS.rent.fallbackRange));
    rentHigh = dollars(monthlyRent * (1 + ASSUMPTIONS.rent.fallbackRange));
    rentSource = "assumption";
  }

  const estimate = calculateEstimate({
    projectType,
    finish,
    sqft,
    monthlyRent,
    rentLow,
    rentHigh,
    rentSource,
    homeSquareFootage: parsePositive(facts.squareFootage),
    homeValue: parsePositive(facts.homeValue),
    lotSize: parsePositive(facts.lotSize),
  });

  const snapshot: EstimateSnapshot = {
    projectType: estimate.projectType,
    projectLabel: estimate.projectLabel,
    sqft: estimate.sqft,
    bedrooms: estimate.bedrooms,
    finish: estimate.finish,
    totalCost: estimate.total,
    monthlyRent: estimate.monthlyRent,
    annualNet: estimate.annualNet,
    breakEvenYears: estimate.breakEvenYears,
    equity: estimate.equity,
  };

  function scheduleRent(nextAddress: string, nextSqft: number, delay: number) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!liveRef.current || overrideRef.current !== null) return;
      const parsed = validateAddress(nextAddress);
      if (!parsed.ok) return;
      const nextSnap = snapSqft(nextSqft);
      const nextBeds = bedroomsForSqft(nextSqft);
      const key = `${normalizeAddress(parsed.address)}|${nextSnap}|${nextBeds}`;
      if (rentByKeyRef.current[key] || inflightRef.current.has(key)) return;
      void requestRent(parsed.address, nextSnap, nextBeds, key);
    }, delay);
  }

  async function requestRent(nextAddress: string, nextSnap: number, nextBeds: number, key: string) {
    inflightRef.current.add(key);
    setPendingRentKey(key);
    setRentNote(null);
    try {
      const data = await postJson<RentLookup>("/api/rent", {
        address: nextAddress,
        squareFootage: nextSnap,
        bedrooms: nextBeds,
      });
      if (!mountedRef.current) return;
      if (!data.ok) {
        setRentNote(data.message);
        return;
      }
      const hit = {
        rent: data.rent,
        rentRangeLow: data.rentRangeLow,
        rentRangeHigh: data.rentRangeHigh,
      };
      rentByKeyRef.current = { ...rentByKeyRef.current, [key]: hit };
      setRentByKey((current) => ({ ...current, [key]: hit }));
    } catch {
      if (mountedRef.current) setRentNote("The rent estimate didn't load. The planning rate is filled in — edit it if you know the rent.");
    } finally {
      inflightRef.current.delete(key);
      if (mountedRef.current) {
        setPendingRentKey((current) => (current === key ? null : current));
      }
    }
  }

  async function lookup() {
    const parsed = validateAddress(address);
    if (!parsed.ok) {
      setStatus({ kind: "message", tone: "warn", text: parsed.message });
      return;
    }
    const seq = lookupSeq.current + 1;
    lookupSeq.current = seq;
    setStatus({ kind: "loading" });
    try {
      const data = await postJson<PropertyLookup>("/api/property", { address: parsed.address });
      if (!mountedRef.current || seq !== lookupSeq.current) return;
      if (!data.ok) {
        setLiveData(false);
        setStatus({ kind: "message", tone: "warn", text: data.message });
        return;
      }
      setAddress(data.formattedAddress ?? parsed.address);
      setFacts({
        squareFootage: data.property.squareFootage?.toString() ?? "",
        lotSize: data.property.lotSize?.toString() ?? "",
        bedrooms: data.property.bedrooms?.toString() ?? "",
        bathrooms: data.property.bathrooms?.toString() ?? "",
        yearBuilt: data.property.yearBuilt?.toString() ?? "",
        propertyType: data.property.propertyType ?? "",
        homeValue: data.value.price?.toString() ?? "",
      });
      setValueRange(
        data.value.priceRangeLow && data.value.priceRangeHigh
          ? { low: data.value.priceRangeLow, high: data.value.priceRangeHigh }
          : null,
      );
      setOrigin("rentcast");
      setFactsEdited(false);
      setLiveData(true);
      liveRef.current = true;
      setRentOverride(null);
      overrideRef.current = null;
      const warning = data.warnings.filter(Boolean).join(" ");
      const cacheNote = data.cached ? " Reused a lookup from the last 24 hours." : "";
      setStatus({
        kind: "message",
        tone: "info",
        text: `Loaded property facts. You can edit any figure.${cacheNote}${warning ? ` ${warning}` : ""}`,
      });
      scheduleRent(data.formattedAddress ?? parsed.address, sqft, 0);
    } catch {
      if (!mountedRef.current || seq !== lookupSeq.current) return;
      setStatus({
        kind: "message",
        tone: "warn",
        text: "The lookup didn't finish. Enter the home's details yourself.",
      });
    }
  }

  function loadSample() {
    if (timerRef.current) clearTimeout(timerRef.current);
    lookupSeq.current += 1;
    setAddress(SAMPLE_ADDRESS);
    setFacts(SAMPLE_FACTS);
    setValueRange(null);
    setOrigin("sample");
    setFactsEdited(false);
    setLiveData(false);
    liveRef.current = false;
    setRentOverride(null);
    overrideRef.current = null;
    setRentNote(null);
    setStatus({
      kind: "message",
      tone: "info",
      text: "Sample preview for 4 Ozone Ave, Venice. These figures are illustrative — not a live lookup, and not this home's actual records.",
    });
  }

  function editFact(key: keyof Facts, value: string) {
    setFacts((current) => ({ ...current, [key]: value }));
    setFactsEdited(true);
    if (key === "homeValue") setValueRange(null);
  }

  const badge =
    origin === "rentcast" && !factsEdited
      ? "From RentCast"
      : origin === "rentcast"
        ? "Edited after lookup"
        : origin === "sample" && !factsEdited
          ? "Sample preview"
          : origin === "sample"
            ? "Sample, edited"
            : "Entered by you";

  const rentHint =
    rentSource === "manual"
      ? "Using the rent you typed."
      : pendingRentKey === rentKey
        ? `Checking rent for a ${snapped.toLocaleString("en-US")} sqft, ${bedroomLabel(bedroomsForSqft(snapped)).toLowerCase()} ADU…`
        : rentSource === "rentcast"
          ? `RentCast estimate for ${snapped.toLocaleString("en-US")} sqft.`
          : "Planning rate until a rent lookup succeeds. You can type over it.";

  return (
    <>
      <section id="calculator" className="mx-auto max-w-6xl px-4 py-12 md:py-16" aria-labelledby="calc-heading">
        <div className="max-w-2xl">
          <h2 id="calc-heading" className="font-serif text-3xl tracking-tight sm:text-4xl">
            Run the numbers
          </h2>
          <p className="mt-3 text-base leading-7 text-ink-soft">
            Look up a home, or enter what you know. Change the project and the results update immediately.
            Lookups run when you press the button, not as you type.
          </p>
        </div>

        <div className="mt-8 grid items-start gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <form
              className="rounded-3xl border border-line bg-surface p-5 sm:p-6"
              onSubmit={(event) => {
                event.preventDefault();
                void lookup();
              }}
            >
              <label htmlFor="home-address" className="text-sm font-medium">
                Property address
              </label>
              <input
                id="home-address"
                name="address"
                autoComplete="street-address"
                value={address}
                placeholder="4 Ozone Ave, Venice, CA 90291"
                onChange={(event) => setAddress(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-3 text-base outline-none focus:border-pine focus:ring-2 focus:ring-pine"
              />
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="submit"
                  disabled={status.kind === "loading"}
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-pine px-5 text-sm font-semibold text-white hover:bg-[#1b332b] disabled:cursor-wait disabled:opacity-70"
                >
                  {status.kind === "loading" ? "Looking up…" : "Look up home"}
                </button>
                <button
                  type="button"
                  onClick={loadSample}
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-line px-5 text-sm font-semibold text-ink hover:border-pine"
                >
                  Preview a Venice sample
                </button>
              </div>
              <p role="status" className={`mt-3 text-sm leading-6 ${status.kind === "message" && status.tone === "warn" ? "text-clay" : "text-ink-soft"}`}>
                {status.kind === "idle"
                  ? "Enter an address to pull public-record facts, or type them in yourself."
                  : status.kind === "loading"
                    ? "Looking up that home…"
                    : status.text}
              </p>
            </form>

            <fieldset className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
              <legend className="px-1 text-sm font-medium">
                Property facts <span className="font-normal text-ink-soft">· {badge}</span>
              </legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <FactField id="fact-sqft" label="House size" suffix="sqft" value={facts.squareFootage} onChange={(value) => editFact("squareFootage", value)} />
                <FactField id="fact-lot" label="Lot size" suffix="sqft" value={facts.lotSize} onChange={(value) => editFact("lotSize", value)} />
                <FactField id="fact-beds" label="Bedrooms" value={facts.bedrooms} onChange={(value) => editFact("bedrooms", value)} />
                <FactField id="fact-baths" label="Bathrooms" value={facts.bathrooms} onChange={(value) => editFact("bathrooms", value)} />
                <FactField id="fact-year" label="Year built" value={facts.yearBuilt} onChange={(value) => editFact("yearBuilt", value)} />
                <FactField id="fact-type" label="Property type" value={facts.propertyType} onChange={(value) => editFact("propertyType", value)} />
                <div className="sm:col-span-2">
                  <FactField
                    id="fact-value"
                    label="Estimated home value"
                    prefix="$"
                    value={facts.homeValue}
                    onChange={(value) => editFact("homeValue", value)}
                  />
                  {valueRange && !factsEdited ? (
                    <p className="mt-1 text-xs text-ink-soft">
                      RentCast range {valueRange.low.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
                      –
                      {valueRange.high.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
                    </p>
                  ) : null}
                </div>
              </div>
            </fieldset>

            <fieldset className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
              <legend className="px-1 text-sm font-medium">Project</legend>
              <div className="mt-3 grid gap-3">
                {PROJECT_TYPES.map((project) => (
                  <label
                    key={project.id}
                    className={`block cursor-pointer rounded-2xl border px-4 py-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-pine ${projectType === project.id ? "border-pine bg-pine-soft" : "border-line bg-white"}`}
                  >
                    <input
                      type="radio"
                      name="projectType"
                      value={project.id}
                      checked={projectType === project.id}
                      onChange={() => {
                        const nextSize = ASSUMPTIONS.size.defaults[project.id];
                        setProjectType(project.id);
                        setSqft(nextSize);
                        scheduleRent(address, nextSize, ASSUMPTIONS.rent.debounceMs);
                      }}
                      className="sr-only"
                    />
                    <span className="block font-medium">{project.title}</span>
                    <span className="mt-1 block text-sm leading-6 text-ink-soft">{project.text}</span>
                  </label>
                ))}
              </div>

              <div className="mt-6">
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor="adu-size" className="text-sm font-medium">
                    ADU size
                  </label>
                  <span className="font-serif text-2xl tabular-nums">{sqft.toLocaleString("en-US")} sqft</span>
                </div>
                <input
                  id="adu-size"
                  type="range"
                  min={ASSUMPTIONS.size.min}
                  max={ASSUMPTIONS.size.max}
                  step={ASSUMPTIONS.size.step}
                  value={sqft}
                  aria-valuemin={ASSUMPTIONS.size.min}
                  aria-valuemax={ASSUMPTIONS.size.max}
                  aria-valuenow={sqft}
                  aria-describedby="adu-size-note"
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setSqft(next);
                    scheduleRent(address, next, ASSUMPTIONS.rent.debounceMs);
                  }}
                />
                <p id="adu-size-note" className="text-sm leading-6 text-ink-soft">
                  {bedroomLabel(beds)}. Rent checks use the nearest {ASSUMPTIONS.rent.snapSqft} sqft
                  {snapped === sqft ? " — this size." : ` (${snapped.toLocaleString("en-US")} sqft).`}
                </p>
              </div>

              <div className="mt-6" role="radiogroup" aria-label="Finish level">
                <p className="text-sm font-medium">Finish</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {FINISH_LEVELS.map((level) => (
                    <label
                      key={level.id}
                      className={`cursor-pointer rounded-2xl border px-3 py-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-pine ${finish === level.id ? "border-pine bg-pine-soft" : "border-line bg-white"}`}
                    >
                      <input
                        type="radio"
                        name="finish"
                        value={level.id}
                        checked={finish === level.id}
                        onChange={() => setFinish(level.id)}
                        className="sr-only"
                      />
                      <span className="block text-sm font-semibold">{level.title}</span>
                      <span className="mt-1 block text-xs leading-5 text-ink-soft">{level.text}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <label htmlFor="adu-rent" className="text-sm font-medium">
                  ADU monthly rent
                </label>
                <div className="mt-1 flex min-h-12 items-center rounded-xl border border-line bg-white focus-within:border-pine focus-within:ring-2 focus-within:ring-pine">
                  <span className="pl-3 text-ink-soft">$</span>
                  <input
                    id="adu-rent"
                    inputMode="decimal"
                    value={rentOverride ?? String(monthlyRent)}
                    onChange={(event) => setRentOverride(event.target.value)}
                    className="min-h-12 w-full bg-transparent px-2 text-base outline-none"
                  />
                </div>
                <p className="mt-1 text-sm leading-6 text-ink-soft">{rentNote ?? rentHint}</p>
                {rentOverride !== null ? (
                  <button
                    type="button"
                    className="mt-2 text-sm font-semibold text-pine underline-offset-2 hover:underline"
                    onClick={() => {
                      setRentOverride(null);
                      overrideRef.current = null;
                      scheduleRent(address, sqft, 0);
                    }}
                  >
                    Use the estimated rent
                  </button>
                ) : null}
              </div>
            </fieldset>
          </div>

          <ResultsPanel estimate={estimate} />
        </div>
      </section>
      <LeadForm addressHint={address} snapshot={snapshot} />
    </>
  );
}

function FactField({
  id,
  label,
  value,
  onChange,
  suffix,
  prefix,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  prefix?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="mt-1 flex min-h-12 items-center rounded-xl border border-line bg-white focus-within:border-pine focus-within:ring-2 focus-within:ring-pine">
        {prefix ? <span className="pl-3 text-ink-soft">{prefix}</span> : null}
        <input
          id={id}
          value={value}
          inputMode={suffix || prefix ? "decimal" : "text"}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-12 w-full bg-transparent px-3 text-base outline-none"
        />
        {suffix ? <span className="pr-3 text-sm text-ink-soft">{suffix}</span> : null}
      </div>
    </div>
  );
}
