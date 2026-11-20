"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowBox } from "@/components/eyebrow";
import { AnalysisSection } from "@/components/funnel/analysis";
import { AddressInput } from "@/components/funnel/address-input";
import { postJson, type SavedReport } from "@/components/funnel/shared";
import { validateAddress } from "@/lib/address";
import type { PropertyLookup } from "@/lib/api-types";
import { rememberEditKey } from "@/lib/report-keys";
import type { ConfirmedProperty } from "@/lib/report";

type Built = { property: ConfirmedProperty; report: SavedReport | null; note: string | null };

/**
 * Team builder in one step: pick an address and the report opens, with public
 * records filled in. No lead form, no phone check; facts and ADU settings are
 * all adjustable in the builder itself.
 */
export function TeamBuilder() {
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [built, setBuilt] = useState<Built | null>(null);
  const addressRef = useRef<HTMLInputElement>(null);

  async function build(raw: string) {
    const parsed = validateAddress(raw, { californiaOnly: false });
    if (!parsed.ok) {
      setError(parsed.message);
      addressRef.current?.focus();
      return;
    }
    setError(null);
    setPending(true);
    setBuilt(null);
    try {
      setStatus("Looking up the property…");
      const lookup = await postJson<PropertyLookup>("/api/property", { address: parsed.address }).catch(() => null);
      const found = lookup?.ok ? lookup : null;
      const property: ConfirmedProperty = {
        address: found?.formattedAddress ?? parsed.address,
        squareFootage: found?.property.squareFootage ?? null,
        lotSize: found?.property.lotSize ?? null,
        bedrooms: found?.property.bedrooms ?? null,
        bathrooms: found?.property.bathrooms ?? null,
        yearBuilt: found?.property.yearBuilt ?? null,
        propertyType: found?.property.propertyType ?? null,
        homeValue: found?.value.price ?? null,
        latitude: found?.property.latitude ?? null,
        longitude: found?.property.longitude ?? null,
        source: found ? "rentcast" : "manual",
        edited: [],
      };
      setAddress(property.address);

      setStatus("Creating the report…");
      const data = await postJson<{ ok: boolean; id?: string; editKey?: string; message?: string }>("/api/team/reports", { property });
      if (data.ok && data.id && data.editKey) {
        rememberEditKey(data.id, data.editKey);
        setBuilt({ property, report: { id: data.id, editKey: data.editKey }, note: null });
      } else {
        setBuilt({ property, report: null, note: data.message ?? "This report couldn't be saved; the analysis still works." });
      }
      setStatus(found ? null : "No public records for this address, so the estimate uses planning defaults.");
    } catch {
      setError("Something went wrong. Try again.");
      setStatus(null);
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    if (built) document.getElementById("analysis")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [built]);

  return (
    <>
      <section className="mx-auto max-w-[1400px] px-3 pt-3 sm:px-4" aria-label="Team report builder">
        <div className="rounded-2xl border border-line bg-surface px-5 py-10 text-center sm:px-10 sm:py-12">
          <h1 className="font-display text-4xl text-ink sm:text-5xl">Build a client report</h1>
          <p className="mx-auto mt-3 max-w-xl text-ink-soft">Pick an address. The report opens below with public records already filled in.</p>
          <form
            className="mx-auto mt-8 flex max-w-2xl flex-col gap-2 rounded-xl border border-line bg-white p-2 shadow-[0_24px_60px_rgba(31,30,27,0.1)] sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              void build(address);
            }}
          >
            <AddressInput
              value={address}
              onChange={setAddress}
              onPick={(picked) => void build(picked)}
              invalid={Boolean(error)}
              inputRef={addressRef}
              tone="light"
            />
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-13 shrink-0 items-center justify-center gap-3 rounded-lg bg-ink py-2 pl-2 pr-5 text-base font-medium text-white transition hover:bg-ink/85 disabled:cursor-wait disabled:opacity-80"
            >
              <ArrowBox />
              {pending ? "Building…" : "Build report"}
            </button>
          </form>
          <p role="status" className={`mt-3 text-sm ${error ? "text-clay" : "text-ink-soft"}`}>
            {error ?? status ?? "No lead form or phone check. Adjust the ADU in the builder."}
          </p>
        </div>
      </section>

      {built ? <AnalysisSection key={built.report?.id ?? built.property.address} property={built.property} report={built.report} saveNote={built.note} team /> : null}
    </>
  );
}
