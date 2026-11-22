"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { bookableDays, dayLabel, MEETING_TYPES, meetingType, startTimes, timeLabel, type MeetingType } from "@/lib/appointment";
import { readAttribution } from "@/lib/attribution";
import { BRAND } from "@/lib/brand";

type Requested = { type: MeetingType; date: string; time: string };

type ReportKey = { id: string; editKey: string | null };

const storeKey = (id: string) => `meeting-request-${id}`;

// The request is kept in this browser, so every button and a reload show what was booked.
const listeners = new Set<() => void>();
const memory = new Map<string, string | null>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

function readStored(id: string): string | null {
  try {
    return window.localStorage.getItem(storeKey(id));
  } catch {
    return memory.get(id) ?? null;
  }
}

function writeStored(id: string, value: string | null) {
  memory.set(id, value);
  try {
    if (value) window.localStorage.setItem(storeKey(id), value);
    else window.localStorage.removeItem(storeKey(id));
  } catch {}
  listeners.forEach((listener) => listener());
}

function parseRequested(stored: string | null): Requested | null {
  try {
    const parsed = stored ? (JSON.parse(stored) as Partial<Requested>) : null;
    if (!parsed?.date || !parsed.time) return null;
    return { type: parsed.type === "onsite" ? "onsite" : "online", date: parsed.date, time: parsed.time };
  } catch {
    return null;
  }
}

/** "Tue, Nov 24 at 10:30 am" */
const whenLabel = (requested: Requested, style: "short" | "long" = "short") => `${dayLabel(requested.date, style)} at ${timeLabel(requested.time)}`;

/**
 * The meeting the homeowner asked for, shared by every button that opens the booking.
 * Without an edit key (a shared link), the report's private id is enough to ask.
 */
export function useMeetingRequest(report: ReportKey | null) {
  const [open, setOpen] = useState(false);
  const id = report?.id ?? null;
  const stored = useSyncExternalStore(
    subscribe,
    () => (id ? readStored(id) : null),
    () => null,
  );
  const requested = useMemo(() => parseRequested(stored), [stored]);
  return {
    report,
    open,
    setOpen,
    requested,
    setRequested(next: Requested | null) {
      if (id) writeStored(id, next ? JSON.stringify(next) : null);
    },
  };
}

export type MeetingRequest = ReturnType<typeof useMeetingRequest>;

/** Short text for the sticky buttons: what to click, or what's already booked. */
export function meetingButtonLabel(meeting: MeetingRequest): string {
  if (!meeting.requested) return "Book a free meeting";
  return `${meeting.requested.type === "onsite" ? "Visit" : "Meeting"} ${dayLabel(meeting.requested.date)}, ${timeLabel(meeting.requested.time)}`;
}

/** "Online meeting requested" or "Site visit requested". */
const requestedTitle = (type: MeetingType) => (type === "onsite" ? "Site visit" : "Online meeting");

export function HomeIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 7.5L8 2.5l6 5M3.5 6.5V13.5h9V6.5M6.5 13.5V10h3v3.5" />
    </svg>
  );
}

const TypeIcon = ({ type, className }: { type: MeetingType; className?: string }) =>
  type === "onsite" ? <HomeIcon className={className} /> : <VideoIcon className={className} />;

export function VideoIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1.5" y="4" width="9" height="8" rx="1.5" />
      <path d="M10.5 7l4-2.2v6.4l-4-2.2" />
    </svg>
  );
}

/** In the report: what the meeting is, and the button that opens the booking. */
export function MeetingPitch({ meeting }: { meeting: MeetingRequest }) {
  return (
    <div id="book-call" className="scroll-mt-24 border-b border-line bg-paper p-5 sm:p-8 lg:px-10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
        <div className="max-w-2xl">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-pine">
            <VideoIcon className="h-3.5 w-3.5" />
            Online or at your property · Free
          </p>
          <h3 className="mt-2 font-display text-2xl leading-tight text-ink sm:text-3xl">Go over this report with an ADU expert</h3>
          <p className="mt-2 text-base leading-7 text-ink-soft">
            Meet {BRAND.builder} on a {meetingType("online").minutes}-minute video call, or have an expert come to your property. We walk
            through every number with you, answer your questions, and tailor the report to your project.
          </p>
        </div>
        {meeting.requested ? (
          <div className="shrink-0 rounded-xl border border-pine/30 bg-pine/10 p-4 lg:max-w-sm" role="status">
            <p className="text-base font-semibold text-ink">{requestedTitle(meeting.requested.type)} requested</p>
            <p className="mt-1 text-sm leading-6 text-ink">{whenLabel(meeting.requested, "long")} Pacific</p>
            <button type="button" onClick={() => meeting.setOpen(true)} className="mt-1 min-h-10 text-sm font-semibold text-pine hover:underline">
              Change the time
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => meeting.setOpen(true)}
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-pine px-6 text-base font-semibold text-white hover:bg-pine/90"
          >
            <VideoIcon />
            Pick a day and time
          </button>
        )}
      </div>
    </div>
  );
}

