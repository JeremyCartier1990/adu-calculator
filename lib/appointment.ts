// Meeting requests from the report: online or at the property, a day, and a start time in Pacific time.
// The team confirms by email, so this only has to be a clear, valid request.

export const TIME_ZONE = "America/Los_Angeles";
/** How many bookable days are offered, starting tomorrow. Sundays are skipped. */
export const BOOKING_DAYS = 10;

/** Online is a 30-minute video call; on site, an expert spends about an hour at the property. Online comes first. */
export const MEETING_TYPES = [
  { id: "online", label: "Online", detail: "Video call", minutes: 30 },
  { id: "onsite", label: "At my property", detail: "Site visit", minutes: 60 },
] as const;

export type MeetingType = (typeof MEETING_TYPES)[number]["id"];

export const meetingType = (id: MeetingType) => MEETING_TYPES.find((type) => type.id === id)!;

// Meetings start on the half hour from 10 am, and every one ends by 6 pm.
const FIRST_START = 10 * 60;
const LAST_END = 18 * 60;
const SLOT_MINUTES = 30;

const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Start times as HH:MM: 10:00 to 17:30 online, 10:00 to 17:00 on site. */
export function startTimes(type: MeetingType): string[] {
  const count = (LAST_END - meetingType(type).minutes - FIRST_START) / SLOT_MINUTES + 1;
  return Array.from({ length: count }, (_, i) => hhmm(FIRST_START + i * SLOT_MINUTES));
}

export type Appointment = { type: MeetingType; date: string; time: string; note: string | null };

/** "10:30 am" for "10:30". */
export function timeLabel(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "am" : "pm"}`;
}

/** When a meeting starting at `time` ends, as HH:MM. */
export function endTime(type: MeetingType, time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  return hhmm(hours * 60 + minutes + meetingType(type).minutes);
}

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

export function parseAppointment(input: unknown, now = new Date()): Appointment | null {
  if (!input || typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  const date = typeof record.date === "string" ? record.date : "";
  // Requests from before the choice existed were all online.
  const type = record.type === undefined ? "online" : MEETING_TYPES.find((option) => option.id === record.type)?.id;
  if (!type) return null;
  const time = startTimes(type).find((start) => start === record.time);
  if (!time || !bookableDays(now).includes(date)) return null;
  const note = typeof record.note === "string" && record.note.trim() ? record.note.trim().slice(0, 500) : null;
  return { type, date, time, note };
}
