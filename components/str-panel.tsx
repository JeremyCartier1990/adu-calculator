"use client";

import { useEffect, useState } from "react";
import type { StrEstimate } from "@/lib/airroi";
import { ASSUMPTIONS, guestsForBedrooms } from "@/lib/assumptions";
import { formatMoney } from "@/lib/money";

type MarketNumbers = { adr: number; occupancy: number };

type StrPanelProps = {
  latitude: number | null;
  longitude: number | null;
  bedrooms: number;
  onMarketNumbers: (numbers: MarketNumbers | null) => void;
  onVerifiedPhone: (phone: string | null) => void;
};

type StatusResponse = {
  ok: true;
  twilio: boolean;
  airroi: boolean;
  verified: boolean;
  phone: string | null;
  team?: boolean;
};

export function StrPanel({ latitude, longitude, bedrooms, onMarketNumbers, onVerifiedPhone }: StrPanelProps) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [market, setMarket] = useState<StrEstimate | null>(null);
  const [marketNote, setMarketNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/verify/status")
      .then((response) => response.json())
      .then((data: StatusResponse) => {
        if (cancelled) return;
        setStatus(data);
        if (data.verified && data.phone) {
          setPhone(data.phone);
          onVerifiedPhone(data.phone);
        }
      })
      .catch(() => {
        if (!cancelled) setStatus({ ok: true, twilio: false, airroi: false, verified: false, phone: null });
      });
    return () => {
      cancelled = true;
    };
  }, [onVerifiedPhone]);

  const allowed = Boolean(status?.airroi && (status.verified || status.team));

  useEffect(() => {
    if (!allowed || latitude == null || longitude == null) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch("/api/str", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          latitude,
          longitude,
          bedrooms,
          baths: ASSUMPTIONS.rent.bathrooms,
          guests: guestsForBedrooms(bedrooms),
        }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const data = (await response.json()) as {
            ok?: boolean;
            code?: string;
            message?: string;
            estimate?: StrEstimate;
          };
          if (!data.ok || !data.estimate) {
            setMarket(null);
            onMarketNumbers(null);
            setMarketNote(data.message ?? "Short-term market data didn't load. The planning estimate is still here.");
            return;
          }
          setMarket(data.estimate);
          onMarketNumbers({ adr: data.estimate.adr, occupancy: data.estimate.occupancy });
          setMarketNote(null);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setMarketNote("Short-term market data didn't load. The planning estimate is still here.");
        });
    }, 800);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [allowed, bedrooms, latitude, longitude, onMarketNumbers]);

  async function sendCode() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/verify/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string };
      if (!data.ok) {
        setMessage(data.message ?? "We couldn't send that text.");
        return;
      }
      setSent(true);
      setMessage("We sent a code by text.");
    } catch {
      setMessage("We couldn't send that text.");
    } finally {
      setPending(false);
    }
  }

  async function checkCode() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/verify/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = (await response.json()) as { ok?: boolean; message?: string; phone?: string };
      if (!data.ok || !data.phone) {
        setMessage(data.message ?? "That code didn't match.");
        return;
      }
      setStatus((current) =>
        current ? { ...current, verified: true, phone: data.phone ?? phone } : current,
      );
      onVerifiedPhone(data.phone);
      setMessage("Phone verified. Nearby short-term data can load for this home.");
    } catch {
      setMessage("We couldn't check that code.");
    } finally {
      setPending(false);
    }
  }

  const shownMarket = allowed && latitude != null && longitude != null ? market : null;

  return (
    <div className="mt-4 rounded-lg border border-line bg-paper px-3 py-3">
      <p className="text-sm font-medium">Nearby short-term data</p>
      {status == null ? (
        <p className="mt-1 text-sm text-ink-soft">Checking verification…</p>
      ) : !status.airroi ? (
        <p className="mt-1 text-sm leading-6 text-ink-soft">
          AirROI isn&apos;t connected in this environment, so the nightly rate and occupancy are planning estimates.
        </p>
      ) : allowed ? (
        <p className="mt-1 text-sm leading-6 text-ink-soft">
          {status.verified ? `Verified ${status.phone}.` : "Team access: AirROI comps load for this address."}
        </p>
      ) : !status.twilio ? (
        <p className="mt-1 text-sm leading-6 text-ink-soft">
          Text verification is not connected in this environment, so the nightly figure stays a planning estimate.
        </p>
      ) : !status.verified ? (
        <div className="mt-2 space-y-2">
          <p className="text-sm leading-6 text-ink-soft">
            Verify a mobile number to load AirROI comps for this ADU. Until then, the nightly number is a planning estimate.
          </p>
          <label htmlFor="verify-phone" className="text-sm font-medium">
            Mobile number
          </label>
          <input
            id="verify-phone"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="min-h-12 w-full rounded-lg border border-line bg-white px-3 text-base outline-none focus:border-pine focus:ring-2 focus:ring-pine"
          />
          {sent ? (
            <>
              <label htmlFor="verify-code" className="text-sm font-medium">
                Text code
              </label>
              <input
                id="verify-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="min-h-12 w-full rounded-lg border border-line bg-white px-3 text-base outline-none focus:border-pine focus:ring-2 focus:ring-pine"
              />
            </>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={pending}
              onClick={() => void sendCode()}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-pine px-4 text-sm font-semibold text-white disabled:opacity-70"
            >
              {sent ? "Send a new code" : "Text me a code"}
            </button>
            {sent ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => void checkCode()}
                className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-semibold disabled:opacity-70"
              >
                Verify code
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {latitude == null || longitude == null ? (
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          A property lookup with a map point is required before a paid short-term search. The sample preview does not spend that credit.
        </p>
      ) : null}
      {message ? <p className="mt-2 text-sm text-ink-soft">{message}</p> : null}
      {marketNote ? <p className="mt-2 text-sm text-ink-soft">{marketNote}</p> : null}
      {shownMarket ? <MarketDetails estimate={shownMarket} /> : null}
    </div>
  );
}

function MarketDetails({ estimate }: { estimate: StrEstimate }) {
  const peak = Math.max(...estimate.months.map((month) => month.revenue), 1);
  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm leading-6 text-ink-soft">
        AirROI estimate for an entire-home ADU. This is market data, separate from the planning costs used in payback.
      </p>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-white px-3 py-2">
          <dt className="text-ink-soft">ADR</dt>
          <dd className="font-semibold tabular-nums">{formatMoney(estimate.adr)}</dd>
        </div>
        <div className="rounded-xl bg-white px-3 py-2">
          <dt className="text-ink-soft">Occupancy</dt>
          <dd className="font-semibold tabular-nums">{Math.round(estimate.occupancy * 100)}%</dd>
        </div>
        <div className="rounded-xl bg-white px-3 py-2">
          <dt className="text-ink-soft">Monthly revenue</dt>
          <dd className="font-semibold tabular-nums">{formatMoney(estimate.monthlyRevenue)}</dd>
        </div>
        <div className="rounded-xl bg-white px-3 py-2">
          <dt className="text-ink-soft">Annual revenue</dt>
          <dd className="font-semibold tabular-nums">{formatMoney(estimate.annualRevenue)}</dd>
        </div>
      </dl>
      <p className="text-xs leading-5 text-ink-soft">
        Annual revenue range {formatBand(estimate.percentiles.revenue)} · ADR range {formatBand(estimate.percentiles.adr)} ·
        Occupancy p25–p90 {percent(estimate.percentiles.occupancy.p25)}–{percent(estimate.percentiles.occupancy.p90)}
      </p>
      {estimate.months.length === 12 ? (
        <div>
          <p className="text-sm font-medium">Seasonality</p>
          <div className="mt-2 grid grid-cols-12 gap-1" aria-hidden="true">
            {estimate.months.map((month) => (
              <div key={month.label} className="flex flex-col items-center justify-end">
                <div className="flex h-16 w-full items-end">
                  <div className="w-full rounded-sm bg-pine" style={{ height: `${Math.max(8, (month.revenue / peak) * 100)}%` }} />
                </div>
                <span className="mt-1 text-[10px] text-ink-soft">{month.label.slice(0, 1)}</span>
              </div>
            ))}
          </div>
          <ul className="mt-2 grid grid-cols-3 gap-x-3 text-xs text-ink-soft sm:grid-cols-4">
            {estimate.months.map((month) => (
              <li key={month.label}>
                {month.label} {formatMoney(month.revenue)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <p className="text-sm font-medium">Based on {estimate.compCount} similar listings nearby</p>
        <ul className="mt-2 space-y-2">
          {estimate.comps.map((comp) => (
            <li key={`${comp.name}-${comp.revenue}`} className="rounded-xl bg-white px-3 py-2 text-sm">
              <span className="font-medium">{comp.name}</span>
              <span className="mt-1 block text-ink-soft">
                {comp.bedrooms == null ? "Bedrooms n/a" : `${comp.bedrooms} bd`}
                {comp.adr == null ? "" : ` · ${formatMoney(comp.adr)} ADR`}
                {comp.occupancy == null ? "" : ` · ${Math.round(comp.occupancy * 100)}% occupied`}
                {comp.revenue == null ? "" : ` · ${formatMoney(comp.revenue)} / year`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function percent(value: number | null): string {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

function formatBand(band: { p25: number | null; p90: number | null }): string {
  if (band.p25 == null || band.p90 == null) return "—";
  return `${formatMoney(band.p25)}–${formatMoney(band.p90)}`;
}
