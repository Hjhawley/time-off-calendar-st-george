// Rebuilt scheduler - Clean implementation

/**
 * Calculate which pay period a date falls into
 * Pay periods are 2 weeks, starting January 1st of the year
 * @param {Date} date - The date to check
 * @returns {number} - Pay period number (1-indexed)
 */
function getPayPeriodNumber(date) {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1); // January 1st
  const daysSinceStart = Math.floor((date - startOfYear) / (1000 * 60 * 60 * 24));
  return Math.floor(daysSinceStart / 14) + 1;
}

/**
 * Get the start and end dates of a pay period
 * @param {number} year - The year
 * @param {number} payPeriodNum - Pay period number (1-indexed)
 * @returns {{start: Date, end: Date}}
 */
function getPayPeriodDates(year, payPeriodNum) {
  const startOfYear = new Date(year, 0, 1);
  const startDay = (payPeriodNum - 1) * 14;
  const start = new Date(startOfYear);
  start.setDate(start.getDate() + startDay);
  
  const end = new Date(start);
  end.setDate(end.getDate() + 13); // 14 days total (0-13)
  
  return { start, end };
}

/**
 * Get the calendar week number (Sunday = start of week)
 * @param {Date} date 
 * @returns {string} - Week key like "2026-W01"
 */
