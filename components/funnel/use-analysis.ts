"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RentLookup } from "@/lib/api-types";
import { ASSUMPTIONS, bedroomsForSqft, normalizeFinish, snapSqft, type FinishLevelId, type ProjectTypeId } from "@/lib/assumptions";
import { fallbackMonthlyRent, scaleNightlyRate, scaleRent, type RentSource } from "@/lib/calculate";
import { dollars, parseNumber, parsePositive } from "@/lib/money";
import { footprintSqft, type LatLng } from "@/lib/footprint";
import { bestSetup, openingSetup } from "@/lib/optimize";
import { useFinancing, type ValueRaised } from "./use-financing";
import { estimateReport, parsePropertyFacts, type ConfirmedProperty, type PropertyFacts, type ReportInputs } from "@/lib/report";
import type { FactKey, Facts } from "./shared";

const FACT_KEYS: FactKey[] = ["squareFootage", "lotSize", "bedrooms", "bathrooms", "yearBuilt", "homeValue"];
const factText = (key: FactKey, value: number | null) =>
  value == null ? "" : key === "yearBuilt" ? String(value) : value.toLocaleString("en-US");

type RentHit = { rent: number; rentRangeLow: number | null; rentRangeHigh: number | null };
type RentReference = RentHit & { sqft: number; bedrooms: number };
type MarketNumbers = { adr: number; occupancy: number };

/**
 * Calculator state for one confirmed property: project choices, the RentCast
 * rent for the chosen size (fetched once per 50 sqft step, debounced), the
 * short-term market numbers once the phone is verified, and the estimate.
 */
