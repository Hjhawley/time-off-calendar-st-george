import { WEEKDAY_NAMES, weeksInMonth } from "./dates.js";

/**
 * Calculate which pay period a date falls into
 * Pay periods are 2 weeks, starting January 1st of the year
 * @param {Date} date - The date to check
 * @returns {number} - Pay period number (1-indexed)
 */
function getPayPeriodNumber(date) {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  // Round, not floor: DST transition days are 23 or 25 hours long
  const daysSinceStart = Math.round((date - startOfYear) / (1000 * 60 * 60 * 24));
  return Math.floor(daysSinceStart / 14) + 1;
}

/**
 * Mentor class - represents a mentor and their scheduling constraints
 */
class Mentor {
  constructor(name, hoursWantedPerWeek, unavailableDates, unavailableWeekdays, preferredWeekday) {
    this.name = name;
    this.hoursWantedPerWeek = hoursWantedPerWeek;
    this.unavailableDates = unavailableDates.map((d) => parseInt(d));
    this.unavailableWeekdays = unavailableWeekdays || [];
    this.preferredWeekday = preferredWeekday || null;

    this.hoursAssigned = 0;
    this.hoursPerPayPeriod = {}; // { payPeriodNum: hours }
    this.daysWorked = new Set();
  }

  /**
   * Check if mentor can legally work a shift
   * @param {number} dayOfMonth - Day number
   * @param {string} weekdayName - Name of weekday (Monday, Tuesday, etc.)
   * @param {number} shiftHours - Hours for this shift
   * @param {number} payPeriodNum - Current pay period number
   * @returns {{canWork: boolean, reason: string|null}}
   */
  canWork(dayOfMonth, weekdayName, shiftHours, payPeriodNum) {
    if (this.unavailableDates.includes(dayOfMonth)) {
      return { canWork: false, reason: "requested_off" };
    }

    if (this.unavailableWeekdays.includes(weekdayName)) {
      return { canWork: false, reason: "unavailable_weekday" };
    }

    if (this.daysWorked.has(dayOfMonth)) {
      return { canWork: false, reason: "already_working_today" };
    }

    const currentPayPeriodHours = this.hoursPerPayPeriod[payPeriodNum] || 0;
    if (currentPayPeriodHours + shiftHours > 80) {
      return { canWork: false, reason: "80hr_limit" };
    }

    return { canWork: true, reason: null };
  }

  assignShift(dayOfMonth, shiftHours, payPeriodNum) {
    this.hoursAssigned += shiftHours;
    this.hoursPerPayPeriod[payPeriodNum] = (this.hoursPerPayPeriod[payPeriodNum] || 0) + shiftHours;
    this.daysWorked.add(dayOfMonth);
  }

  removeShift(dayOfMonth, shiftHours, payPeriodNum) {
    this.hoursAssigned -= shiftHours;
    this.hoursPerPayPeriod[payPeriodNum] = (this.hoursPerPayPeriod[payPeriodNum] || 0) - shiftHours;
    this.daysWorked.delete(dayOfMonth);
  }

  /**
   * Get percentage of target hours achieved
   * @param {number} numWeeksInMonth
   * @returns {number}
   */
  getPercentageOfTarget(numWeeksInMonth) {
    const targetTotal = this.hoursWantedPerWeek * numWeeksInMonth;
    if (targetTotal === 0) return 100;
    return (this.hoursAssigned / targetTotal) * 100;
  }
}

/**
 * Day class - represents a single day with its shifts
 */
class Day {
  constructor(date, shifts, isHoliday = false) {
    this.dateInfo = date;
    this.dayOfMonth = date.getDate();
    this.weekdayName = WEEKDAY_NAMES[date.getDay()];
    this.shifts = shifts; // { a_shift: hours, b_shift: hours, c_shift: hours }
    this.isHoliday = isHoliday;
    this.payPeriodNum = getPayPeriodNumber(date);

    // { shiftName: Mentor | null }
    this.mentorsOnShift = {};
    for (const shiftName in shifts) {
      this.mentorsOnShift[shiftName] = null;
    }

    this.totalHours = Object.values(shifts).reduce((sum, h) => sum + h, 0);
    this.assignedHours = 0;
  }

  /**
   * Get list of unfilled shifts, prioritizing A & B over C
   * @returns {string[]}
   */
  getUnfilledShifts() {
    const unfilled = [];
    const shiftOrder = ["a_shift", "b_shift", "holiday_a_shift", "holiday_b_shift", "c_shift"];

    for (const shiftName of shiftOrder) {
      if (this.shifts[shiftName] !== undefined && this.mentorsOnShift[shiftName] === null) {
        unfilled.push(shiftName);
      }
    }

    for (const shiftName in this.shifts) {
      if (!shiftOrder.includes(shiftName) && this.mentorsOnShift[shiftName] === null) {
        unfilled.push(shiftName);
      }
    }

    return unfilled;
  }

