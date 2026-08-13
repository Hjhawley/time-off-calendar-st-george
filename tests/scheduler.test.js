import { test } from "node:test";
import assert from "node:assert/strict";
import { Schedule, Mentor, getPayPeriodNumber } from "../scheduler.js";

const SHIFT_INFO = {
  summer: {
    shift_info: {
      Sunday: { a_shift: 10, b_shift: 10 },
      Monday: { a_shift: 8, b_shift: 8, c_shift: 5 },
      Tuesday: { a_shift: 7, b_shift: 7, c_shift: 4 },
      Wednesday: { a_shift: 7, b_shift: 7 },
      Thursday: { a_shift: 7, b_shift: 7, c_shift: 4 },
      Friday: { a_shift: 8, b_shift: 8, c_shift: 4 },
      Saturday: { a_shift: 11, b_shift: 11, c_shift: 4 },
    },
  },
  winter: {
    shift_info: {
      Sunday: { a_shift: 9, b_shift: 9 },
      Monday: { a_shift: 7, b_shift: 7, c_shift: 5 },
      Tuesday: { a_shift: 6, b_shift: 6, c_shift: 4 },
      Wednesday: { a_shift: 6, b_shift: 6 },
      Thursday: { a_shift: 6, b_shift: 6, c_shift: 4 },
      Friday: { a_shift: 8, b_shift: 8, c_shift: 4 },
      Saturday: { a_shift: 11, b_shift: 11, c_shift: 4 },
    },
  },
};

const MENTORS = {
  Aidri: { hours_wanted: 30, hard_dates: [2, 5, 9], weekdays: [], preferred_weekdays: [] },
  Avree: { hours_wanted: 30, hard_dates: [], weekdays: ["Wednesday"], preferred_weekdays: ["Monday"] },
  Emma: { hours_wanted: 16, hard_dates: [1, 2, 3], weekdays: [], preferred_weekdays: [] },
  HayLee: { hours_wanted: 30, hard_dates: [], weekdays: [], preferred_weekdays: [] },
  Sofia: { hours_wanted: 24, hard_dates: [], weekdays: ["Sunday"], preferred_weekdays: ["Friday"] },
  Hidden: { hours_wanted: 40, hard_dates: [], weekdays: [], preferred_weekdays: [], show_on_calendar: false },
  Inactive: { hours_wanted: 40, hard_dates: [], weekdays: [], preferred_weekdays: [], include_in_scheduling: false },
};

function makeSchedule(year = 2026, month = 1) {
  return new Schedule(year, month, SHIFT_INFO, MENTORS, { shift_info: {}, dates: [] });
}

test("pay periods are 14 days from January 1", () => {
  assert.equal(getPayPeriodNumber(new Date(2026, 0, 1)), 1);
  assert.equal(getPayPeriodNumber(new Date(2026, 0, 14)), 1);
  assert.equal(getPayPeriodNumber(new Date(2026, 0, 15)), 2);
  assert.equal(getPayPeriodNumber(new Date(2026, 0, 28)), 2);
  assert.equal(getPayPeriodNumber(new Date(2026, 0, 29)), 3);
});

test("pay period boundaries are correct across DST transitions", () => {
  assert.equal(getPayPeriodNumber(new Date(2026, 2, 11)), 5);
  assert.equal(getPayPeriodNumber(new Date(2026, 2, 12)), 6);
  assert.equal(getPayPeriodNumber(new Date(2026, 6, 2)), 14);
  assert.equal(getPayPeriodNumber(new Date(2026, 9, 22)), 22);
});

test("canWork blocks requested days off", () => {
  const m = new Mentor("Test", 30, [5, 10], [], null);
  assert.equal(m.canWork(5, "Monday", 8, 1).canWork, false);
  assert.equal(m.canWork(5, "Monday", 8, 1).reason, "requested_off");
  assert.equal(m.canWork(6, "Monday", 8, 1).canWork, true);
});

test("canWork blocks unavailable weekdays", () => {
  const m = new Mentor("Test", 30, [], ["Wednesday"], null);
  assert.equal(m.canWork(5, "Wednesday", 8, 1).canWork, false);
  assert.equal(m.canWork(5, "Wednesday", 8, 1).reason, "unavailable_weekday");
  assert.equal(m.canWork(5, "Thursday", 8, 1).canWork, true);
});

test("canWork blocks a second shift the same day", () => {
  const m = new Mentor("Test", 30, [], [], null);
  m.assignShift(5, 8, 1);
  assert.equal(m.canWork(5, "Monday", 8, 1).reason, "already_working_today");
});

test("canWork enforces the 80 hour pay period cap", () => {
  const m = new Mentor("Test", 80, [], [], null);
  for (let d = 1; d <= 9; d++) m.assignShift(d, 8, 1);
  assert.equal(m.canWork(10, "Monday", 9, 1).reason, "80hr_limit");
  assert.equal(m.canWork(10, "Monday", 8, 1).canWork, true);
  assert.equal(m.canWork(10, "Monday", 9, 2).canWork, true);
});

test("removeShift reverses assignShift", () => {
  const m = new Mentor("Test", 30, [], [], null);
  m.assignShift(5, 8, 1);
  m.removeShift(5, 8, 1);
  assert.equal(m.hoursAssigned, 0);
  assert.equal(m.canWork(5, "Monday", 8, 1).canWork, true);
});