function getWeekKey(date) {
  const d = new Date(date);
  const dayOfWeek = d.getDay(); // 0 = Sunday
  const sunday = new Date(d);
  sunday.setDate(d.getDate() - dayOfWeek);
  
  const year = sunday.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const daysSinceStart = Math.floor((sunday - startOfYear) / (1000 * 60 * 60 * 24));
  const weekNum = Math.floor(daysSinceStart / 7) + 1;
  
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Mentor class - represents a mentor and their scheduling constraints
 */
class Mentor {
  constructor(name, hoursWantedPerWeek, unavailableDates, unavailableWeekdays, preferredWeekday) {
    this.name = name;
    this.hoursWantedPerWeek = hoursWantedPerWeek;
    this.hoursWanted = hoursWantedPerWeek; // Alias for compatibility
    this.unavailableDates = unavailableDates.map(d => parseInt(d)); // Days of month they can't work
    this.hardDates = this.unavailableDates; // Alias for compatibility
    this.unavailableWeekdays = unavailableWeekdays || []; // Weekday names they can't work
    this.preferredWeekday = preferredWeekday || null; // Weekday name they prefer
    this.preferredWeekdays = preferredWeekday ? [preferredWeekday] : []; // Alias for compatibility
    
    // Tracking
    this.hoursAssigned = 0; // Total hours assigned this month
    this.hoursPay = 0; // Alias for compatibility
    this.hoursPerPayPeriod = {}; // { payPeriodNum: hours }
    this.hoursPerWeek = {}; // { weekKey: hours }
    this.daysWorked = new Set(); // Set of day numbers worked
    
    // For compatibility
    this.softDates = [];
    this.daysLeft = 0;
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
    // Rule: No working on requested days off
    if (this.unavailableDates.includes(dayOfMonth)) {
      return { canWork: false, reason: 'requested_off' };
    }
    
    // Rule: No working on unavailable weekdays
    if (this.unavailableWeekdays.includes(weekdayName)) {
      return { canWork: false, reason: 'unavailable_weekday' };
    }
    
    // Rule: Only 1 shift per day
    if (this.daysWorked.has(dayOfMonth)) {
      return { canWork: false, reason: 'already_working_today' };
    }
    
    // Rule: Max 80 hours per pay period
    const currentPayPeriodHours = this.hoursPerPayPeriod[payPeriodNum] || 0;
    if (currentPayPeriodHours + shiftHours > 80) {
      return { canWork: false, reason: '80hr_limit' };
    }
    
    return { canWork: true, reason: null };
  }
  
  /**
   * Assign a shift to this mentor
   * @param {number} dayOfMonth 
   * @param {number} shiftHours 
   * @param {number} payPeriodNum 
   * @param {string} weekKey 
   */
  assignShift(dayOfMonth, shiftHours, payPeriodNum, weekKey) {
    this.hoursAssigned += shiftHours;
    this.hoursPay = this.hoursAssigned; // Keep in sync
    this.hoursPerPayPeriod[payPeriodNum] = (this.hoursPerPayPeriod[payPeriodNum] || 0) + shiftHours;
    this.hoursPerWeek[weekKey] = (this.hoursPerWeek[weekKey] || 0) + shiftHours;
    this.daysWorked.add(dayOfMonth);
  }
  
  /**
   * Remove a shift assignment from this mentor
   * @param {number} dayOfMonth 
   * @param {number} shiftHours 
   * @param {number} payPeriodNum 
   * @param {string} weekKey 
   */
  removeShift(dayOfMonth, shiftHours, payPeriodNum, weekKey) {
    this.hoursAssigned -= shiftHours;
    this.hoursPay = this.hoursAssigned; // Keep in sync
    this.hoursPerPayPeriod[payPeriodNum] = (this.hoursPerPayPeriod[payPeriodNum] || 0) - shiftHours;
    this.hoursPerWeek[weekKey] = (this.hoursPerWeek[weekKey] || 0) - shiftHours;
    this.daysWorked.delete(dayOfMonth);
  }
  
  /**
   * Get hours still needed to reach weekly target (across all weeks in month)
   * @param {number} numWeeksInMonth 
   * @returns {number}
   */
  getHoursDeficit(numWeeksInMonth) {
    const targetTotal = this.hoursWantedPerWeek * numWeeksInMonth;
    return Math.max(0, targetTotal - this.hoursAssigned);
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
    this.date = date;
    this.dateInfo = date; // Alias for compatibility
    this.dayOfMonth = date.getDate();
    this.weekday = date.getDay(); // 0 = Sunday
    this.weekdayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][this.weekday];
    this.shifts = shifts; // { a_shift: hours, b_shift: hours, c_shift: hours }
    this.isHoliday = isHoliday;
    this.payPeriodNum = getPayPeriodNumber(date);
    this.weekKey = getWeekKey(date);
    
    // Assignments: { shiftName: Mentor | null }
    this.assignments = {};
    this.mentorsOnShift = {}; // Alias for compatibility
    for (const shiftName in shifts) {
      this.assignments[shiftName] = null;
      this.mentorsOnShift[shiftName] = null;
    }
    
    // For compatibility
    this.totalHours = Object.values(shifts).reduce((sum, h) => sum + h, 0);
    this.assignedHours = 0;
    this.season = null; // Will be set by Schedule
  }
  
  /**
   * Get list of unfilled shifts, prioritizing A & B over C
   * @returns {string[]}
   */
  getUnfilledShifts() {
    const unfilled = [];
    const shiftOrder = ['a_shift', 'b_shift', 'holiday_a_shift', 'holiday_b_shift', 'c_shift'];
    
    for (const shiftName of shiftOrder) {
      if (this.shifts[shiftName] !== undefined && this.assignments[shiftName] === null) {
        unfilled.push(shiftName);
      }
    }
    
    // Add any other shifts not in the priority order
    for (const shiftName in this.shifts) {
      if (!shiftOrder.includes(shiftName) && this.assignments[shiftName] === null) {
        unfilled.push(shiftName);
      }
    }
    
    return unfilled;
  }
  
  /**
   * Check if all shifts are filled
   * @returns {boolean}
   */
  isFilled() {
    return this.getUnfilledShifts().length === 0;
  }
  
  /**
   * Assign a mentor to a shift
   * @param {string} shiftName 
   * @param {Mentor} mentor 
   */
  assignMentor(shiftName, mentor) {
    this.assignments[shiftName] = mentor;
    this.mentorsOnShift[shiftName] = mentor; // Keep in sync
    const hours = this.shifts[shiftName];
    this.assignedHours += hours;
    mentor.assignShift(this.dayOfMonth, hours, this.payPeriodNum, this.weekKey);
  }
  
  /**
   * Remove a mentor from a shift
   * @param {string} shiftName 
   */
  removeMentor(shiftName) {
    const mentor = this.assignments[shiftName];
    if (mentor) {
      const hours = this.shifts[shiftName];
      this.assignedHours -= hours;
      mentor.removeShift(this.dayOfMonth, hours, this.payPeriodNum, this.weekKey);
      this.assignments[shiftName] = null;
      this.mentorsOnShift[shiftName] = null;
    }
  }
  
  /**
   * Check if a mentor is already assigned to this day
   * @param {Mentor} mentor 
   * @returns {boolean}
   */
  hasMentor(mentor) {
    for (const shiftName in this.assignments) {
      if (this.assignments[shiftName] === mentor) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Get weekday name (for compatibility)
   * @returns {string}
   */
  getWeekdayName() {
    return this.weekdayName;
  }
}

/**
 * Schedule class - main scheduler
 */
class Schedule {
  constructor(year, month, lenP1, seasonalShiftInfo, mentorInfoData, holidays) {
    this.year = year;
    this.month = month; // 1-indexed
    this.lenP1 = lenP1; // For compatibility (not used in new logic)
    this.seasonalShiftInfo = seasonalShiftInfo;
    
    // Ensure holidays has proper structure
    this.holidays = holidays || { dates: [], shift_info: {} };
    if (!this.holidays.dates) this.holidays.dates = [];
    if (!this.holidays.shift_info) this.holidays.shift_info = {};
    
    // Determine season
    this.season = this.getSeason(month);
    
    // Calculate weeks in this month (for target calculations)
    const daysInMonth = new Date(year, month, 0).getDate();
    this.numWeeksInMonth = daysInMonth / 7;
    this.lenP2 = daysInMonth - lenP1; // For compatibility
    
    // Create mentors
    this.mentors = this.createMentors(mentorInfoData);
    
    // Create days
    this.days = this.createDays();
    this.assignedDays = this.days; // Alias for compatibility
    
    // For compatibility with existing code
    this.m1 = this.mentors;
    this.m2 = this.mentors;
    this.pay1 = this.days.filter(d => d.dayOfMonth <= 15);
    this.pay2 = this.days.filter(d => d.dayOfMonth > 15);
    
    // Validation messages
    this.validationMessages = [];
    
    // Run the scheduling algorithm
    this.generateSchedule();
  }
  
  /**
   * Determine season based on month
   * @param {number} month - 1-indexed month
   * @returns {string}
   */
  getSeason(month) {
    const summerMonths = [5, 6, 7]; // May, June, July
    return summerMonths.includes(month) ? 'summer' : 'winter';
  }
  
  /**
   * Create Mentor objects from mentor info data
   * @param {Object} mentorInfoData 
   * @returns {Mentor[]}
   */
  createMentors(mentorInfoData) {
    const mentors = [];
    
    for (const [name, info] of Object.entries(mentorInfoData)) {
      // Skip mentors marked as hidden
      if (info.show_on_calendar === false) continue;
      
      const mentor = new Mentor(
        name,
        info.hours_wanted || 0,
        info.hard_dates || [],
        info.weekdays || [],
        info.preferred_weekdays && info.preferred_weekdays.length > 0 ? info.preferred_weekdays[0] : null
      );
      
      mentors.push(mentor);
    }
    
    return mentors;
  }
  
  /**
   * Create Day objects for the month
   * @returns {Day[]}
   */
  createDays() {
    const days = [];
    const daysInMonth = new Date(this.year, this.month, 0).getDate();
    
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
      const date = new Date(this.year, this.month - 1, dayNum);
      const weekdayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
      
      // Check if holiday
      const isHoliday = this.holidays.dates.includes(dayNum);
      
      // Get shifts for this day
      let shifts;
      if (isHoliday && this.holidays.shift_info && Object.keys(this.holidays.shift_info).length > 0) {
        shifts = { ...this.holidays.shift_info };
      } else {
        // Use regular schedule for the season and weekday
        const seasonInfo = this.seasonalShiftInfo[this.season];
        if (seasonInfo && seasonInfo.shift_info && seasonInfo.shift_info[weekdayName]) {
          shifts = { ...seasonInfo.shift_info[weekdayName] };
        } else {
          // Fallback: empty shifts if something is misconfigured
          console.warn(`No shift info found for ${this.season} ${weekdayName}`);
          shifts = {};
        }
      }
      
      const day = new Day(date, shifts, isHoliday);
      day.season = this.season; // Set season for compatibility
      days.push(day);
    }
    
    return days;
  }
  
  /**
   * Main scheduling algorithm
   */
  generateSchedule() {
    this.validationMessages.push('Starting schedule generation...');
    this.validationMessages.push(`Month: ${this.month}/${this.year}, Season: ${this.season}`);
    this.validationMessages.push(`Mentors: ${this.mentors.map(m => m.name).join(', ')}`);
    
    // PHASE 1: Assign preferred weekdays first
    this.validationMessages.push('\n--- Phase 1: Preferred Weekday Assignments ---');
    this.assignPreferredWeekdays();
    
    // PHASE 2: Fill remaining shifts with equal distribution
    this.validationMessages.push('\n--- Phase 2: Equal Distribution Fill ---');
    this.fillWithEqualDistribution();
    
    // PHASE 3: Force fill any remaining empty slots
    this.validationMessages.push('\n--- Phase 3: Force Fill Remaining ---');
    this.forceFillRemaining();
    
    // PHASE 4: Calculate final stats
    this.validationMessages.push('\n--- Final Statistics ---');
    this.calculateFinalStats();
    
    this.validationMessages.push('\n✓ Schedule generation complete');
  }
  
  /**
   * Phase 1: Assign mentors to their preferred weekdays
   */
  assignPreferredWeekdays() {
    const mentorsWithPreference = this.mentors.filter(m => m.preferredWeekday);
    
    if (mentorsWithPreference.length === 0) {
      this.validationMessages.push('No mentors have preferred weekdays set.');
      return;
    }
    
    for (const mentor of mentorsWithPreference) {
      this.validationMessages.push(`  ${mentor.name} prefers ${mentor.preferredWeekday}`);
      
      // Find all days matching their preferred weekday
      const preferredDays = this.days.filter(d => d.weekdayName === mentor.preferredWeekday);
      
      for (const day of preferredDays) {
        const unfilledShifts = day.getUnfilledShifts();
        if (unfilledShifts.length === 0) continue;
        
        // Try to assign the first available shift (A/B prioritized)
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
          this.validationMessages.push(`    ✓ Assigned ${mentor.name} to day ${day.dayOfMonth} ${shiftName}`);
        } else {
          this.validationMessages.push(`    ✗ Cannot assign ${mentor.name} to day ${day.dayOfMonth}: ${reason}`);
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
    const maxIterations = 1000; // Safety limit
    
    while (iterations < maxIterations) {
      iterations++;
      
      // Find all unfilled shifts across all days
      const unfilledSlots = [];
      for (const day of this.days) {
        for (const shiftName of day.getUnfilledShifts()) {
          unfilledSlots.push({ day, shiftName, hours: day.shifts[shiftName] });
        }
      }
      
      if (unfilledSlots.length === 0) {
        this.validationMessages.push('All shifts filled!');
        break;
      }
      
      // Sort mentors by percentage of target achieved (lowest first = equal distribution)
      const sortedMentors = [...this.mentors].sort((a, b) => {
        const aPct = a.getPercentageOfTarget(this.numWeeksInMonth);
        const bPct = b.getPercentageOfTarget(this.numWeeksInMonth);
        return aPct - bPct;
      });
      
      let assignedThisRound = false;
      
      // Try to assign each mentor to a slot
      for (const mentor of sortedMentors) {
        // Skip mentors who are already at/above their target (unless everyone is)
        const allAtTarget = sortedMentors.every(m => m.getPercentageOfTarget(this.numWeeksInMonth) >= 100);
        if (!allAtTarget && mentor.getPercentageOfTarget(this.numWeeksInMonth) >= 100) {
          continue;
        }
        
        // Find a slot this mentor can work
        for (const slot of unfilledSlots) {
          const { day, shiftName } = slot;
          
          // Skip if already assigned this round
          if (day.assignments[shiftName] !== null) continue;
          
          const { canWork, reason } = mentor.canWork(
            day.dayOfMonth,
            day.weekdayName,
            day.shifts[shiftName],
            day.payPeriodNum
          );
          
          if (canWork) {
            day.assignMentor(shiftName, mentor);
            totalAssigned++;
            assignedThisRound = true;
            break; // Move to next mentor
          }
        }
      }
      
      // If no assignments were made this round, we're stuck
      if (!assignedThisRound) {
        this.validationMessages.push(`Stuck after ${iterations} iterations with ${unfilledSlots.length} slots remaining`);
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
    
    for (const day of this.days) {
      for (const shiftName of day.getUnfilledShifts()) {
        const shiftHours = day.shifts[shiftName];
        
        // Find ANY mentor who can work (ignoring hour targets, respecting hard rules)
        let assigned = false;
        
        // Sort by fewest hours assigned (still try for some balance)
        const sortedMentors = [...this.mentors].sort((a, b) => a.hoursAssigned - b.hoursAssigned);
        
        for (const mentor of sortedMentors) {
          const { canWork, reason } = mentor.canWork(
            day.dayOfMonth,
            day.weekdayName,
            shiftHours,
            day.payPeriodNum
          );
          
          if (canWork) {
            day.assignMentor(shiftName, mentor);
            forcedAssignments.push({
              day: day.dayOfMonth,
              shift: shiftName,
              mentor: mentor.name,
              note: 'Force-filled (beyond normal distribution)'
            });
            assigned = true;
            break;
          }
        }
        
        if (!assigned) {
          // Truly cannot fill - log it
          forcedAssignments.push({
            day: day.dayOfMonth,
            shift: shiftName,
            mentor: null,
            note: 'UNFILLABLE - No mentor available'
          });
          this.validationMessages.push(`⚠ Day ${day.dayOfMonth} ${shiftName}: UNFILLABLE - all mentors unavailable`);
        }
      }
    }
    
    if (forcedAssignments.length > 0) {
      const filled = forcedAssignments.filter(a => a.mentor !== null);
      const unfilled = forcedAssignments.filter(a => a.mentor === null);
      
      this.validationMessages.push(`Force-filled ${filled.length} slots`);
      if (unfilled.length > 0) {
        this.validationMessages.push(`⚠ ${unfilled.length} slots could not be filled`);
      }
    } else {
      this.validationMessages.push('No force-filling needed');
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
      
      if (Math.abs(diff) > 5) {
        this.validationMessages.push(`  ⚠ ${mentor.name}: ${mentor.hoursAssigned.toFixed(1)}h / ${targetMonthly.toFixed(1)}h target (${diffStr}h, ${pct.toFixed(0)}%)`);
      } else {
        this.validationMessages.push(`  ✓ ${mentor.name}: ${mentor.hoursAssigned.toFixed(1)}h / ${targetMonthly.toFixed(1)}h target (${diffStr}h, ${pct.toFixed(0)}%)`);
      }
    }
    
    // Count unfilled
    let unfilled = 0;
    for (const day of this.days) {
      unfilled += day.getUnfilledShifts().length;
    }
    
    if (unfilled > 0) {
      this.validationMessages.push(`\n⚠ ${unfilled} shifts remain unfilled`);
    } else {
      this.validationMessages.push(`\n✓ All shifts filled`);
    }
  }
}

export { Schedule, Day, Mentor, getPayPeriodNumber, getWeekKey };