  assignMentor(shiftName, mentor) {
    this.mentorsOnShift[shiftName] = mentor;
    const hours = this.shifts[shiftName];
    this.assignedHours += hours;
    mentor.assignShift(this.dayOfMonth, hours, this.payPeriodNum);
  }
}

/**
 * Schedule class - main scheduler
 */
class Schedule {
  constructor(year, month, seasonalShiftInfo, mentorInfoData, holidays) {
    this.year = year;
    this.month = month; // 1-indexed
    this.seasonalShiftInfo = seasonalShiftInfo;

    this.holidays = holidays || { dates: [], shift_info: {} };
    if (!this.holidays.dates) this.holidays.dates = [];
    if (!this.holidays.shift_info) this.holidays.shift_info = {};

    this.season = this.getSeason(month);
    this.numWeeksInMonth = weeksInMonth(year, month);

    this.mentors = this.createMentors(mentorInfoData);
    this.assignedDays = this.createDays();

    this.validationMessages = [];
    this.generateSchedule();
  }

  /**
   * Determine season based on month
   * @param {number} month - 1-indexed month
   * @returns {string}
   */
  getSeason(month) {
    const summerMonths = [5, 6, 7]; // May, June, July
    return summerMonths.includes(month) ? "summer" : "winter";
  }

  createMentors(mentorInfoData) {
    const mentors = [];

    for (const [name, info] of Object.entries(mentorInfoData)) {
      if (info.include_in_scheduling === false) continue;

      mentors.push(
        new Mentor(
          name,
          info.hours_wanted || 0,
          info.hard_dates || [],
          info.weekdays || [],
          info.preferred_weekdays && info.preferred_weekdays.length > 0
            ? info.preferred_weekdays[0]
            : null
        )
      );
    }

    return mentors;
  }

  createDays() {
    const days = [];
    const daysInMonth = new Date(this.year, this.month, 0).getDate();

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const date = new Date(this.year, this.month - 1, dayNum);
      const weekdayName = WEEKDAY_NAMES[date.getDay()];

      const isHoliday = this.holidays.dates.includes(dayNum);

      let shifts;
      if (isHoliday && Object.keys(this.holidays.shift_info).length > 0) {
        shifts = { ...this.holidays.shift_info };
      } else {
        const seasonInfo = this.seasonalShiftInfo[this.season];
        if (seasonInfo && seasonInfo.shift_info && seasonInfo.shift_info[weekdayName]) {
          shifts = { ...seasonInfo.shift_info[weekdayName] };
        } else {
          console.warn(`No shift info found for ${this.season} ${weekdayName}`);
          shifts = {};
        }
      }

      days.push(new Day(date, shifts, isHoliday));
    }

