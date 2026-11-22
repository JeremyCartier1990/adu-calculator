import assert from "node:assert/strict";
import test from "node:test";
import { bookableDays, dayLabel, parseAppointment, pacificToday } from "./appointment";

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

test("only an offered day and a known window are accepted", () => {
  assert.deepEqual(parseAppointment({ date: "2026-11-23", window: "morning", note: "  garage  " }, now), {
    date: "2026-11-23",
    window: "morning",
    note: "garage",
  });
  assert.equal(parseAppointment({ date: "2026-11-20", window: "morning" }, now), null, "today is too soon");
  assert.equal(parseAppointment({ date: "2026-11-22", window: "morning" }, now), null, "Sunday");
  assert.equal(parseAppointment({ date: "2026-11-23", window: "night" }, now), null);
  assert.equal(parseAppointment(null, now), null);
});