test("generated schedule never assigns a mentor on their requested days off", () => {
  const s = makeSchedule();
  for (const day of s.assignedDays) {
    for (const mentor of Object.values(day.mentorsOnShift)) {
      if (!mentor) continue;
      const info = MENTORS[mentor.name];
      assert.ok(
        !(info.hard_dates || []).includes(day.dayOfMonth),
        `${mentor.name} scheduled on requested day off ${day.dayOfMonth}`
      );
    }
  }
});

test("generated schedule never assigns a mentor on their unavailable weekdays", () => {
  const s = makeSchedule();
  for (const day of s.assignedDays) {
    for (const mentor of Object.values(day.mentorsOnShift)) {
      if (!mentor) continue;
      const info = MENTORS[mentor.name];
      assert.ok(
        !(info.weekdays || []).includes(day.weekdayName),
        `${mentor.name} scheduled on unavailable ${day.weekdayName}`
      );
    }
  }
});

test("generated schedule assigns at most one shift per mentor per day", () => {
  const s = makeSchedule();
  for (const day of s.assignedDays) {
    const names = Object.values(day.mentorsOnShift)
      .filter(Boolean)
      .map((m) => m.name);
    assert.equal(new Set(names).size, names.length, `duplicate on day ${day.dayOfMonth}`);
  }
});

test("generated schedule keeps every mentor at or under 80 hours per pay period", () => {
  const s = makeSchedule();
  const hours = {};
  for (const day of s.assignedDays) {
    const pp = getPayPeriodNumber(day.dateInfo);
    for (const [shift, mentor] of Object.entries(day.mentorsOnShift)) {
      if (!mentor) continue;
      hours[mentor.name] = hours[mentor.name] || {};
      hours[mentor.name][pp] = (hours[mentor.name][pp] || 0) + day.shifts[shift];
    }
  }
  for (const [name, perPeriod] of Object.entries(hours)) {
    for (const [pp, h] of Object.entries(perPeriod)) {
      assert.ok(h <= 80, `${name} has ${h}h in pay period ${pp}`);
    }
  }
});

test("hiding a mentor from the employee calendar does not exclude them from scheduling", () => {
  const s = makeSchedule();
  assert.ok(s.mentors.some((m) => m.name === "Hidden"));
  const assigned = s.assignedDays.some((day) =>
    Object.values(day.mentorsOnShift).some((m) => m?.name === "Hidden")
  );
  assert.ok(assigned, "Hidden (40h wanted, no constraints) was never scheduled");
});

test("mentors with include_in_scheduling false are never scheduled", () => {
  const s = makeSchedule();
  assert.ok(!s.mentors.some((m) => m.name === "Inactive"));
  for (const day of s.assignedDays) {
    for (const mentor of Object.values(day.mentorsOnShift)) {
      assert.notEqual(mentor?.name, "Inactive");
    }
  }
});

test("no-scheduling days have no shifts and get no assignments", () => {
  const s = new Schedule(2026, 1, SHIFT_INFO, MENTORS, { shift_info: {}, dates: [] }, [5, 6]);
  for (const dayNum of [5, 6]) {
    const day = s.assignedDays.find((d) => d.dayOfMonth === dayNum);
    assert.equal(day.isNoMentorDay, true);
    assert.deepEqual(day.shifts, {});
    assert.deepEqual(Object.values(day.mentorsOnShift), []);
  }
  const day7 = s.assignedDays.find((d) => d.dayOfMonth === 7);
  assert.ok(Object.keys(day7.shifts).length > 0);
});

test("a no-scheduling day overrides a holiday on the same date", () => {
  const s = new Schedule(
    2026,
    1,
    SHIFT_INFO,
    MENTORS,
    { shift_info: { holiday_a_shift: 9, holiday_b_shift: 9 }, dates: [5] },
    [5]
  );
  const day = s.assignedDays.find((d) => d.dayOfMonth === 5);
  assert.equal(day.isHoliday, false);
  assert.deepEqual(day.shifts, {});
});

test("holiday dates use holiday shifts", () => {
  const s = new Schedule(2026, 1, SHIFT_INFO, MENTORS, {
    shift_info: { holiday_a_shift: 9, holiday_b_shift: 9 },
    dates: [1],
  });
  const day1 = s.assignedDays.find((d) => d.dayOfMonth === 1);
  assert.deepEqual(Object.keys(day1.shifts).sort(), ["holiday_a_shift", "holiday_b_shift"]);
  const day2 = s.assignedDays.find((d) => d.dayOfMonth === 2);
  assert.ok("a_shift" in day2.shifts);
});

test("schedule exposes canonical fields only (aliases removed)", () => {
  const s = makeSchedule();
  assert.equal(s.m1, undefined);
  assert.equal(s.m2, undefined);
  assert.equal(s.pay1, undefined);
  assert.equal(s.pay2, undefined);
  assert.ok(Array.isArray(s.mentors));
  assert.ok(Array.isArray(s.assignedDays));
  const day = s.assignedDays[0];
  assert.equal(day.assignments, undefined);
  assert.ok(day.dateInfo instanceof Date);
  const mentor = s.mentors[0];
  assert.equal(mentor.hardDates, undefined);
  assert.equal(mentor.hoursPay, undefined);
  assert.ok(Array.isArray(mentor.unavailableDates));
});
