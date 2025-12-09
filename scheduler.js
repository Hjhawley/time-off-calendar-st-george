// JavaScript implementation of the Python scheduler logic

class Mentor {
  constructor(
    name,
    hoursWanted,
    hardDates,
    softDates,
    lenPay,
    preferredWeekdays = []
  ) {
    this.name = name;
    this.hoursWanted = hoursWanted;
    this.hardDates = hardDates.map((d) => parseInt(d));
    this.softDates = softDates.map((d) => parseInt(d));
    this.hoursPay = 0;
    this.daysLeft = lenPay - hardDates.length;
    this.preferredWeekdays = preferredWeekdays;
  }

  legalShiftAdd(shiftLen) {
    return this.hoursPay + shiftLen <= 80;
  }

  getAvailableHours() {
    return this.hoursWanted - this.hoursPay;
  }
}

class Day {
  constructor(dateInfo, seasonalShiftInfo, holidays) {
    this.dateInfo = dateInfo;
    this.weekDayMap = {
      Sunday: 6,
      Monday: 0,
      Tuesday: 1,
      Wednesday: 2,
      Thursday: 3,
      Friday: 4,
      Saturday: 5,
    };
    this.weekday = dateInfo.getDay();
    this.season = this.getSeason();
    this.shifts = this.getShifts(
      this.season,
      this.weekday,
      seasonalShiftInfo,
      holidays
    );
    this.mentorsOnShift = {};

    for (const shift in this.shifts) {
      this.mentorsOnShift[shift] = null;
    }

    this.totalHours = Object.values(this.shifts).reduce((a, b) => a + b, 0);
    this.assignedHours = 0;
    this.potentialMentors = [];
    this.priorityValue = 0;
  }

  getSeason() {
    const month = this.dateInfo.getMonth() + 1; // JS months are 0-indexed
    const summerMonths = [5, 6, 7];
    const winterMonths = [8, 9, 10, 11, 12, 1, 2, 3, 4];

    if (summerMonths.includes(month)) {
      return "summer";
    } else if (winterMonths.includes(month)) {
      return "winter";
    }
    throw new Error("Could not find season that matched given date");
  }

  getShifts(season, dayOfWeek, seasonalShiftInfo, holidays) {
    const day = this.dateInfo.getDate();

    if (holidays.dates.includes(day)) {
      return { ...holidays.shift_info };
    }

    const weekdayNames = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    const weekdayName = weekdayNames[dayOfWeek === 0 ? 6 : dayOfWeek - 1];

    return { ...seasonalShiftInfo[season].shift_info[weekdayName] };
  }

  getMentorDays() {
    return this.potentialMentors.length;
  }

  getAvailableMentorHours() {
    return this.potentialMentors.reduce(
      (sum, mentor) => sum + mentor.getAvailableHours(),
      0
    );
  }

  addPotentialMentor(mentor) {
    this.potentialMentors.push(mentor);
  }

  availableShifts() {
    return Object.values(this.mentorsOnShift).includes(null);
  }

  addShift(mentor) {
    for (const [shift, slot] of Object.entries(this.mentorsOnShift)) {
      if (slot === null) {
        const legalAdd = mentor.legalShiftAdd(this.shifts[shift]);

        if (legalAdd) {
          this.mentorsOnShift[shift] = mentor;
          mentor.hoursPay += this.shifts[shift];
          return true;
        }
        return false;
      }
    }
    throw new Error(
      "Tried to fill shift in full day, this should never happen"
    );
  }

  addLowestShift(mentor) {
    let lowestHours = 100;
    let curShift = null;

    for (const [shift, slot] of Object.entries(this.mentorsOnShift)) {
      if (slot === null) {
        const shiftLen = this.shifts[shift];
        if (shiftLen < lowestHours) {
          lowestHours = shiftLen;
          curShift = shift;
        }
      }
    }

    const legalAdd = mentor.legalShiftAdd(lowestHours);

    if (legalAdd) {
      this.mentorsOnShift[curShift] = mentor;
      mentor.hoursPay += this.shifts[curShift];
      return true;
    }

    return false;
  }

  getWeekdayName() {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    return days[this.dateInfo.getDay()];
  }
}

