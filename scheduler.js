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
    this.lastShift = null; // Track last shift worked for variety
    this.shiftHistory = []; // Track recent shifts
    this.workDays = []; // Track days worked for consecutive day check
  }

  legalShiftAdd(shiftLen, weekHours = 0, dateInfo = null) {
    // Check 80-hour limit per 2-week pay period
    if (this.hoursPay + shiftLen > 80) {
      return false;
    }
    
    // Check 1.5x weekly hours limit
    const weeklyRequested = this.hoursWanted / 2; // hoursWanted is already for 2 weeks
    const maxWeeklyHours = weeklyRequested * 1.5;
    if (weekHours + shiftLen > maxWeeklyHours) {
      return false;
    }
    
    // Check 5-day rolling window (no more than 5 days worked in any 7-day period)
    if (dateInfo && this.workDays.length > 0) {
      // Count how many days worked in the last 7 days
      const sevenDaysAgo = new Date(dateInfo);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentWorkDays = this.workDays.filter(d => {
        const workDate = new Date(d);
        return workDate > sevenDaysAgo && workDate < dateInfo;
      });
      
      if (recentWorkDays.length >= 5) {
        return false;
      }
    }
    
    return true;
  }

  addWorkDay(dateInfo) {
    // Add this day to the work history
    const dateStr = dateInfo.toISOString().split('T')[0];
    if (!this.workDays.includes(dateStr)) {
      this.workDays.push(dateStr);
      this.workDays.sort();
    }
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

  addShift(mentor, scheduleRef = null) {
    // Prioritize A & B shifts over C shifts
    const shifts = Object.entries(this.mentorsOnShift);
    
    // Separate into A/B shifts and C shifts
    const abShifts = [];
    const cShifts = [];
    const differentShifts = [];
    const sameShifts = [];
    
    for (const [shift, slot] of shifts) {
      if (slot === null) {
        const shiftLower = shift.toLowerCase();
        if (shiftLower.includes('c_shift') || shiftLower.includes('c shift')) {
          if (shift === mentor.lastShift) {
            sameShifts.push([shift, slot, 'c']);
          } else {
            cShifts.push([shift, slot]);
          }
        } else {
          if (shift === mentor.lastShift) {
            sameShifts.push([shift, slot, 'ab']);
          } else {
            abShifts.push([shift, slot]);
          }
        }
      }
    }
    
    // Try A/B shifts first (prioritize different from last), then C shifts
    const orderedShifts = [...abShifts, ...sameShifts.filter(s => s[2] === 'ab'), ...cShifts, ...sameShifts.filter(s => s[2] === 'c')];
    
    for (const [shift, slot] of orderedShifts) {
      const shiftLen = this.shifts[shift];
      
      // Get current weekly hours for this mentor
      let currentWeeklyHours = 0;
      if (scheduleRef && scheduleRef.weeklyHoursByMentor) {
        const weekKey = scheduleRef.getCalendarWeekKey(this.dateInfo, mentor.name);
        currentWeeklyHours = scheduleRef.weeklyHoursByMentor[weekKey] || 0;
      }
      
      const legalAdd = mentor.legalShiftAdd(shiftLen, currentWeeklyHours, this.dateInfo);

      if (legalAdd) {
        this.mentorsOnShift[shift] = mentor;
        mentor.hoursPay += this.shifts[shift];
        mentor.lastShift = shift;
        mentor.shiftHistory.push(shift);
        mentor.addWorkDay(this.dateInfo); // Track work day for consecutive day checking
        
        // Track weekly hours
        if (scheduleRef && scheduleRef.weeklyHoursByMentor) {
          const weekKey = scheduleRef.getCalendarWeekKey(this.dateInfo, mentor.name);
          scheduleRef.weeklyHoursByMentor[weekKey] = (scheduleRef.weeklyHoursByMentor[weekKey] || 0) + shiftLen;
        }
        
        return true;
      }
    }
    
    return false;
  }

  addLowestShift(mentor, scheduleRef = null) {
    // CRITICAL: Check if mentor already has a shift on this day
    for (const [existingShift, existingMentor] of Object.entries(this.mentorsOnShift)) {
      if (existingMentor && existingMentor.name === mentor.name) {
        return false; // Mentor already assigned to this day
      }
    }
    
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

    if (curShift === null) {
      return false; // No available shifts
    }

    // Get current weekly hours for this mentor
    let currentWeeklyHours = 0;
    if (scheduleRef && scheduleRef.weeklyHoursByMentor) {
      const weekKey = scheduleRef.getCalendarWeekKey(this.dateInfo, mentor.name);
      currentWeeklyHours = scheduleRef.weeklyHoursByMentor[weekKey] || 0;
    }

    const legalAdd = mentor.legalShiftAdd(lowestHours, currentWeeklyHours, this.dateInfo);

    if (legalAdd) {
      this.mentorsOnShift[curShift] = mentor;
      mentor.hoursPay += this.shifts[curShift];
      mentor.lastShift = curShift;
      mentor.shiftHistory.push(curShift);
      mentor.addWorkDay(this.dateInfo); // Track work day for consecutive day checking
      
      // Track weekly hours
      if (scheduleRef && scheduleRef.weeklyHoursByMentor) {
        const weekKey = scheduleRef.getCalendarWeekKey(this.dateInfo, mentor.name);
        scheduleRef.weeklyHoursByMentor[weekKey] = (scheduleRef.weeklyHoursByMentor[weekKey] || 0) + this.shifts[curShift];
      }
      
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
    this.weeklyHoursByMentor = {}; // Track hours by calendar week (Sunday-Saturday) per mentor

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
    
    // Run validator and optimizer ONCE after BOTH pay periods are complete
    this.validateAndOptimizeSchedule();
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

  getCalendarWeekKey(dateInfo, mentorName) {
    // Get the Sunday of the week containing this date
    const date = new Date(dateInfo);
    const dayOfWeek = date.getDay();
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - dayOfWeek);
    
    // Create key: mentorName_YYYY-MM-DD (Sunday date)
    const year = sunday.getFullYear();
    const month = String(sunday.getMonth() + 1).padStart(2, '0');
    const day = String(sunday.getDate()).padStart(2, '0');
    return `${mentorName}_${year}-${month}-${day}`;
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
    const dayName = day.getWeekdayName();
    const dayNumber = day.dateInfo.getDate();

    // Filter out mentors who have this day as a hard_date (requested off)
    const availableMentors = day.potentialMentors.filter(
      (mentor) => !mentor.hardDates.includes(dayNumber)
    );

    // If no mentors available (all requested off), skip this day
    if (availableMentors.length === 0) {
      console.warn(`Day ${dayNumber}: No mentors available (all requested off)`);
      this.assignedDays.push(payDays[0]);
      payDays.shift();
      return null;
    }

    // Try to fill ALL available shifts on this day - be AGGRESSIVE
    let assignedAnyShift = false;
    let attemptsPerShift = 0;
    const maxAttempts = availableMentors.length * 5; // Try each mentor up to 5 times
    
    while (day.availableShifts() && attemptsPerShift < maxAttempts) {
      attemptsPerShift++;
      
      // Get all mentors who haven't been assigned to this day yet
      const assignedMentorNames = new Set();
      for (const [shift, mentor] of Object.entries(day.mentorsOnShift)) {
        if (mentor) assignedMentorNames.add(mentor.name);
      }
      
      // Available candidates are those not yet on this day
      let candidates = day.potentialMentors.filter(
        (mentor) => !mentor.hardDates.includes(dayNumber) && !assignedMentorNames.has(mentor.name)
      );
      
      if (candidates.length === 0) {
        // Try removing the constraint about already assigned mentors as last resort
        candidates = day.potentialMentors.filter(
          (mentor) => !mentor.hardDates.includes(dayNumber)
        );
        if (candidates.length === 0) break;
      }
      
      // Prioritize preferred weekday candidates
      const preferredCandidates = candidates.filter((mentor) =>
        mentor.preferredWeekdays.includes(dayName)
      );
      
      candidates = preferredCandidates.length > 0 ? preferredCandidates : candidates;
      candidates = this.filterSaturdayCandidates(candidates, day, this.assignedDays);

      if (candidates.length === 0) break;

      // Sort candidates by EQUAL DISTRIBUTION priority:
      // 1. People with fewer hours assigned get priority
      // 2. Only consider their threshold when near their limit
      candidates.sort((a, b) => {
        // Primary: sort by actual hours assigned (lowest first for equal distribution)
        if (a.hoursPay !== b.hoursPay) {
          return a.hoursPay - b.hoursPay;
        }
        
        // Secondary: if equal hours, prefer those with more capacity remaining
        const aPrio = a.getAvailableHours() / Math.max(a.daysLeft, 1);
        const bPrio = b.getAvailableHours() / Math.max(b.daysLeft, 1);
        return bPrio - aPrio;
      });

      let foundMentor = false;
      
      // Try EVERY candidate for this shift
      for (const mentor of candidates) {
        const success = day.addShift(mentor, this);

        if (success) {
          assignedAnyShift = true;
          foundMentor = true;
          
          // Update mentor's days left
          mentor.daysLeft -= 1;
          
          // Remove mentor from potential list if completely out of hours/days
          if (mentor.daysLeft === 0 || mentor.getAvailableHours() <= 0) {
            const index = day.potentialMentors.indexOf(mentor);
            if (index > -1) {
              day.potentialMentors.splice(index, 1);
            }
          }
          
          break; // Successfully assigned, move to next shift
        }
      }

      if (!foundMentor) {
        // Couldn't fill this shift on this attempt, but keep trying
        // Only give up after maxAttempts
        continue;
      }
    }
    
    // Move to next day (unfilled shifts will be handled by validation and force-fill passes)

    // Move to next day
    this.assignedDays.push(payDays[0]);
    payDays.shift();
    return assignedAnyShift ? 1 : null;
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

  validateAndOptimizeSchedule() {
    const validationMessages = [];
    validationMessages.push("Starting schedule validation and optimization...");
    
    const violations = [];
    
    // Check for duplicate mentors on same day
    for (const day of this.assignedDays) {
      const dayNum = day.dateInfo.getDate();
      const mentorsOnThisDay = {};
      
      for (const [shift, mentor] of Object.entries(day.mentorsOnShift)) {
        if (!mentor) continue;
        
        if (mentorsOnThisDay[mentor.name]) {
          violations.push({
            type: 'duplicate_mentor_same_day',
            day: dayNum,
            shift,
            mentor: mentor.name,
            message: `${mentor.name} assigned multiple shifts on day ${dayNum}`
          });
        }
        mentorsOnThisDay[mentor.name] = shift;
      }
    }
    
    // Check all rules for all mentors
    for (const day of this.assignedDays) {
      for (const [shift, mentor] of Object.entries(day.mentorsOnShift)) {
        if (!mentor) continue;
        
        const dayNum = day.dateInfo.getDate();
        
        // Rule 1: Check if scheduled on hard_date (requested off)
        if (mentor.hardDates.includes(dayNum)) {
          violations.push({
            type: 'hard_date_violation',
            day: dayNum,
            shift,
            mentor: mentor.name,
            message: `${mentor.name} scheduled on requested day off (${dayNum})`
          });
        }
        
        // Rule 2: Check 80-hour limit
        if (mentor.hoursPay > 80) {
          violations.push({
            type: '80_hour_violation',
            day: dayNum,
            shift,
            mentor: mentor.name,
            hours: mentor.hoursPay,
            message: `${mentor.name} exceeds 80 hours (${mentor.hoursPay}h)`
          });
        }
        
        // Rule 3: Check weekly 1.5x limit
        const weekKey = this.getCalendarWeekKey(day.dateInfo, mentor.name);
        const weeklyHours = this.weeklyHoursByMentor[weekKey] || 0;
        const weeklyRequested = mentor.hoursWanted / 2;
        const maxWeeklyHours = weeklyRequested * 1.5;
        
        if (weeklyHours > maxWeeklyHours) {
          violations.push({
            type: 'weekly_limit_violation',
            day: dayNum,
            shift,
            mentor: mentor.name,
            weeklyHours,
            maxWeeklyHours,
            message: `${mentor.name} exceeds 1.5x weekly limit (${weeklyHours}h / ${maxWeeklyHours}h max)`
          });
        }
        
        // Rule 4: Check 5-day rolling window
        const sevenDaysAgo = new Date(day.dateInfo);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const recentWorkDays = mentor.workDays.filter(d => {
          const workDate = new Date(d);
          return workDate > sevenDaysAgo && workDate <= day.dateInfo;
        });
        
        if (recentWorkDays.length > 5) {
          violations.push({
            type: 'consecutive_days_violation',
            day: dayNum,
            shift,
            mentor: mentor.name,
            consecutiveDays: recentWorkDays.length,
            message: `${mentor.name} works ${recentWorkDays.length} days in 7-day window`
          });
        }
      }
    }
    
    // Log violations
    if (violations.length > 0) {
      validationMessages.push(`Found ${violations.length} rule violations:`);
      violations.forEach(v => validationMessages.push(` - ${v.message}`));
      
      // Fix violations by removing assignments
      const fixMessages = this.fixViolations(violations);
      validationMessages.push(...fixMessages);
    } else {
      validationMessages.push("✓ No rule violations found");
    }
    
    // Check for shift variety (non-critical, just informational)
    const varietyMessages = this.checkShiftVariety();
    validationMessages.push(...varietyMessages);
    
    // Multiple retry passes to maximize slot filling
    validationMessages.push("Starting aggressive slot filling with multiple passes...");
    
    // Pass 1: Fill with variety preference
    const fillResult1 = this.fillEmptySlots(null, false);
    validationMessages.push(...fillResult1.messages);
    
    // Count remaining empties after pass 1
    let emptyAfterPass1 = 0;
    for (const day of this.assignedDays) {
      for (const [shift, mentor] of Object.entries(day.mentorsOnShift)) {
        if (mentor === null) emptyAfterPass1++;
      }
    }
    
    // Pass 2: If still have empties, retry ignoring variety
    if (emptyAfterPass1 > 0) {
      validationMessages.push(`Pass 1 complete: ${emptyAfterPass1} slots still empty. Starting Pass 2 (ignoring shift variety)...`);
      const fillResult2 = this.fillEmptySlots(null, true);
      validationMessages.push(...fillResult2.messages);
    }
    
    // Count remaining empties after pass 2
    let emptyAfterPass2 = 0;
    for (const day of this.assignedDays) {
      for (const [shift, mentor] of Object.entries(day.mentorsOnShift)) {
        if (mentor === null) emptyAfterPass2++;
      }
    }
    
    // Pass 3: One more aggressive pass if still have empties
    if (emptyAfterPass2 > 0) {
      validationMessages.push(`Pass 2 complete: ${emptyAfterPass2} slots still empty. Starting Pass 3 (final aggressive attempt)...`);
      const fillResult3 = this.fillEmptySlots(null, true);
      validationMessages.push(...fillResult3.messages);
    }
    
    // Count remaining empties after normal passes
    let emptyAfterPass3 = 0;
    for (const day of this.assignedDays) {
      for (const [shift, mentor] of Object.entries(day.mentorsOnShift)) {
        if (mentor === null) emptyAfterPass3++;
      }
    }
    
    // FORCE FILL: Fill ALL remaining slots, even if it breaks rules
    if (emptyAfterPass3 > 0) {
      validationMessages.push(`\nPass 3 complete: ${emptyAfterPass3} slots still empty.`);
      validationMessages.push(`Starting FORCE FILL to fill all remaining slots...`);
      const forceResult = this.forceFillAllSlots();
      validationMessages.push(...forceResult.messages);
    }
    
    // Final count of empty slots (should be 0 or only those with no candidates)
    let totalEmpty = 0;
    for (const day of this.assignedDays) {
      for (const [shift, mentor] of Object.entries(day.mentorsOnShift)) {
        if (mentor === null) totalEmpty++;
      }
    }
    
    if (totalEmpty > 0) {
      validationMessages.push(`\n⚠ ${totalEmpty} slots remain unfilled (NO available mentors for these slots)`);
    } else {
      validationMessages.push(`\n✓ All slots filled!`);
    }
    
    // NOW check final hours balance after all filling is complete
    const balanceMessages = this.optimizeHoursBalance();
    validationMessages.push(...balanceMessages);
    
    validationMessages.push("Schedule validation and optimization complete");
    
    // Store messages for UI display
    this.validationMessages = validationMessages;
    return validationMessages;
  }

  checkShiftVariety() {
    const messages = [];
    messages.push("Checking shift variety...");
    const mentorShiftSequences = {};
    
    // Track shift sequences for each mentor
    for (const day of this.assignedDays) {
      for (const [shift, mentor] of Object.entries(day.mentorsOnShift)) {
        if (!mentor) continue;
        
        if (!mentorShiftSequences[mentor.name]) {
          mentorShiftSequences[mentor.name] = [];
        }
        
        const shiftType = shift.toLowerCase().includes('a_shift') || shift.toLowerCase().includes('a shift') ? 'A' :
                         shift.toLowerCase().includes('b_shift') || shift.toLowerCase().includes('b shift') ? 'B' :
                         shift.toLowerCase().includes('c_shift') || shift.toLowerCase().includes('c shift') ? 'C' : 'Other';
        
        mentorShiftSequences[mentor.name].push({
          day: day.dateInfo.getDate(),
          shiftType
        });
      }
    }
    
    // Analyze sequences
    let varietyIssues = 0;
    for (const [mentorName, shifts] of Object.entries(mentorShiftSequences)) {
      let consecutiveSameShift = 1;
      let maxConsecutive = 1;
      let lastShiftType = null;
      
      for (const shift of shifts) {
        if (shift.shiftType === lastShiftType) {
          consecutiveSameShift++;
          maxConsecutive = Math.max(maxConsecutive, consecutiveSameShift);
        } else {
          consecutiveSameShift = 1;
          lastShiftType = shift.shiftType;
        }
      }
      
      if (maxConsecutive >= 3) {
        messages.push(`  ℹ ${mentorName} has ${maxConsecutive} consecutive ${lastShiftType} shifts`);
        varietyIssues++;
      }
    }
    
    if (varietyIssues === 0) {
      messages.push("  ✓ Good shift variety across all mentors");
    }
    
    return messages;
  }

  fixViolations(violations) {
    // Remove assignments that violate rules
    const daysToRefill = new Set();
    const messages = [];
    
    for (const violation of violations) {
      const day = this.assignedDays.find(d => d.dateInfo.getDate() === violation.day);
      if (day && day.mentorsOnShift[violation.shift]) {
        messages.push(`Fixing: ${violation.message} - removing assignment`);
        
        // Remove the violation
        const removedMentor = day.mentorsOnShift[violation.shift];
        day.mentorsOnShift[violation.shift] = null;
        
        // Update tracking
        if (removedMentor && removedMentor.name) {
          const weekKey = this.getCalendarWeekKey(day.dateInfo, removedMentor.name);
          if (this.weeklyHoursByMentor[weekKey]) {
            this.weeklyHoursByMentor[weekKey] -= (day.shifts[violation.shift] || 0);
          }
          
          // Remove from work days
          const dateStr = day.dateInfo.toISOString().split('T')[0];
          const workDayIndex = removedMentor.workDays.indexOf(dateStr);
          if (workDayIndex > -1) {
            removedMentor.workDays.splice(workDayIndex, 1);
          }
        }
        
        daysToRefill.add(violation.day);
      }
    }
    
    // Try to refill the empty slots
    if (daysToRefill.size > 0) {
      messages.push(`Attempting to refill ${daysToRefill.size} days with empty slots...`);
      const result = this.fillEmptySlots(Array.from(daysToRefill));
      messages.push(...result.messages);
    }
    
    return messages;
  }
  
  fillEmptySlots(daysToFill = null, ignoreVariety = false) {
    const messages = [];
    messages.push(ignoreVariety ? "Filling empty slots (ignoring shift variety)..." : "Filling empty slots...");
    
    const daysToCheck = daysToFill 
      ? this.assignedDays.filter(d => daysToFill.includes(d.dateInfo.getDate()))
      : this.assignedDays;
    
    let totalFilled = 0;
    
    for (const day of daysToCheck) {
      const dayNum = day.dateInfo.getDate();
      const dayName = day.getWeekdayName();
      
      // Find empty shifts
      const emptyShifts = Object.entries(day.mentorsOnShift)
        .filter(([shift, mentor]) => mentor === null)
        .map(([shift]) => shift);
      
      if (emptyShifts.length === 0) continue;
      
      // Get all mentors (handle case where m2 doesn't exist yet)
      let allMentors = [];
      if (this.m1) allMentors = allMentors.concat(this.m1);
      if (this.m2) allMentors = allMentors.concat(this.m2);
      
      // Remove duplicates by name
      allMentors = allMentors.filter((m, index, self) => 
        index === self.findIndex(m2 => m2.name === m.name)
      );
      
      // Try to fill each empty shift
      for (const shift of emptyShifts) {
        // Get mentors already on this day
        const assignedMentorNames = new Set();
        for (const [s, mentor] of Object.entries(day.mentorsOnShift)) {
          if (mentor) assignedMentorNames.add(mentor.name);
        }
        
        // Try each mentor
        let candidates = allMentors.filter(m => 
          !m.hardDates.includes(dayNum) && !assignedMentorNames.has(m.name)
        );
        
        // Sort by equal distribution - prioritize people with fewer hours
        candidates.sort((a, b) => {
          if (ignoreVariety) {
            // Only consider hours assigned for equal distribution
            return a.hoursPay - b.hoursPay;
          } else {
            // Consider both hours assigned and shift variety (soft preference)
            // Primary: fewer hours assigned
            if (a.hoursPay !== b.hoursPay) {
              return a.hoursPay - b.hoursPay;
            }
            
            // Secondary: shift variety as tiebreaker
            const aVariety = (a.shiftHistory[a.shiftHistory.length - 1] === shift) ? 1 : 0;
            const bVariety = (b.shiftHistory[b.shiftHistory.length - 1] === shift) ? 1 : 0;
            return aVariety - bVariety;
          }
        });
        
        for (const mentor of candidates) {
          const shiftLen = day.shifts[shift];
          
          // Check if legal
          let currentWeeklyHours = 0;
          const weekKey = this.getCalendarWeekKey(day.dateInfo, mentor.name);
          if (this.weeklyHoursByMentor[weekKey]) {
            currentWeeklyHours = this.weeklyHoursByMentor[weekKey];
          }
          
          const legal = mentor.legalShiftAdd(shiftLen, currentWeeklyHours, day.dateInfo);
          
          if (legal) {
            // Assign it!
            day.mentorsOnShift[shift] = mentor;
            mentor.hoursPay += shiftLen;
            mentor.addWorkDay(day.dateInfo);
            mentor.lastShift = shift;
            mentor.shiftHistory.push(shift);
            
            // Update weekly tracking
            this.weeklyHoursByMentor[weekKey] = currentWeeklyHours + shiftLen;
            
            messages.push(`  ✓ Filled day ${dayNum} ${shift} with ${mentor.name}`);
            totalFilled++;
            break;
          }
        }
      }
    }
    
    messages.push(`  Filled ${totalFilled} empty slots`);
    return { count: totalFilled, messages };
  }

  forceFillAllSlots() {
    // FINAL PASS: Fill ALL remaining slots by force, ignoring hour limits and consecutive day rules
    // Only respect: no duplicate mentor same day
    // Report all forced assignments so admin can manually review
    const messages = [];
    const forcedAssignments = [];
    messages.push("\nFORCE FILLING all remaining empty slots...");
    
    let totalFilled = 0;
    
    for (const day of this.assignedDays) {
      const dayNum = day.dateInfo.getDate();
      const dayName = day.getWeekdayName();
      
      // Find empty shifts
      const emptyShifts = Object.entries(day.mentorsOnShift)
        .filter(([shift, mentor]) => mentor === null)
        .map(([shift]) => shift);
      
      if (emptyShifts.length === 0) continue;
      
      // Get all mentors
      let allMentors = [];
      if (this.m1) allMentors = allMentors.concat(this.m1);
      if (this.m2) allMentors = allMentors.concat(this.m2);
      
      // Remove duplicates by name
      allMentors = allMentors.filter((m, index, self) => 
        index === self.findIndex(m2 => m2.name === m.name)
      );
      
      // Try to fill each empty shift BY FORCE
      for (const shift of emptyShifts) {
        const shiftLen = day.shifts[shift];
        
        // Get mentors already on this day
        const assignedMentorNames = new Set();
        for (const [s, mentor] of Object.entries(day.mentorsOnShift)) {
          if (mentor) assignedMentorNames.add(mentor.name);
        }
        
        // ONLY exclude mentors already working this day and those with hard_dates
        let candidates = allMentors.filter(m => 
          !m.hardDates.includes(dayNum) && !assignedMentorNames.has(m.name)
        );
        
        if (candidates.length === 0) {
          messages.push(`  ⚠ Day ${dayNum} ${shift}: NO CANDIDATES (all mentors already assigned or requested off)`);
          continue;
        }
        
        // Sort by equal distribution first - people with fewer hours get priority
        candidates.sort((a, b) => {
          // Primary: sort by actual hours assigned (equal distribution)
          if (a.hoursPay !== b.hoursPay) {
            return a.hoursPay - b.hoursPay;
          }
          
          // Secondary: if equal hours, prefer those who can still accept more
          // (under their threshold vs over their threshold)
          const aNeed = a.getAvailableHours(); // positive = needs more, negative = has too many
          const bNeed = b.getAvailableHours();
          
          // Prefer people who are under their threshold
          if (aNeed > 0 && bNeed <= 0) return -1; // a needs hours, b is over -> prefer a
          if (aNeed <= 0 && bNeed > 0) return 1;  // a is over, b needs hours -> prefer b
          
          // Both need hours or both are over -> pick whoever is furthest from target
          return bNeed - aNeed;
        });
        
        // Take the mentor with fewest hours assigned
        const mentor = candidates[0];
        
        // Check what rules this might be breaking
        const warnings = [];
        
        // Check 80 hour limit
        if (mentor.hoursPay + shiftLen > 80) {
          warnings.push(`OVER 80hr limit (would be ${mentor.hoursPay + shiftLen}h)`);
        }
        
        // Check weekly limit
        let currentWeeklyHours = 0;
        const weekKey = this.getCalendarWeekKey(day.dateInfo, mentor.name);
        if (this.weeklyHoursByMentor[weekKey]) {
          currentWeeklyHours = this.weeklyHoursByMentor[weekKey];
        }
        const weeklyRequested = mentor.hoursWanted / 2;
        const maxWeeklyHours = weeklyRequested * 1.5;
        if (currentWeeklyHours + shiftLen > maxWeeklyHours) {
          warnings.push(`OVER 1.5x weekly limit (would be ${currentWeeklyHours + shiftLen}h / ${maxWeeklyHours}h)`);
        }
        
        // Check 5-day consecutive limit
        const dateStr = day.dateInfo.toISOString().split('T')[0];
        const workDays = [...mentor.workDays, dateStr].sort();
        let consecutiveDays = 1;
        let maxConsecutive = 1;
        
        for (let i = 1; i < workDays.length; i++) {
          const prevDate = new Date(workDays[i - 1]);
          const currDate = new Date(workDays[i]);
          const diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));
          
          if (diffDays === 1) {
            consecutiveDays++;
            maxConsecutive = Math.max(maxConsecutive, consecutiveDays);
          } else {
            consecutiveDays = 1;
          }
        }
        
        if (maxConsecutive > 5) {
          warnings.push(`OVER 5 consecutive days (would be ${maxConsecutive} days)`);
        }
        
        // FORCE ASSIGN regardless of warnings
        day.mentorsOnShift[shift] = mentor;
        mentor.hoursPay += shiftLen;
        mentor.addWorkDay(day.dateInfo);
        mentor.lastShift = shift;
        mentor.shiftHistory.push(shift);
        
        // Update weekly tracking
        this.weeklyHoursByMentor[weekKey] = currentWeeklyHours + shiftLen;
        
        totalFilled++;
        
        if (warnings.length > 0) {
          const warningMsg = `Day ${dayNum} ${dayName} ${shift}: FORCED ${mentor.name} - ${warnings.join(', ')}`;
          messages.push(`  ⚠ ${warningMsg}`);
          forcedAssignments.push(warningMsg);
        } else {
          messages.push(`  ✓ Day ${dayNum} ${shift}: Assigned ${mentor.name} (no rules broken)`);
        }
      }
    }
    
    messages.push(`\nForce-filled ${totalFilled} slots`);
    if (forcedAssignments.length > 0) {
      messages.push(`\n⚠ WARNING: ${forcedAssignments.length} assignments may violate rules:`);
      forcedAssignments.forEach(msg => messages.push(`  - ${msg}`));
      messages.push(`\nPlease review and manually adjust these assignments in the schedule.`);
    } else {
      messages.push(`✓ All force-filled assignments respect the rules!`);
    }
    
    return { count: totalFilled, messages, forcedAssignments };
  }

  optimizeHoursBalance() {
    const messages = [];
    messages.push("Optimizing hours balance...");
    
    // Calculate current deviation from desired hours
    const mentorStats = {};
    
    // Get all unique mentors from both pay periods
    const allMentors = [];
    if (this.m1) allMentors.push(...this.m1);
    if (this.m2) allMentors.push(...this.m2);
    
    // Remove duplicates
    const uniqueMentors = allMentors.filter((m, index, self) => 
      index === self.findIndex(m2 => m2.name === m.name)
    );
    
    for (const mentor of uniqueMentors) {
      mentorStats[mentor.name] = {
        desired: mentor.hoursWanted,
        actual: 0,
        mentor: mentor
      };
    }
    
    // Count actual hours from ALL assigned days
    for (const day of this.assignedDays) {
      for (const [shift, mentor] of Object.entries(day.mentorsOnShift)) {
        if (mentor && mentorStats[mentor.name]) {
          mentorStats[mentor.name].actual += (day.shifts[shift] || 0);
        }
      }
    }
    
    // Calculate deviations
    for (const name in mentorStats) {
      const stats = mentorStats[name];
      stats.deviation = stats.actual - stats.desired;
      stats.percentOff = Math.abs(stats.deviation) / stats.desired * 100;
      
      if (Math.abs(stats.deviation) > 2) {
        messages.push(`  ${name}: ${stats.actual}h / ${stats.desired}h (${stats.deviation > 0 ? '+' : ''}${stats.deviation}h, ${stats.percentOff.toFixed(1)}% off)`);
      }
    }
    
    // Try to balance by moving shifts from over to under
    // (Simple heuristic: prefer slightly over rather than under)
    const avgDeviation = Object.values(mentorStats).reduce((sum, s) => sum + Math.abs(s.deviation), 0) / Object.keys(mentorStats).length;
    messages.push(`  Average deviation: ${avgDeviation.toFixed(1)}h`);
    
    return messages;
  }
}

export { Schedule, Day, Mentor };