/** The booking itself: online or on site, a day, a start time between 10 am and 6 pm Pacific, and an optional note. */
export function MeetingDialog({ meeting }: { meeting: MeetingRequest }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { open, setOpen, report } = meeting;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="meeting-heading"
      onCancel={(event) => {
        event.preventDefault();
        setOpen(false);
      }}
      onClick={(event) => {
        // A click on the backdrop closes it.
        if (event.target === event.currentTarget) setOpen(false);
      }}
      className="step-dialog m-auto max-h-[92svh] w-[min(640px,calc(100vw-24px))] overflow-y-auto rounded-[28px] border border-line bg-surface p-0 text-ink shadow-[0_40px_120px_rgba(12,13,12,0.35)] backdrop:bg-ink/55 backdrop:backdrop-blur-sm max-sm:mb-0 max-sm:max-h-[94svh] max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:pb-[env(safe-area-inset-bottom)]"
    >
      {open && report ? <MeetingForm meeting={meeting} report={report} /> : null}
    </dialog>
  );
}

function MeetingForm({ meeting, report }: { meeting: MeetingRequest; report: ReportKey }) {
  const [days] = useState(() => bookableDays());
  const [done, setDone] = useState(false);
  const [date, setDate] = useState(meeting.requested && days.includes(meeting.requested.date) ? meeting.requested.date : days[0]);
  const [type, setType] = useState<MeetingType>(meeting.requested?.type ?? "online");
  const [time, setTime] = useState<string | null>(null);
  const times = startTimes(type);
  const chosen = meetingType(type);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!time) {
      setError("Pick a time.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/reports/${report.id}/appointment`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(report.editKey ? { "x-edit-key": report.editKey } : {}) },
        body: JSON.stringify({ type, date, time, note, attribution: readAttribution() }),
      });
      const data = (await response.json()) as { ok: boolean; message?: string };
      if (!data.ok) {
        setError(data.message ?? "That didn't go through. Try again.");
        return;
      }
      meeting.setRequested({ type, date, time });
      setDone(true);
    } catch {
      setError("That didn't go through. Try again.");
    } finally {
      setPending(false);
    }
  }

  const close = () => meeting.setOpen(false);

  if (done && meeting.requested) {
    return (
      <div className="p-6 sm:p-8" role="status">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-pine/15 text-pine">
          <TypeIcon type={meeting.requested.type} className="h-6 w-6" />
        </span>
        <h2 id="meeting-heading" className="mt-4 font-display text-2xl leading-tight text-ink sm:text-3xl">
          Your {requestedTitle(meeting.requested.type).toLowerCase()} is requested
        </h2>
        <p className="mt-2 text-lg text-ink">{whenLabel(meeting.requested, "long")} Pacific</p>
        <p className="mt-2 text-base leading-7 text-ink-soft">
          {meeting.requested.type === "onsite"
            ? "We'll confirm by email. An ADU expert comes to your property, looks at the lot with you, and goes through this report together."
            : "We'll confirm by email with the video call link. Join from your computer or phone; no app to install. Keep this report open on the call, and we'll go through it together."}
        </p>
        <button type="button" onClick={close} className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-ink px-6 text-base font-semibold text-white hover:bg-ink/85 sm:w-auto">
          Back to my report
        </button>
      </div>
    );
  }

  return (
    <form
      className="min-w-0"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line p-5 sm:p-6">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-pine">
            <TypeIcon type={type} className="h-3.5 w-3.5" />
            {chosen.detail} · {chosen.minutes} min · Free
          </p>
          <h2 id="meeting-heading" className="mt-2 font-display text-2xl leading-tight text-ink sm:text-3xl">
            Book a meeting with an ADU expert
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-ink-soft">
            Someone from {BRAND.builder} goes through your report with you, answers your questions, and customizes the numbers to your
            project.
          </p>
        </div>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-white text-ink hover:border-ink"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      <div className="p-5 sm:p-6">
        <fieldset>
          <legend className="text-sm font-semibold text-ink">How would you like to meet?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {MEETING_TYPES.map((option) => {
              const selected = option.id === type;
              return (
                <label
                  key={option.id}
                  className={`relative flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ink/10 ${
                    selected ? "border-pine bg-pine/10 ring-1 ring-pine" : "border-line bg-white hover:border-ink"
                  }`}
                >
                  <input
                    type="radio"
                    name="meeting-type"
                    value={option.id}
                    checked={selected}
                    onChange={() => {
                      setType(option.id);
                      // A visit runs longer, so a late online start may not fit.
                      if (time && !startTimes(option.id).includes(time)) setTime(null);
                    }}
                    className="sr-only"
                  />
                  <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${selected ? "bg-pine text-white" : "bg-paper text-ink"}`}>
                    <TypeIcon type={option.id} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{option.label}</span>
                    <span className="block text-xs text-ink-soft">
                      {option.detail} · {option.minutes} min
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-5 min-w-0">
          <legend className="text-sm font-semibold text-ink">Day</legend>
          <div className="-mx-5 mt-2 flex snap-x gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">
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
                  <input type="radio" name="meeting-day" value={day} checked={selected} onChange={() => setDate(day)} className="sr-only" />
                  <span className={`text-xs ${selected ? "text-white/70" : "text-ink-soft"}`}>{weekday}</span>
                  <span className="text-sm font-semibold">{rest.join(", ")}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="text-sm font-semibold text-ink">
            Time <span className="font-normal text-ink-soft">(Pacific time)</span>
          </legend>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {times.map((start) => {
              const selected = start === time;
              return (
                <label
                  key={start}
                  className={`relative flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-2 text-sm font-semibold tabular-nums transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ink/10 ${
                    selected ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"
                  }`}
                >
                  <input
                    type="radio"
                    name="meeting-time"
                    value={start}
                    checked={selected}
                    onChange={() => {
                      setTime(start);
                      setError(null);
                    }}
                    className="sr-only"
                  />
                  {timeLabel(start)}
                </label>
              );
            })}
          </div>
        </fieldset>

        <label className="mt-5 block">
          <span className="text-sm font-semibold text-ink">
            What should we cover? <span className="font-normal text-ink-soft">(optional)</span>
          </span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Financing, a rental for income, space for family, permits in my city…"
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
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-pine px-6 text-base font-semibold text-white hover:bg-pine/90 disabled:opacity-60"
        >
          <TypeIcon type={type} />
          {pending ? "Booking…" : time ? `Book ${type === "onsite" ? "a visit" : "online"} ${dayLabel(date)} at ${timeLabel(time)} PT` : "Pick a time"}
        </button>
        <p className="mt-2 text-center text-xs text-ink-soft">
          {type === "onsite" ? "At the address on this report." : "We'll email you the video call link."} Free, no obligation.
        </p>
      </div>
    </form>
  );
}

/** The read-only report a shared link opens: the meeting pitch, a button pinned to the bottom, and the booking. */
export function ReportMeeting({ reportId }: { reportId: string }) {
  const meeting = useMeetingRequest({ id: reportId, editKey: null });
  return (
    <div className="no-print">
      <div className="overflow-hidden rounded-xl border border-line">
        <MeetingPitch meeting={meeting} />
      </div>
      <div className="fixed inset-x-3 bottom-3 z-30 pb-[env(safe-area-inset-bottom)] sm:inset-x-auto sm:bottom-6 sm:right-6">
        <button
          type="button"
          onClick={() => meeting.setOpen(true)}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-pine px-5 text-sm font-semibold text-white shadow-lg ring-1 ring-white/25 hover:bg-pine/90"
        >
          <VideoIcon />
          <span className="truncate">{meetingButtonLabel(meeting)}</span>
        </button>
      </div>
      <MeetingDialog meeting={meeting} />
    </div>
  );
}