class Schedule {
  constructor(year, month, lenP1, seasonalShiftInfo, mentorInfo, holidays) {
    this.weekDayMap = {
      Sunday: 6,
      Monday: 0,
      Tuesday: 1,
      Wednesday: 2,
      Thursday: 3,
      Friday: 4,
      Saturday: 5,
    };
    this.lenP1 = lenP1;
    this.month = month;
    this.year = year;
    this.seasonalShiftInfo = seasonalShiftInfo;
    this.mentorInfoData = mentorInfo;
    this.holidays = holidays;

    const lenMonth = new Date(year, month, 0).getDate();

    this.m1 = this.createMentorInfo(lenP1, "<=", lenP1);
    this.pay1 = this.createPayDays(
      this.m1,
      new Date(year, month - 1, 1),
      new Date(year, month - 1, lenP1)
    );
    this.assignedDays = [];

    this.assignAllShifts(this.pay1, this.m1);

    this.m2 = this.createMentorInfo(lenMonth - lenP1, ">", lenP1);
    this.pay2 = this.createPayDays(
      this.m2,
      new Date(year, month - 1, lenMonth - (lenMonth - lenP1) + 1),
      new Date(year, month - 1, lenMonth),
      lenP1
    );

    this.assignAllShifts(this.pay2, this.m2);
  }

  getDatesOfWeekday(day) {
    const lenMonth = new Date(this.year, this.month, 0).getDate();
    let idx = 0;

    for (let i = 0; i < 7; i++) {
      const testDate = new Date(this.year, this.month - 1, i + 1);
      if (this.weekDayMap[day] === testDate.getDay()) {
        idx = i + 1;
        break;
      }
    }

    const dates = [];
    for (let d = idx; d <= lenMonth; d += 7) {
      dates.push(d);
    }
    return dates;
  }

  getAllWeekdayDates(weekdays) {
    let dates = [];
    for (const day of weekdays) {
      dates = dates.concat(this.getDatesOfWeekday(day));
    }
    dates.sort((a, b) => a - b);
    return dates;
  }

  hardDateAdj(hardDates, weekdays, behavior) {
    if (weekdays.length === 0) {
      return hardDates;
    }

    const lenMonth = new Date(this.year, this.month, 0).getDate();
    const allowedDates = this.getAllWeekdayDates(weekdays);

    if (behavior[0] === "Inv") {
      const resDates = [];
      for (let i = 1; i <= lenMonth; i++) {
        if (!allowedDates.includes(i)) {
          resDates.push(i);
        }
      }
      return resDates;
    } else if (behavior[0] === "Pe") {
      return hardDates.filter((date) => !allowedDates.includes(date));
    } else if (behavior[0] === "Re") {
      const combined = [...new Set([...hardDates, ...allowedDates])];
      combined.sort((a, b) => a - b);
      return combined;
    }

    throw new Error(`Got bad behavior keyword ${behavior}`);
  }

  getTruth(inp, relate, cut) {
    const ops = {
      ">": (a, b) => a > b,
      "<": (a, b) => a < b,
      ">=": (a, b) => a >= b,
      "<=": (a, b) => a <= b,
      "==": (a, b) => a === b,
    };
    return ops[relate](inp, cut);
  }

  createMentorInfo(lenPay, comparator, endDay = 1) {
    const mentorList = [];

    for (const [name, info] of Object.entries(this.mentorInfoData)) {
      const cInfo = { ...info };
      const newDates = this.hardDateAdj(
        info.hard_dates,
        info.weekdays,
        info.weekday_behavior
      );

      cInfo.hard_dates = newDates.filter((date) =>
        this.getTruth(date, comparator, endDay)
      );
      cInfo.name = name;
      cInfo.hours_wanted = cInfo.hours_wanted * 2; // 2 weeks
      cInfo.len_pay = lenPay;
      cInfo.preferred_weekdays = info.preferred_weekdays || [];

      const mentor = new Mentor(
        name,
        cInfo.hours_wanted,
        cInfo.hard_dates,
        cInfo.soft_dates,
        lenPay,
        cInfo.preferred_weekdays
      );

      mentorList.push(mentor);
    }

    return mentorList;
  }

  createPayDays(mentors, startDate, endDate, offset = 0) {
    let curDate = new Date(startDate);
    const numDays = endDate.getDate() - startDate.getDate() + 1;
    const days = [];

    while (curDate <= endDate) {
      days.push(
        new Day(new Date(curDate), this.seasonalShiftInfo, this.holidays)
      );
      curDate.setDate(curDate.getDate() + 1);
    }

    for (const mentor of mentors) {
      const availableDays = [];
      for (let i = startDate.getDate(); i <= endDate.getDate(); i++) {
        if (!mentor.hardDates.includes(i)) {
          availableDays.push(i);
        }
      }

      for (const date of availableDays) {
        days[date - offset - 1].addPotentialMentor(mentor);
      }
    }

    return days;
  }

  prioritizeDays(payDays) {
    const totalAvailableDays = payDays.reduce(
      (sum, day) => sum + day.getMentorDays(),
      0
    );

    for (const day of payDays) {
      const basePriority = day.getMentorDays() / (totalAvailableDays + 1);

      if (day.dateInfo.getDay() === 6) {
        // Saturday
        day.priorityValue = -999999;
      } else {
        day.priorityValue = basePriority;
      }
    }

    payDays.sort((a, b) => {
      if (a.priorityValue !== b.priorityValue) {
        return a.priorityValue - b.priorityValue;
      }
      return b.getAvailableMentorHours() - a.getAvailableMentorHours();
    });
  }

