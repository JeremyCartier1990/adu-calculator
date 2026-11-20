"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RentLookup } from "@/lib/api-types";
import { ASSUMPTIONS, bedroomsForSqft, normalizeFinish, snapSqft, type FinishLevelId, type ProjectTypeId } from "@/lib/assumptions";
import { fallbackMonthlyRent, type RentSource } from "@/lib/calculate";
import { dollars, parseNumber, parsePositive } from "@/lib/money";
import type { LatLng } from "@/lib/footprint";
import { bestSetup } from "@/lib/optimize";
import { useFinancing } from "./use-financing";
import { estimateReport, parsePropertyFacts, type ConfirmedProperty, type PropertyFacts, type ReportInputs } from "@/lib/report";
import type { FactKey, Facts } from "./shared";

const FACT_KEYS: FactKey[] = ["squareFootage", "lotSize", "bedrooms", "bathrooms", "yearBuilt", "homeValue"];
const factText = (key: FactKey, value: number | null) =>
  value == null ? "" : key === "yearBuilt" ? String(value) : value.toLocaleString("en-US");

type RentHit = { rent: number; rentRangeLow: number | null; rentRangeHigh: number | null };
type MarketNumbers = { adr: number; occupancy: number };

/**
 * Calculator state for one confirmed property: project choices, the RentCast
 * rent for the chosen size (fetched once per 50 sqft step, debounced), the
 * short-term market numbers once the phone is verified, and the estimate.
 */
export function useAnalysis(property: ConfirmedProperty, saved: ReportInputs | null = null, teamReportId: string | null = null) {
  // A new report opens on the best setup for this property; a saved one reopens as it was left.
  const [opening] = useState(() =>
    saved
      ? null
      : bestSetup({ homeSquareFootage: property.squareFootage, homeValue: property.homeValue, lotSize: property.lotSize }),
  );
  const [projectType, setProjectTypeState] = useState<ProjectTypeId>(saved?.projectType ?? opening!.projectType);
  const [finish, setFinish] = useState<FinishLevelId>(normalizeFinish(saved?.finish) ?? opening!.finish);
  const [sqft, setSqft] = useState(saved?.sqft ?? opening!.sqft);
  // Saved choices reopen as they were; a rent the homeowner typed stays typed.
  const [rentOverride, setRentOverride] = useState<string | null>(
    saved?.rentSource === "manual" ? String(saved.monthlyRent) : null,
  );
  const [rentByKey, setRentByKey] = useState<Record<string, RentHit>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);
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
  const financing = useFinancing(property.homeValue, saved?.financing, teamReportId);
  const occupancyTouched = useRef(saved?.strOccupancy != null);
  const inflight = useRef(new Set<string>());

  const live = property.source === "rentcast";
  const beds = bedroomsForSqft(sqft);
  const snapped = snapSqft(sqft);
  const rentKey = `${snapped}|${beds}`;
  const hit = live ? rentByKey[rentKey] : undefined;

  // Debounced RentCast rent for the current size; cached per size step.
  useEffect(() => {
    if (!live || rentOverride !== null || rentByKey[rentKey] || inflight.current.has(rentKey)) return;
    const timer = setTimeout(() => {
      inflight.current.add(rentKey);
      setPendingKey(rentKey);
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
          setRentByKey((current) => ({
            ...current,
            [rentKey]: { rent: data.rent, rentRangeLow: data.rentRangeLow, rentRangeHigh: data.rentRangeHigh },
          }));
        })
        .catch(() => setRentNote("The rent estimate didn't load. A planning rate is filled in; edit it if you know the rent."))
        .finally(() => {
          inflight.current.delete(rentKey);
          setPendingKey((current) => (current === rentKey ? null : current));
        });
    }, ASSUMPTIONS.rent.debounceMs);
    return () => clearTimeout(timer);
  }, [beds, live, property.address, rentByKey, rentKey, rentOverride, snapped]);

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
    strNightlyRate: nightlyTyped ?? market?.adr ?? null,
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
    setFact(key: FactKey, value: string) {
      // The financing uses the same home value unless a different one was typed there.
      if (key === "homeValue") financing.followHomeValue(value, factDraft.homeValue);
      setFactDraft((current) => ({ ...current, [key]: value }));
    },
    projectType,
    setProjectType(next: ProjectTypeId) {
      setProjectTypeState(next);
      setSqft(ASSUMPTIONS.size.defaults[next]);
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
    rentPending: pendingKey === rentKey,
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