    return days;
  }

  generateSchedule() {
    this.validationMessages.push("Starting schedule generation...");
    this.validationMessages.push(`Month: ${this.month}/${this.year}, Season: ${this.season}`);
    this.validationMessages.push(`Mentors: ${this.mentors.map((m) => m.name).join(", ")}`);

    this.validationMessages.push("\n--- Phase 1: Preferred Weekday Assignments ---");
    this.assignPreferredWeekdays();

    this.validationMessages.push("\n--- Phase 2: Equal Distribution Fill ---");
    this.fillWithEqualDistribution();

    this.validationMessages.push("\n--- Phase 3: Force Fill Remaining ---");
    this.forceFillRemaining();

    this.validationMessages.push("\n--- Final Statistics ---");
    this.calculateFinalStats();

    this.validationMessages.push("\n✓ Schedule generation complete");
  }

  /**
   * Phase 1: Assign mentors to their preferred weekdays
   */
  assignPreferredWeekdays() {
    const mentorsWithPreference = this.mentors.filter((m) => m.preferredWeekday);

    if (mentorsWithPreference.length === 0) {
      this.validationMessages.push("No mentors have preferred weekdays set.");
      return;
    }

    for (const mentor of mentorsWithPreference) {
      this.validationMessages.push(`  ${mentor.name} prefers ${mentor.preferredWeekday}`);

      const preferredDays = this.assignedDays.filter(
        (d) => d.weekdayName === mentor.preferredWeekday
      );

      for (const day of preferredDays) {
        const unfilledShifts = day.getUnfilledShifts();
        if (unfilledShifts.length === 0) continue;

        const shiftName = unfilledShifts[0];
        const shiftHours = day.shifts[shiftName];

        const { canWork, reason } = mentor.canWork(
          day.dayOfMonth,
          day.weekdayName,
          shiftHours,
          day.payPeriodNum
        );

        if (canWork) {
          day.assignMentor(shiftName, mentor);
          this.validationMessages.push(
            `    ✓ Assigned ${mentor.name} to day ${day.dayOfMonth} ${shiftName}`
          );
        } else {
          this.validationMessages.push(
            `    ✗ Cannot assign ${mentor.name} to day ${day.dayOfMonth}: ${reason}`
          );
        }
      }
    }
  }

  /**
   * Phase 2: Fill remaining shifts with equal distribution
   * Give hours at the same rate until everyone reaches their target
   */
  fillWithEqualDistribution() {
    let totalAssigned = 0;
    let iterations = 0;
    const maxIterations = 1000;

    // Slots only ever get filled, so collect once and drop filled ones as we go
    let unfilledSlots = [];
    for (const day of this.assignedDays) {
      for (const shiftName of day.getUnfilledShifts()) {
        unfilledSlots.push({ day, shiftName });
      }
    }

    while (iterations < maxIterations) {
      iterations++;

      unfilledSlots = unfilledSlots.filter(
        ({ day, shiftName }) => day.mentorsOnShift[shiftName] === null
      );

      if (unfilledSlots.length === 0) {
        this.validationMessages.push("All shifts filled!");
        break;
      }

      const sortedMentors = [...this.mentors].sort(
        (a, b) =>
          a.getPercentageOfTarget(this.numWeeksInMonth) -
          b.getPercentageOfTarget(this.numWeeksInMonth)
      );

      const allAtTarget = sortedMentors.every(
        (m) => m.getPercentageOfTarget(this.numWeeksInMonth) >= 100
      );

      let assignedThisRound = false;

      for (const mentor of sortedMentors) {
        if (!allAtTarget && mentor.getPercentageOfTarget(this.numWeeksInMonth) >= 100) {
          continue;
        }

        for (const slot of unfilledSlots) {
          const { day, shiftName } = slot;

          if (day.mentorsOnShift[shiftName] !== null) continue;

          const { canWork } = mentor.canWork(
            day.dayOfMonth,
            day.weekdayName,
            day.shifts[shiftName],
            day.payPeriodNum
          );

          if (canWork) {
            day.assignMentor(shiftName, mentor);
            totalAssigned++;
            assignedThisRound = true;
            break;
          }
        }
      }

      if (!assignedThisRound) {
        this.validationMessages.push(
          `Stuck after ${iterations} iterations with ${unfilledSlots.length} slots remaining`
        );
        break;
      }
    }

    this.validationMessages.push(`Assigned ${totalAssigned} shifts in ${iterations} iterations`);
  }

  /**
   * Phase 3: Force fill any remaining empty slots
   */
  forceFillRemaining() {
    const forcedAssignments = [];

    for (const day of this.assignedDays) {
      for (const shiftName of day.getUnfilledShifts()) {
        const shiftHours = day.shifts[shiftName];

        let assigned = false;

        const sortedMentors = [...this.mentors].sort((a, b) => a.hoursAssigned - b.hoursAssigned);

        for (const mentor of sortedMentors) {
          const { canWork } = mentor.canWork(
            day.dayOfMonth,
            day.weekdayName,
            shiftHours,
            day.payPeriodNum
          );

          if (canWork) {
            day.assignMentor(shiftName, mentor);
            forcedAssignments.push({ day: day.dayOfMonth, shift: shiftName, mentor: mentor.name });
            assigned = true;
            break;
          }
        }

        if (!assigned) {
          forcedAssignments.push({ day: day.dayOfMonth, shift: shiftName, mentor: null });
          this.validationMessages.push(
            `⚠ Day ${day.dayOfMonth} ${shiftName}: UNFILLABLE - all mentors unavailable`
          );
        }
      }
    }

    if (forcedAssignments.length > 0) {
      const filled = forcedAssignments.filter((a) => a.mentor !== null);
      const unfilled = forcedAssignments.filter((a) => a.mentor === null);

      this.validationMessages.push(`Force-filled ${filled.length} slots`);
      if (unfilled.length > 0) {
        this.validationMessages.push(`⚠ ${unfilled.length} slots could not be filled`);
      }
    } else {
      this.validationMessages.push("No force-filling needed");
    }
  }

  /**
   * Phase 4: Calculate and log final statistics
   */
  calculateFinalStats() {
    for (const mentor of this.mentors) {
      const targetMonthly = mentor.hoursWantedPerWeek * this.numWeeksInMonth;
      const pct = mentor.getPercentageOfTarget(this.numWeeksInMonth);
      const diff = mentor.hoursAssigned - targetMonthly;
      const diffStr = diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
      const marker = Math.abs(diff) > 5 ? "⚠" : "✓";

      this.validationMessages.push(
        `  ${marker} ${mentor.name}: ${mentor.hoursAssigned.toFixed(1)}h / ${targetMonthly.toFixed(1)}h target (${diffStr}h, ${pct.toFixed(0)}%)`
      );
    }

    let unfilled = 0;
    for (const day of this.assignedDays) {
      unfilled += day.getUnfilledShifts().length;
    }

    if (unfilled > 0) {
      this.validationMessages.push(`\n⚠ ${unfilled} shifts remain unfilled`);
    } else {
      this.validationMessages.push(`\n✓ All shifts filled`);
    }
  }
}

export { Schedule, Day, Mentor, getPayPeriodNumber };
