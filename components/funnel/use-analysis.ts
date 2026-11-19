"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RentLookup } from "@/lib/api-types";
import { ASSUMPTIONS, bedroomsForSqft, snapSqft, type FinishLevelId, type ProjectTypeId } from "@/lib/assumptions";
import { calculateEstimate, fallbackMonthlyRent, type RentalUse, type RentSource } from "@/lib/calculate";
import { dollars, parsePositive } from "@/lib/money";
import type { ConfirmedProperty, ReportInputs } from "@/lib/report";

type RentHit = { rent: number; rentRangeLow: number | null; rentRangeHigh: number | null };
type MarketNumbers = { adr: number; occupancy: number };

/**
 * Calculator state for one confirmed property: project choices, the RentCast
 * rent for the chosen size (fetched once per 50 sqft step, debounced), the
 * short-term market numbers once the phone is verified, and the estimate.
 */
export function useAnalysis(property: ConfirmedProperty) {
  const [projectType, setProjectTypeState] = useState<ProjectTypeId>("detached_adu");
  const [finish, setFinish] = useState<FinishLevelId>("premium");
  const [sqft, setSqft] = useState(ASSUMPTIONS.size.defaults.detached_adu);
  const [rentOverride, setRentOverride] = useState<string | null>(null);
  const [rentByKey, setRentByKey] = useState<Record<string, RentHit>>({});
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [rentNote, setRentNote] = useState<string | null>(null);
  const [rentalUse, setRentalUse] = useState<RentalUse>("long_term");
  const [occupancyPercent, setOccupancyPercentState] = useState(Math.round(ASSUMPTIONS.shortTerm.defaultOccupancy * 100));
  const [nightlyOverride, setNightlyOverride] = useState<string | null>(null);
  const [market, setMarket] = useState<MarketNumbers | null>(null);
  const occupancyTouched = useRef(false);
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
    homeSquareFootage: property.squareFootage,
    homeValue: property.homeValue,
    lotSize: property.lotSize,
    rentalUse,
    strOccupancy: occupancyPercent / 100,
    strNightlyRate: nightlyTyped ?? market?.adr ?? null,
  };
  const estimate = calculateEstimate(inputs);

  const onMarketNumbers = useCallback((numbers: MarketNumbers | null) => {
    setMarket(numbers);
    if (numbers && !occupancyTouched.current) setOccupancyPercentState(Math.round(numbers.occupancy * 100));
  }, []);

  return {
    estimate,
    inputs,
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
    setRentalUse,
    occupancyPercent,
    setOccupancyPercent(value: number) {
      occupancyTouched.current = true;
      setOccupancyPercentState(value);
    },
    nightlyOverride,
    setNightlyOverride,
    usingAirroi: market != null && nightlyOverride == null,
    onMarketNumbers,
  };
}

export type Analysis = ReturnType<typeof useAnalysis>;