  filterSaturdayCandidates(candidates, currentDay, assignedDays) {
    if (
      currentDay.dateInfo.getDay() !== 6 ||
      currentDay.dateInfo.getDate() <= 7
    ) {
      return candidates;
    }

    let previousSaturday = null;
    const sortedDays = [...assignedDays].sort(
      (a, b) => b.dateInfo - a.dateInfo
    );

    for (const day of sortedDays) {
      if (day.dateInfo.getDay() === 6 && day.dateInfo < currentDay.dateInfo) {
        previousSaturday = day;
        break;
      }
    }

    if (!previousSaturday) {
      return candidates;
    }

    const mentorsLastSaturday = new Set(
      Object.values(previousSaturday.mentorsOnShift).filter((m) => m !== null)
    );

    const filtered = candidates.filter(
      (mentor) => !mentorsLastSaturday.has(mentor)
    );
    return filtered.length > 0 ? filtered : candidates;
  }

  assignShift(payDays) {
    const day = payDays[0];
    let updateMentors = true;
    const dayName = day.getWeekdayName();
    const dayNumber = day.dateInfo.getDate();

    // Filter out mentors who have this day as a hard_date (requested off)
    const availableMentors = day.potentialMentors.filter(
      (mentor) => !mentor.hardDates.includes(dayNumber)
    );

    // If no mentors available (all requested off), skip this day
    if (availableMentors.length === 0) {
      console.warn(`No available mentors for day ${dayNumber} (all requested off)`);
      this.assignedDays.push(payDays[0]);
      payDays.shift();
      return null;
    }

    const preferredCandidates = availableMentors.filter((mentor) =>
      mentor.preferredWeekdays.includes(dayName)
    );

    let candidates =
      preferredCandidates.length > 0
        ? preferredCandidates
        : availableMentors;
    candidates = this.filterSaturdayCandidates(
      candidates,
      day,
      this.assignedDays
    );

    let highestPrio = -100;
    let curMentor = null;

    for (const mentor of candidates) {
      const curPrio = mentor.getAvailableHours() / mentor.daysLeft;
      if (curPrio > highestPrio) {
        highestPrio = curPrio;
        curMentor = mentor;
      }
    }

    if (curMentor === null) {
      this.assignedDays.push(payDays[0]);
      payDays.shift();
      return 1;
    }

    let success = day.addShift(curMentor);

    if (!success) {
      updateMentors = false;
      success = day.addLowestShift(curMentor);
      if (!success) {
        const index = day.potentialMentors.indexOf(curMentor);
        if (index > -1) {
          day.potentialMentors.splice(index, 1);
        }
        this.prioritizeDays(payDays);
        return this.assignShift(payDays);
      }
    }

    if (updateMentors) {
      if (day.potentialMentors.length === 1 || !day.availableShifts()) {
        for (const mentor of day.potentialMentors) {
          mentor.daysLeft -= 1;
        }
        this.assignedDays.push(payDays[0]);
        payDays.shift();
        return 1;
      } else {
        curMentor.daysLeft -= 1;
        const index = day.potentialMentors.indexOf(curMentor);
        if (index > -1) {
          day.potentialMentors.splice(index, 1);
        }
        return curMentor;
      }
    }
  }

  mentorCleanup(mentorUpdate, payDays, mentors) {
    const mentorsToUpdate = [];

    if (mentorUpdate instanceof Mentor) {
      if (
        mentorUpdate.daysLeft === 0 ||
        mentorUpdate.getAvailableHours() <= 0
      ) {
        mentorsToUpdate.push(mentorUpdate);
      }
    } else if (typeof mentorUpdate === "number") {
      for (const mentor of mentors) {
        if (mentor.daysLeft === 0 || mentor.getAvailableHours() <= 0) {
          mentorsToUpdate.push(mentor);
        }
      }
    }

    for (const day of payDays) {
      day.potentialMentors = day.potentialMentors.filter(
        (mentor) => !mentorsToUpdate.includes(mentor)
      );
    }
  }

  assignAllShifts(payDays, mentors) {
    let unassignedDays = payDays.length;

    while (unassignedDays > 0) {
      this.prioritizeDays(payDays);
      const mentor = this.assignShift(payDays);
      if (mentor !== null) {
        this.mentorCleanup(mentor, payDays, mentors);
      }
      unassignedDays = payDays.length;
    }

    this.assignedDays.sort(
      (a, b) => a.dateInfo.getDate() - b.dateInfo.getDate()
    );
  }
}

export { Schedule, Day, Mentor };
