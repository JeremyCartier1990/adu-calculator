import assert from "node:assert/strict";
import test from "node:test";
import { bookableDays, dayLabel, endTime, parseAppointment, pacificToday, startTimes, timeLabel } from "./appointment";

// Friday Nov 20, 2026, 11 pm in Los Angeles (already Saturday in UTC).
const now = new Date("2026-11-21T07:00:00Z");

test("bookable days start tomorrow in Pacific time and skip Sundays", () => {
  assert.equal(pacificToday(now), "2026-11-20");
  const days = bookableDays(now);
  assert.equal(days.length, 10);
  assert.equal(days[0], "2026-11-21");
  assert.ok(!days.includes("2026-11-22"), "Sunday is skipped");
  assert.equal(dayLabel("2026-11-23"), "Mon, Nov 23");
});

test("meetings start every half hour from 10 am, the last one ending at 6 pm", () => {
  const online = startTimes("online");
  assert.equal(online[0], "10:00");
  assert.equal(online.at(-1), "17:30");
  assert.equal(online.length, 16);
  assert.equal(endTime("online", "17:30"), "18:00");
  assert.equal(startTimes("onsite").at(-1), "17:00");
  assert.equal(endTime("onsite", "17:00"), "18:00");
  assert.equal(timeLabel("10:00"), "10:00 am");
  assert.equal(timeLabel("12:30"), "12:30 pm");
  assert.equal(timeLabel("17:30"), "5:30 pm");
});

test("only an offered day and start time are accepted", () => {
  assert.deepEqual(parseAppointment({ date: "2026-11-23", time: "10:30", note: "  garage  " }, now), {
    type: "online",
    date: "2026-11-23",
    time: "10:30",
    note: "garage",
  });
  assert.equal(parseAppointment({ date: "2026-11-20", time: "10:30" }, now), null, "today is too soon");
  assert.equal(parseAppointment({ date: "2026-11-22", time: "10:30" }, now), null, "Sunday");
  assert.equal(parseAppointment({ date: "2026-11-23", time: "09:30" }, now), null, "before 10 am");
  assert.equal(parseAppointment({ date: "2026-11-23", time: "18:00" }, now), null, "would end after 6 pm");
  assert.equal(parseAppointment({ type: "onsite", date: "2026-11-23", time: "17:00" }, now)?.type, "onsite");
  assert.equal(parseAppointment({ type: "onsite", date: "2026-11-23", time: "17:30" }, now), null, "a visit would end after 6 pm");
  assert.equal(parseAppointment({ type: "phone", date: "2026-11-23", time: "10:30" }, now), null);
  assert.equal(parseAppointment(null, now), null);
});
