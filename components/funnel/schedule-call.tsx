"use client";

import { useState } from "react";
import { bookableDays, dayLabel, WINDOWS, windowFor, type WindowId } from "@/lib/appointment";
import { readAttribution } from "@/lib/attribution";
import { BRAND } from "@/lib/brand";

type Requested = { date: string; window: WindowId };

const storeKey = (id: string) => `call-request-${id}`;

function readRequested(id: string): Requested | null {
  try {
    const stored = window.localStorage.getItem(storeKey(id));
    return stored ? (JSON.parse(stored) as Requested) : null;
  } catch {
    return null;
  }
}

/** Book a call with the team: a day and a time window, sent to the team with the report. */
export function ScheduleCall({ report }: { report: { id: string; editKey: string } }) {
  const [days] = useState(() => bookableDays());
  const [requested, setRequested] = useState<Requested | null>(() => readRequested(report.id));
  const [date, setDate] = useState(days[0]);
  const [slot, setSlot] = useState<WindowId | null>(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!slot) {
      setError("Pick a time of day.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/reports/${report.id}/appointment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-edit-key": report.editKey },
        body: JSON.stringify({ date, window: slot, note, attribution: readAttribution() }),
      });
      const data = (await response.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        setError(data.message ?? "That didn't go through. Try again.");
        return;
      }
      const next = { date, window: slot };
      setRequested(next);
      try {
        window.localStorage.setItem(storeKey(report.id), JSON.stringify(next));
      } catch {}
    } catch {
      setError("That didn't go through. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div id="book-call" className="scroll-mt-24 border-b border-line bg-paper p-5 sm:p-8 lg:px-10">
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:gap-10">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-pine">Free · 20 minutes · No obligation</p>
          <h3 className="mt-2 font-display text-2xl leading-tight text-ink sm:text-3xl">Go over your report with our team</h3>
          <p className="mt-2 max-w-md text-base leading-7 text-ink-soft">
            {BRAND.builder} walks you through the numbers, what fits your lot, and what it would take to build. Pick a time and we&apos;ll
            call you.
          </p>
        </div>

        {requested ? (
          <div className="self-start rounded-xl border border-pine/30 bg-pine/10 p-5" role="status">
            <p className="flex items-center gap-2 text-base font-semibold text-ink">
              <svg viewBox="0 0 16 16" className="h-4 w-4 text-pine" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3.5 8.5l3 3 6-7" />
              </svg>
              Call requested
            </p>
            <p className="mt-1.5 text-base leading-7 text-ink">
              {dayLabel(requested.date, "long")}, {windowFor(requested.window).label.toLowerCase()} ({windowFor(requested.window).hours} Pacific).
            </p>
            <p className="mt-1 text-sm leading-6 text-ink-soft">We&apos;ll call the number you confirmed in that window.</p>
            <button type="button" onClick={() => setRequested(null)} className="mt-2 min-h-10 text-sm font-semibold text-pine hover:underline">
              Pick another time
            </button>
          </div>
        ) : (
          <form
            className="min-w-0"
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <fieldset className="min-w-0">
              <legend className="text-sm font-semibold text-ink">Day</legend>
              <div className="-mx-5 mt-2 flex snap-x gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
                {days.map((day) => {
                  const [weekday, ...rest] = dayLabel(day).split(", ");
                  const selected = day === date;
                  return (
                    <label
                      key={day}
                      className={`relative flex min-h-14 min-w-[4.5rem] shrink-0 cursor-pointer snap-start flex-col items-center justify-center rounded-lg border px-3 text-center transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ink/10 ${
                        selected ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"
                      }`}
                    >
                      <input type="radio" name="call-day" value={day} checked={selected} onChange={() => setDate(day)} className="sr-only" />
                      <span className={`text-xs ${selected ? "text-white/70" : "text-ink-soft"}`}>{weekday}</span>
                      <span className="text-sm font-semibold">{rest.join(", ")}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="mt-4">
              <legend className="text-sm font-semibold text-ink">Time (Pacific)</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {WINDOWS.map((option) => {
                  const selected = option.id === slot;
                  return (
                    <label
                      key={option.id}
                      className={`relative flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-lg border px-2 text-center transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ink/10 ${
                        selected ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"
                      }`}
                    >
                      <input
                        type="radio"
                        name="call-window"
                        value={option.id}
                        checked={selected}
                        onChange={() => {
                          setSlot(option.id);
                          setError(null);
                        }}
                        className="sr-only"
                      />
                      <span className="text-sm font-semibold">{option.label}</span>
                      <span className={`text-xs ${selected ? "text-white/70" : "text-ink-soft"}`}>{option.hours}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <label className="mt-4 block">
              <span className="text-sm font-semibold text-ink">
                Anything we should know? <span className="font-normal text-ink-soft">(optional)</span>
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                rows={2}
                placeholder="A rental for income, space for family, a garage you'd convert…"
                className="mt-1.5 w-full rounded-lg border border-line bg-white px-3 py-2.5 text-base outline-none placeholder:text-ink-soft/60 focus:border-ink focus:ring-4 focus:ring-ink/10"
              />
            </label>

            {error ? (
              <p role="alert" className="mt-2 text-sm text-clay">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-ink px-6 text-base font-semibold text-white hover:bg-ink/85 disabled:opacity-60 sm:w-auto"
            >
              {pending ? "Sending…" : slot ? `Request ${dayLabel(date)}, ${windowFor(slot).label.toLowerCase()}` : "Request a call"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