export function useAnalysis(property: ConfirmedProperty, saved: ReportInputs | null = null, teamReportId: string | null = null) {
  // A new report opens on the ADU type the homeowner picked, or the best setup; a saved one reopens as it was left.
  const [opening] = useState(() =>
    saved
      ? null
      : openingSetup({ homeSquareFootage: property.squareFootage, homeValue: property.homeValue, lotSize: property.lotSize }, property.interest),
  );
  const [projectType, setProjectTypeState] = useState<ProjectTypeId>(saved?.projectType ?? opening!.projectType);
  const [finish, setFinish] = useState<FinishLevelId>(normalizeFinish(saved?.finish) ?? opening!.finish);
  const [sqft, setSqft] = useState(saved?.sqft ?? opening!.sqft);
  // Saved choices reopen as they were; a rent the homeowner typed stays typed.
  const [rentOverride, setRentOverride] = useState<string | null>(
    saved?.rentSource === "manual" ? String(saved.monthlyRent) : null,
  );
  // RentCast's answer for the reference unit at this address; every size is scaled from it.
  const [rentReference, setRentReference] = useState<RentReference | null>(null);
  const [rentPending, setRentPending] = useState(false);
  const [rentNote, setRentNote] = useState<string | null>(null);
  const [occupancyPercent, setOccupancyPercentState] = useState(
    Math.round((saved?.strOccupancy ?? ASSUMPTIONS.shortTerm.defaultOccupancy) * 100),
  );
  const [nightlyOverride, setNightlyOverride] = useState<string | null>(
    saved?.strNightlyRate != null ? String(saved.strNightlyRate) : null,
  );
  const [market, setMarket] = useState<MarketNumbers | null>(null);
  const [footprint, setFootprint] = useState<LatLng[] | null>(saved?.footprint ?? null);
  // Property facts as typed; the report starts from what was confirmed.
  const [factDraft, setFactDraft] = useState<Facts>(
    () => Object.fromEntries(FACT_KEYS.map((key) => [key, factText(key, property[key])])) as Facts,
  );
  const facts: PropertyFacts = parsePropertyFacts(
    Object.fromEntries(FACT_KEYS.map((key) => [key, parseNumber(factDraft[key])])),
  )!;
  const [valueRaised, setValueRaised] = useState<ValueRaised | null>(null);
  const financing = useFinancing(property.homeValue, saved?.financing, teamReportId, (raised) => {
    setFactDraft((current) =>
      parseNumber(current.homeValue) === raised.listed || current.homeValue.trim() === "" ? { ...current, homeValue: factText("homeValue", raised.balance) } : current,
    );
    setValueRaised(raised);
  });
  const occupancyTouched = useRef(saved?.strOccupancy != null);
  const inflight = useRef(false);
  // A lookup that came back empty isn't repeated for other sizes.
  const rentTried = useRef(false);

  const live = property.source === "rentcast";
  const beds = bedroomsForSqft(sqft);
  const snapped = snapSqft(sqft);
  const target = { sqft: snapped, bedrooms: beds };
  const hit: RentHit | undefined =
    live && rentReference
      ? {
          rent: scaleRent(rentReference.rent, rentReference, target),
          rentRangeLow: rentReference.rentRangeLow == null ? null : scaleRent(rentReference.rentRangeLow, rentReference, target),
          rentRangeHigh: rentReference.rentRangeHigh == null ? null : scaleRent(rentReference.rentRangeHigh, rentReference, target),
        }
      : undefined;

  // One RentCast rent per address, fetched once; size changes rescale it without another call.
  useEffect(() => {
    if (!live || rentOverride !== null || rentReference || inflight.current || rentTried.current) return;
    const timer = setTimeout(() => {
      inflight.current = true;
      rentTried.current = true;
      setRentPending(true);
      setRentNote(null);
      fetch("/api/rent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ address: property.address, squareFootage: snapped, bedrooms: beds }),
      })
        .then((response) => response.json() as Promise<RentLookup>)
        .then((data) => {
          if (!data.ok) {
            setRentNote(data.message);
            return;
          }
          setRentReference(data.reference);
        })
        .catch(() => setRentNote("The rent estimate didn't load. A planning rate is filled in; edit it if you know the rent."))
        .finally(() => {
          inflight.current = false;
          setRentPending(false);
        });
    }, ASSUMPTIONS.rent.debounceMs);
    return () => clearTimeout(timer);
  }, [beds, live, property.address, rentReference, rentOverride, snapped]);

  const typedRent = rentOverride == null ? null : parsePositive(rentOverride);
  let monthlyRent: number;
  let rentLow: number | null;
  let rentHigh: number | null;
  let rentSource: RentSource;
  if (typedRent != null) {
    [monthlyRent, rentLow, rentHigh, rentSource] = [typedRent, null, null, "manual"];
  } else if (hit) {
    [monthlyRent, rentLow, rentHigh, rentSource] = [hit.rent, hit.rentRangeLow, hit.rentRangeHigh, "rentcast"];
  } else {
    monthlyRent = fallbackMonthlyRent(sqft, beds);
    rentLow = dollars(monthlyRent * (1 - ASSUMPTIONS.rent.fallbackRange));
    rentHigh = dollars(monthlyRent * (1 + ASSUMPTIONS.rent.fallbackRange));
    rentSource = "assumption";
  }

  const nightlyTyped = nightlyOverride == null ? null : parsePositive(nightlyOverride);
  const inputs: ReportInputs = {
    projectType,
    finish,
    sqft,
    monthlyRent,
    rentLow,
    rentHigh,
    rentSource,
    homeSquareFootage: facts.squareFootage,
    homeValue: facts.homeValue,
    lotSize: facts.lotSize,
    rentalUse: "long_term",
    strOccupancy: occupancyPercent / 100,
    strNightlyRate: nightlyTyped ?? (market ? scaleNightlyRate(market.adr, ASSUMPTIONS.rent.reference.bedrooms, beds) : null),
    footprint,
    financing: financing.inputs,
  };
  const estimate = estimateReport(inputs);

  // The best setup follows any corrected home size, value or lot.
  const best = useMemo(
    () => bestSetup({ homeSquareFootage: facts.squareFootage, homeValue: facts.homeValue, lotSize: facts.lotSize }),
    [facts.squareFootage, facts.homeValue, facts.lotSize],
  );
  const onBest = projectType === best.projectType && finish === best.finish && sqft === best.sqft;

  const onMarketNumbers = useCallback((numbers: MarketNumbers | null) => {
    setMarket(numbers);
    if (numbers && !occupancyTouched.current) setOccupancyPercentState(Math.round(numbers.occupancy * 100));
  }, []);

  return {
    estimate,
    inputs,
    best,
    onBest,
    applyBest() {
      setProjectTypeState(best.projectType);
      setFinish(best.finish);
      setSqft(best.sqft);
    },
    facts,
    factDraft,
    /** Set while the home value still shows the mortgage balance it was raised to. */
    valueRaised: valueRaised && parseNumber(factDraft.homeValue) === valueRaised.balance ? valueRaised : null,
    setFact(key: FactKey, value: string) {
      // The financing uses the same home value unless a different one was typed there.
      if (key === "homeValue") financing.followHomeValue(value, factDraft.homeValue);
      setFactDraft((current) => ({ ...current, [key]: value }));
    },
    projectType,
    setProjectType(next: ProjectTypeId) {
      setProjectTypeState(next);
      // A garage conversion reuses the garage, so a unit drawn in the yard no longer applies.
      if (next === "garage_conversion") {
        setFootprint(null);
        setSqft(ASSUMPTIONS.size.defaults[next]);
        return;
      }
      // Attached or detached, a unit drawn on the map keeps its size.
      setSqft(footprint && footprint.length >= 3 ? footprintSqft(footprint) : ASSUMPTIONS.size.defaults[next]);
    },
    finish,
    setFinish,
    sqft,
    setSqft,
    beds,
    snapped,
    rentOverride,
    setRentOverride,
    rentSource,
    rentPending,
    rentNote,
    occupancyPercent,
    setOccupancyPercent(value: number) {
      occupancyTouched.current = true;
      setOccupancyPercentState(value);
    },
    nightlyOverride,
    setNightlyOverride,
    usingAirroi: market != null && nightlyOverride == null,
    onMarketNumbers,
    footprint,
    setFootprint,
    financing,
  };
}

export type Analysis = ReturnType<typeof useAnalysis>;
