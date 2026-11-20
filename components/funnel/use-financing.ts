"use client";

import { useEffect, useRef, useState } from "react";
import { FINANCING, type FinancingInputs, type FinancingPlan } from "@/lib/financing";
import { parseNumber } from "@/lib/money";

/** Text as typed in the financing fields. Rates are in percent here and fractions once saved. */
export type FinancingDraft = {
  homeValue: string;
  mortgageBalance: string;
  currentRate: string;
  currentPayment: string;
  refiRate: string;
  unsecuredRate: string;
  unsecuredYears: string;
};
export type FinancingField = keyof FinancingDraft;

const money = (value: number | null | undefined) => (value == null ? "" : Math.round(value).toLocaleString("en-US"));
const percent = (value: number | null | undefined) => (value == null ? "" : String(Math.round(value * 10000) / 100));

function amount(text: string): number | null {
  const value = parseNumber(text);
  return value != null && value >= 0 ? value : null;
}

function rate(text: string): number | null {
  const value = parseNumber(text.replace("%", ""));
  return value != null && value > 0 && value < 40 ? value / 100 : null;
}

type Prefill = { homeValue: number | null; mortgageBalance: number | null; currentRate: number | null; currentPayment: number | null };

/**
 * Financing state for the builder. Today's 30-year rate loads from Freddie Mac;
 * in the team builder the mortgage on record fills in too. Anything typed stays typed.
 */
export function useFinancing(homeValue: number | null, saved: FinancingInputs | null | undefined, teamReportId: string | null) {
  const [plan, setPlan] = useState<FinancingPlan>(saved?.plan ?? "refinance");
  const [draft, setDraft] = useState<FinancingDraft>({
    homeValue: money(saved ? saved.homeValue : homeValue),
    mortgageBalance: money(saved?.mortgageBalance),
    currentRate: percent(saved?.currentRate),
    currentPayment: money(saved?.currentPayment),
    // A rate filled in from the weekly average (older reports) starts over at the default; a typed one stays.
    refiRate: percent(saved?.refiRate != null && saved.refiRateAsOf == null ? saved.refiRate : FINANCING.defaultRefiRate),
    unsecuredRate: percent(saved?.unsecuredRate ?? FINANCING.unsecuredRate),
    unsecuredYears: String(saved?.unsecuredYears ?? FINANCING.unsecuredYears),
  });
  const [market, setMarket] = useState<{ rate: number; asOf: string } | null>(null);
  const [onRecord, setOnRecord] = useState<{ openLoans: number } | null>(null);
  const touched = useRef(new Set<FinancingField>(saved ? (Object.keys(draft) as FinancingField[]) : []));

  // This week's Freddie Mac average, shown next to the rate for comparison.
  useEffect(() => {
    let live = true;
    fetch("/api/rates")
      .then((response) => response.json() as Promise<{ ok: boolean; market: { rate: number; asOf: string } | null }>)
      .then((data) => {
        if (live && data.market) setMarket(data.market);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  // Team builder: the mortgage on record, for any field nobody has typed in.
  useEffect(() => {
    if (!teamReportId || saved) return;
    let live = true;
    fetch(`/api/team/reports/${teamReportId}/financials`)
      .then((response) => response.json() as Promise<{ ok: boolean; openLoans?: number } & Partial<Prefill>>)
      .then((data) => {
        if (!live || !data.ok) return;
        setOnRecord({ openLoans: data.openLoans ?? 0 });
        setDraft((current) => {
          const next = { ...current };
          const fill = (field: FinancingField, value: string) => {
            if (value && !touched.current.has(field)) next[field] = value;
          };
          fill("homeValue", money(data.homeValue));
          fill("mortgageBalance", money(data.mortgageBalance));
          fill("currentRate", percent(data.currentRate));
          fill("currentPayment", money(data.currentPayment));
          return next;
        });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [saved, teamReportId]);

  const inputs: FinancingInputs = {
    plan,
    homeValue: amount(draft.homeValue),
    mortgageBalance: amount(draft.mortgageBalance),
    currentRate: rate(draft.currentRate),
    currentPayment: amount(draft.currentPayment),
    refiRate: rate(draft.refiRate),
    refiRateAsOf: null,
    unsecuredRate: rate(draft.unsecuredRate),
    unsecuredYears: amount(draft.unsecuredYears),
  };

  return {
    plan,
    setPlan,
    draft,
    setField(field: FinancingField, value: string) {
      touched.current.add(field);
      setDraft((current) => ({ ...current, [field]: value }));
    },
    /** The property's value changed; follow it while this field still matches the old value or was never typed in. */
    followHomeValue(value: string, previous: string) {
      setDraft((current) =>
        !touched.current.has("homeValue") || amount(current.homeValue) === amount(previous) ? { ...current, homeValue: value } : current,
      );
    },
    market,
    useMarketRate() {
      if (market) setDraft((current) => ({ ...current, refiRate: percent(market.rate) }));
    },
    onRecord,
    inputs,
  };
}

export type FinancingState = ReturnType<typeof useFinancing>;
