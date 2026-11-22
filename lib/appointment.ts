// Call requests from the report: a day and a time window in Pacific time.
// The team confirms by phone, so this only has to be a clear, valid request.

export const TIME_ZONE = "America/Los_Angeles";
/** How many bookable days are offered, starting tomorrow. Sundays are skipped. */
export const BOOKING_DAYS = 10;

export const WINDOWS = [
  { id: "morning", label: "Morning", hours: "9 am – 12 pm", start: "09:00", end: "12:00" },
  { id: "midday", label: "Midday", hours: "12 – 3 pm", start: "12:00", end: "15:00" },
  { id: "afternoon", label: "Afternoon", hours: "3 – 6 pm", start: "15:00", end: "18:00" },
] as const;

export type WindowId = (typeof WINDOWS)[number]["id"];
export type Appointment = { date: string; window: WindowId; note: string | null };

/** Today's date in Pacific time, as YYYY-MM-DD. */
export function pacificToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function addDays(date: string, days: number): string {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

const isSunday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay() === 0;

/** The days a homeowner can pick: tomorrow onward, Monday to Saturday. */
export function bookableDays(now = new Date()): string[] {
  const today = pacificToday(now);
  const days: string[] = [];
  for (let offset = 1; days.length < BOOKING_DAYS; offset++) {
    const date = addDays(today, offset);
    if (!isSunday(date)) days.push(date);
  }
  return days;
}

/** "Tue, Nov 24" for a YYYY-MM-DD date. */
export function dayLabel(date: string, style: "short" | "long" = "short"): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: style,
    month: style,
    day: "numeric",
  });
}

export function windowFor(id: WindowId) {
  return WINDOWS.find((window) => window.id === id)!;
}

export function parseAppointment(input: unknown, now = new Date()): Appointment | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const date = typeof record.date === "string" ? record.date : "";
  const window = WINDOWS.find((option) => option.id === record.window)?.id;
  if (!window || !bookableDays(now).includes(date)) return null;
  const note = typeof record.note === "string" && record.note.trim() ? record.note.trim().slice(0, 500) : null;
  return { date, window, note };
}
