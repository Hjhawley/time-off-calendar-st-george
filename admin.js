import { attemptLogin, checkAdminAuth, logout, isAdmin } from "./auth.js";
import { db, doc, setDoc, getDoc, onSnapshot } from "./firebase.js";
import { CAMPUS_ID } from "./config.js";
import { Schedule } from "./scheduler.js";
import { showToast } from "./ui.js";

// Configuration data
const NATIONAL_HOLIDAYS = {
  1: "1",
  2: "",
  3: "",
  4: "",
  5: "",
  6: "19",
  7: "4,24",
  8: "",
  9: "",
  10: "",
  11: "",
  12: "24,25,31",
};

const SEASONAL_SHIFT_INFO = {
  summer: {
    dates: {
      start: "2024-05-01 00:00:00",
      end: "2024-07-31 00:00:00",
    },
    shift_info: {
      Sunday: { a_shift: 10, b_shift: 10 },
      Monday: { a_shift: 8, b_shift: 8, c_shift: 5 },
      Tuesday: { a_shift: 7, b_shift: 7, c_shift: 4 },
      Wednesday: { a_shift: 7, b_shift: 7 },
      Thursday: { a_shift: 7, b_shift: 7, c_shift: 4.0 },
      Friday: { a_shift: 8, b_shift: 8, c_shift: 4 },
      Saturday: { a_shift: 11, b_shift: 11, c_shift: 4 },
    },
  },
  winter: {
    dates: {
      start: "2024-08-01 00:00:00",
      end: "2025-04-30 00:00:00",
    },
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

let mentorInfoData = {};
let timeOffData = {};
let currentSchedule = null;

// Initialize on load
window.addEventListener("DOMContentLoaded", async () => {
  if (isAdmin()) {
    showAdminContent();
    await loadData();
  } else {
    showLoginModal();
  }
});

function showLoginModal() {
  document.getElementById("login-modal").style.display = "flex";
  document
    .getElementById("admin-password")
    .addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleLogin();
      }
    });
}

function showAdminContent() {
  document.getElementById("login-modal").style.display = "none";
  document.getElementById("admin-content").style.display = "block";
}

window.handleLogin = function () {
  const password = document.getElementById("admin-password").value;
  if (attemptLogin(password)) {
    showAdminContent();
    loadData();
  } else {
    document.getElementById("login-error").textContent = "Incorrect password";
  }
};

window.handleLogout = logout;

// Load data from Firebase
async function loadData() {
  try {
    // Load mentor info
    const mentorDoc = await getDoc(doc(db, "mentorInfo", CAMPUS_ID));
    if (mentorDoc.exists()) {
      mentorInfoData = mentorDoc.data().mentors || {};
    } else {
      // Initialize with empty data
      mentorInfoData = {};
      await setDoc(doc(db, "mentorInfo", CAMPUS_ID), {
        mentors: mentorInfoData,
      });
    }

    // Load time-off data
    const timeOffDoc = await getDoc(doc(db, "timeOff", CAMPUS_ID));
    if (timeOffDoc.exists()) {
      timeOffData = timeOffDoc.data().mentors || {};
    }

    populateMentorSelect();

    // Load calendar config
    const configDoc = await getDoc(doc(db, "calendarConfig", CAMPUS_ID));
    if (configDoc.exists()) {
      const config = configDoc.data();
      document.getElementById("slots-available").value =
        config?.slotsAvailable || 3;

      const calendarMonth =
        config?.targetMonth !== undefined ? config.targetMonth : 0;
      const calendarYear = config?.targetYear || 2026;

      // Set calendar management fields
      document.getElementById("calendar-month").value = calendarMonth;
      document.getElementById("calendar-year").value = calendarYear;

      // Default schedule generation to calendar month/year
      document.getElementById("schedule-year").value = calendarYear;
      document.getElementById("schedule-month").value = calendarMonth + 1; // Display months are 1-indexed
    } else {
      document.getElementById("slots-available").value = 3;
      document.getElementById("calendar-month").value = 0;
      document.getElementById("calendar-year").value = 2026;
      document.getElementById("schedule-year").value = 2026;
      document.getElementById("schedule-month").value = 1;
    }

    updateHolidays();

    // Load saved schedule if it exists
    const scheduleDoc = await getDoc(doc(db, "savedSchedule", CAMPUS_ID));
    if (scheduleDoc.exists()) {
      const savedData = scheduleDoc.data();
      // Reconstruct the Schedule object from serialized data
      if (savedData.schedule) {
        const schedule = savedData.schedule;
        
        // Reconstruct dates from ISO strings
        if (schedule.pay1) {
          schedule.pay1 = schedule.pay1.map(d => ({
            ...d,
            dateInfo: new Date(d.dateInfo)
          }));
        }
        if (schedule.pay2) {
          schedule.pay2 = schedule.pay2.map(d => ({
            ...d,
            dateInfo: new Date(d.dateInfo)
          }));
        }
        if (schedule.assignedDays) {
          schedule.assignedDays = schedule.assignedDays.map(d => ({
            ...d,
            dateInfo: new Date(d.dateInfo)
          }));
        }
        
        currentSchedule = {
          name: savedData.name,
          year: savedData.year,
          month: savedData.month,
          schedule: schedule
        };
        console.log("Loaded saved schedule:", currentSchedule);
      }
    }
  } catch (error) {
    console.error("Error loading data:", error);
    showToast("Error loading data");
  }
}

// Tab switching
window.showTab = function (tabName) {
  const tabs = document.querySelectorAll(".tab-content");
  tabs.forEach((tab) => (tab.style.display = "none"));

  const buttons = document.querySelectorAll(".tab-button");
  buttons.forEach((btn) => btn.classList.remove("active"));

  document.getElementById(tabName).style.display = "block";
  event.target.classList.add("active");
};

// Mentor Management Functions
function populateMentorSelect() {
  const select = document.getElementById("mentor-select");
  select.innerHTML = '<option value="new">+ Add New Mentor</option>';

  for (const name of Object.keys(mentorInfoData)) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  }
}

window.loadMentorInfo = function () {
  const select = document.getElementById("mentor-select");
  const mentorName = select.value;

  if (mentorName === "new") {
    // Clear form for new mentor
    document.getElementById("mentor-name").value = "";
    document.getElementById("hours-wanted").value = "";
    document.getElementById("hard-dates-display").textContent =
      "No dates selected";
    document.getElementById("preferred-weekday").value = "";
    document.getElementById("auto-fill-calendar").checked = false;

    const checkboxes = document.querySelectorAll("#weekdays-unavailable input");
    checkboxes.forEach((cb) => (cb.checked = false));

    document.getElementById("delete-btn").disabled = true;
  } else {
    const mentor = mentorInfoData[mentorName];
    document.getElementById("mentor-name").value = mentorName;
    document.getElementById("hours-wanted").value = mentor.hours_wanted || 0;

    // Display hard dates from time-off calendar
    const mentorTimeOffDates = getMentorTimeOffDates(mentorName);
    document.getElementById("hard-dates-display").textContent =
      mentorTimeOffDates.length > 0
        ? mentorTimeOffDates.join(", ")
        : "No dates selected";

    document.getElementById("preferred-weekday").value =
      mentor.preferred_weekdays && mentor.preferred_weekdays.length > 0
        ? mentor.preferred_weekdays[0]
        : "";

    document.getElementById("auto-fill-calendar").checked =
      mentor.auto_fill_calendar || false;

    document.getElementById("show-on-calendar").checked =
      mentor.show_on_calendar !== undefined ? mentor.show_on_calendar : true;

    const checkboxes = document.querySelectorAll("#weekdays-unavailable input");
    checkboxes.forEach((cb) => {
      cb.checked = mentor.weekdays && mentor.weekdays.includes(cb.value);
    });

    document.getElementById("delete-btn").disabled = false;
  }
};

function getMentorTimeOffDates(mentorName) {
  const dates = [];
  for (const [day, requests] of Object.entries(timeOffData)) {
    if (requests && Array.isArray(requests) && requests.includes(mentorName)) {
      dates.push(parseInt(day));
    }
  }
  dates.sort((a, b) => a - b);
  console.log(`Time-off dates for ${mentorName}:`, dates);
  return dates;
}

window.saveMentorInfo = async function () {
  const name = document.getElementById("mentor-name").value.trim();
  if (!name) {
    showToast("Name field cannot be empty");
    return;
  }

  const hoursWanted =
    parseInt(document.getElementById("hours-wanted").value) || 0;
  const preferredWeekday = document.getElementById("preferred-weekday").value;
  const autoFillCalendar =
    document.getElementById("auto-fill-calendar").checked;
  const showOnCalendar =
    document.getElementById("show-on-calendar").checked;

  const weekdays = [];
  const checkboxes = document.querySelectorAll(
    "#weekdays-unavailable input:checked"
  );
  checkboxes.forEach((cb) => weekdays.push(cb.value));

  // Get hard dates from time-off calendar
  const hardDates = getMentorTimeOffDates(name);

  mentorInfoData[name] = {
    weekdays: weekdays,
    preferred_weekdays: preferredWeekday ? [preferredWeekday] : [],
    weekday_behavior: ["Re"],
    hard_dates: hardDates,
    hours_wanted: hoursWanted,
    soft_dates: [],
    auto_fill_calendar: autoFillCalendar,
    show_on_calendar: showOnCalendar,
  };

  try {
    await setDoc(doc(db, "mentorInfo", CAMPUS_ID), { mentors: mentorInfoData });
    showToast("Mentor information saved successfully");
    populateMentorSelect();
    document.getElementById("mentor-select").value = name;
  } catch (error) {
    console.error("Error saving mentor info:", error);
    showToast("Error saving mentor information");
  }
};

window.deleteMentor = async function () {
  const select = document.getElementById("mentor-select");
  const mentorName = select.value;

  if (mentorName === "new") {
    showToast("No mentor selected to delete");
    return;
  }

  if (
    !confirm(
      `Are you sure you want to delete ${mentorName}? This cannot be undone.`
    )
  ) {
    return;
  }

  delete mentorInfoData[mentorName];

  try {
    await setDoc(doc(db, "mentorInfo", CAMPUS_ID), { mentors: mentorInfoData });
    showToast(`${mentorName} has been deleted successfully`);
    populateMentorSelect();
    document.getElementById("mentor-select").value = "new";
    loadMentorInfo();
  } catch (error) {
    console.error("Error deleting mentor:", error);
    showToast("Error deleting mentor");
  }
};

// Schedule Generation Functions
window.updateHolidays = function () {
  const month = parseInt(document.getElementById("schedule-month").value);
  const holidays = NATIONAL_HOLIDAYS[month] || "";
  document.getElementById("holidays").value = holidays;
};

window.generateSchedule = async function () {
  const scheduleName = document.getElementById("schedule-name").value.trim();
  const year = parseInt(document.getElementById("schedule-year").value);
  const month = parseInt(document.getElementById("schedule-month").value);
  const holidayDates = parseHolidayDates(
    document.getElementById("holidays").value
  );

  if (!scheduleName) {
    showToast("Please enter a schedule name");
    return;
  }

  if (!year || year < 2020 || year > 2100) {
    showToast("Please enter a valid year");
    return;
  }

  if (!month || month < 1 || month > 12) {
    showToast("Please select a valid month");
    return;
  }

  // Update mentor hard_dates with time-off data
  for (const [name, info] of Object.entries(mentorInfoData)) {
    info.hard_dates = getMentorTimeOffDates(name);
  }

  const statusDiv = document.getElementById("generation-status");
  statusDiv.textContent = "Generating schedule...";
  statusDiv.className = "status-message info";

  try {
    const holidays = {
      shift_info: {
        holiday_a_shift: 9,
        holiday_b_shift: 9,
      },
      dates: holidayDates,
    };

    const schedule = new Schedule(
      year,
      month,
      15, // Pay period length
      SEASONAL_SHIFT_INFO,
      mentorInfoData,
      holidays
    );

    currentSchedule = {
      name: scheduleName,
      year: year,
      month: month,
      schedule: schedule,
    };

    // Helper function to serialize mentorsOnShift object
    const serializeMentorsOnShift = (mentorsOnShift) => {
      const serialized = {};
      for (const [shift, mentor] of Object.entries(mentorsOnShift)) {
        if (mentor && typeof mentor === 'object' && mentor.name) {
          // It's a Mentor object
          serialized[shift] = {
            name: mentor.name,
            hoursWanted: mentor.hoursWanted,
            hardDates: mentor.hardDates,
            softDates: mentor.softDates,
            hoursPay: mentor.hoursPay,
            daysLeft: mentor.daysLeft,
            preferredWeekdays: mentor.preferredWeekdays
          };
        } else {
          // It's null or already serialized
          serialized[shift] = mentor;
        }
      }
      return serialized;
    };

    // Save schedule to Firebase for persistence (serialize the schedule object)
    const serializableSchedule = {
      name: scheduleName,
      year: year,
      month: month,
      schedule: {
        m1: schedule.m1.map(m => ({
          name: m.name,
          hoursWanted: m.hoursWanted,
          hardDates: m.hardDates,
          softDates: m.softDates,
          hoursPay: m.hoursPay,
          daysLeft: m.daysLeft,
          preferredWeekdays: m.preferredWeekdays
        })),
        m2: schedule.m2.map(m => ({
          name: m.name,
          hoursWanted: m.hoursWanted,
          hardDates: m.hardDates,
          softDates: m.softDates,
          hoursPay: m.hoursPay,
          daysLeft: m.daysLeft,
          preferredWeekdays: m.preferredWeekdays
        })),
        pay1: schedule.pay1.map(d => ({
          dateInfo: d.dateInfo.toISOString(),
          weekday: d.weekday,
          season: d.season,
          shifts: d.shifts,
          mentorsOnShift: serializeMentorsOnShift(d.mentorsOnShift),
          totalHours: d.totalHours,
          assignedHours: d.assignedHours
        })),
        pay2: schedule.pay2.map(d => ({
          dateInfo: d.dateInfo.toISOString(),
          weekday: d.weekday,
          season: d.season,
          shifts: d.shifts,
          mentorsOnShift: serializeMentorsOnShift(d.mentorsOnShift),
          totalHours: d.totalHours,
          assignedHours: d.assignedHours
        })),
        assignedDays: schedule.assignedDays.map(d => ({
          dateInfo: d.dateInfo.toISOString(),
          weekday: d.weekday,
          season: d.season,
          shifts: d.shifts,
          mentorsOnShift: serializeMentorsOnShift(d.mentorsOnShift),
          totalHours: d.totalHours,
          assignedHours: d.assignedHours
        }))
      }
    };
    
    await setDoc(doc(db, "savedSchedule", CAMPUS_ID), serializableSchedule);

    statusDiv.textContent = "Schedule generated successfully!";
    statusDiv.className = "status-message success";

    showToast(
      "Schedule generated! Switch to 'View Schedule' tab to see results."
    );
    displaySchedule();
  } catch (error) {
    console.error("Error generating schedule:", error);
    statusDiv.textContent = `Error: ${error.message}`;
    statusDiv.className = "status-message error";
    showToast("Error generating schedule");
  }
};

function parseHolidayDates(holidayStr) {
  if (!holidayStr.trim()) return [];

  const dates = new Set();
  const parts = holidayStr.split(",");

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes("-")) {
      const [start, end] = trimmed.split("-").map((s) => parseInt(s.trim()));
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = start; i <= end; i++) {
          dates.add(i);
        }
      }
    } else {
      const num = parseInt(trimmed);
      if (!isNaN(num)) {
        dates.add(num);
      }
    }
  }

  return Array.from(dates).sort((a, b) => a - b);
}

// Display Schedule
function displaySchedule() {
  if (!currentSchedule) {
    document.getElementById("schedule-display").innerHTML =
      "<p>No schedule generated yet. Go to 'Generate Schedule' tab to create one.</p>";
    return;
  }

  const { name, year, month, schedule } = currentSchedule;
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  document.getElementById("schedule-info").innerHTML = `
    <h3>${name}</h3>
    <p>${monthNames[month - 1]} ${year}</p>
  `;

  const container = document.getElementById("schedule-display");
  container.innerHTML = "";

  // Create calendar-style display
  const table = document.createElement("div");
  table.className = "schedule-table";

  // Header row with days of week and shift times
  const headerRow = document.createElement("div");
  headerRow.className = "schedule-header-row";

  const daysOfWeek = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const shiftTimesByDay = {
    Sunday: "A&B 1:00-10:00",
    Monday: "A&B 3:00-10:00\nC 3:00-8:00",
    Tuesday: "A&B 3:45-10:00\nC 3:45-8:00",
    Wednesday: "A&B 3:45-10:00",
    Thursday: "A&B 3:45-10:00\nC 3:45-8:00",
    Friday: "A&B 3:45-12:00\nC 3:45-8:00",
    Saturday: "A&B 1:00-12:00\nC 1:00-5:00",
  };

  daysOfWeek.forEach((day) => {
    const header = document.createElement("div");
    header.className = "schedule-header";

    const dayName = document.createElement("div");
    dayName.className = "header-day-name";
    dayName.textContent = day;
    header.appendChild(dayName);

    const times = document.createElement("div");
    times.className = "header-shift-times";
    times.textContent = shiftTimesByDay[day];
    header.appendChild(times);

    headerRow.appendChild(header);
  });
  table.appendChild(headerRow);

  // Get first day of month and total days
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  // Create calendar grid
  let currentRow = document.createElement("div");
  currentRow.className = "schedule-row";

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "schedule-cell empty";
    currentRow.appendChild(emptyCell);
  }

  // Fill in days
  for (let day = 1; day <= daysInMonth; day++) {
    const assignedDay = schedule.assignedDays.find(
      (d) => d.dateInfo.getDate() === day
    );

    const cell = document.createElement("div");
    cell.className = "schedule-cell";

    // Check if it's a holiday
    const isHoliday = schedule.holidays.dates.includes(day);
    if (isHoliday) {
      cell.classList.add("holiday");
    }

    const dateLabel = document.createElement("div");
    dateLabel.className = "schedule-date";
    dateLabel.textContent = day;
    cell.appendChild(dateLabel);

    if (assignedDay) {
      // Display shift information without time ranges (times are in header)
      const shiftsDiv = document.createElement("div");
      shiftsDiv.className = "schedule-shifts";

      for (const [shift, mentor] of Object.entries(
        assignedDay.mentorsOnShift
      )) {
        if (mentor) {
          const shiftDiv = document.createElement("div");
          shiftDiv.className = "schedule-shift";
          const shiftLabel = shift.replace("_shift", "").toUpperCase();
          shiftDiv.textContent = `${shiftLabel} - ${mentor.name}`;
          shiftsDiv.appendChild(shiftDiv);
        }
      }
      cell.appendChild(shiftsDiv);
    }

    currentRow.appendChild(cell);

    // Start new row after Saturday
    if ((firstDay + day) % 7 === 0) {
      table.appendChild(currentRow);
      currentRow = document.createElement("div");
      currentRow.className = "schedule-row";
    }
  }

  // Add remaining row if it has cells
  if (currentRow.children.length > 0) {
    table.appendChild(currentRow);
  }

  container.appendChild(table);

  // Add legend
  const legend = document.createElement("div");
  legend.className = "schedule-legend";
  legend.innerHTML = `
    <p><strong>A shift</strong> = dinner | <strong>B shift</strong> = meds | <strong>C shift</strong> = errands</p>
  `;
  container.appendChild(legend);

  // Add summary stats
  const summary = document.createElement("div");
  summary.className = "schedule-summary";

  let summaryHTML =
    "<h4>Hours Summary</h4><table><tr><th>Mentor</th><th>1st Pay Period</th><th>2nd Pay Period</th><th>Wanted</th><th>Days Off</th></tr>";

  for (let i = 0; i < schedule.m1.length; i++) {
    const m1 = schedule.m1[i];
    const m2 = schedule.m2[i];
    summaryHTML += `
      <tr>
        <td>${m1.name}</td>
        <td>${m1.hoursPay}</td>
        <td>${m2.hoursPay}</td>
        <td>${m1.hoursWanted / 2}</td>
        <td>${[...m1.hardDates, ...m2.hardDates]
          .sort((a, b) => a - b)
          .join(", ")}</td>
      </tr>
    `;
  }

  summaryHTML += "</table>";
  summary.innerHTML = summaryHTML;
  container.appendChild(summary);
}

// Auto-fill mentor dates on calendar
async function autoFillMentorDates(mentorName, unavailableWeekdays) {
  if (unavailableWeekdays.length === 0) return;

  // Load calendar config to get current month/year
  const configDoc = await getDoc(doc(db, "calendarConfig", CAMPUS_ID));
  let year = 2026;
  let month = 0; // 0 = January

  if (configDoc.exists()) {
    const config = configDoc.data();
    year = config.targetYear || year;
    month = config.targetMonth !== undefined ? config.targetMonth : month;
  }

  const weekdayMap = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };

  // Get all dates in the month that match the unavailable weekdays
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const datesToFill = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();

    for (const weekday of unavailableWeekdays) {
      if (weekdayMap[weekday] === dayOfWeek) {
        datesToFill.push(day);
        break;
      }
    }
  }

  console.log(`Auto-filling ${mentorName} for dates:`, datesToFill);

  // Update timeOffData for these dates
  for (const day of datesToFill) {
    if (!timeOffData[day]) {
      timeOffData[day] = [];
    }

    // Replace first slot with mentor name
    if (timeOffData[day].length === 0) {
      timeOffData[day] = [mentorName];
    } else {
      timeOffData[day][0] = mentorName;
    }
  }
}

// Calendar Management Functions
window.updateCalendarDate = async function () {
  const month = parseInt(document.getElementById("calendar-month").value);
  const year = parseInt(document.getElementById("calendar-year").value);

  if (isNaN(year) || year < 2020 || year > 2100) {
    showToast("Please enter a valid year between 2020 and 2100");
    return;
  }

  try {
    // Load existing config
    const configDoc = await getDoc(doc(db, "calendarConfig", CAMPUS_ID));
    const existingConfig = configDoc.exists() ? configDoc.data() : {};

    // Update with new month/year while preserving other settings
    const updatedConfig = {
      ...existingConfig,
      targetMonth: month,
      targetYear: year,
    };

    await setDoc(doc(db, "calendarConfig", CAMPUS_ID), updatedConfig);

    // Update the schedule generation defaults
    document.getElementById("schedule-year").value = year;
    document.getElementById("schedule-month").value = month + 1;
    updateHolidays();

    showToast(
      "Calendar date updated successfully. Refresh the main calendar page to see changes."
    );
  } catch (error) {
    console.error("Error updating calendar date:", error);
    showToast("Error updating calendar date");
  }
};

window.updateSlots = async function () {
  const slots = parseInt(document.getElementById("slots-available").value);
  if (isNaN(slots) || slots < 1 || slots > 10) {
    showToast("Please enter a valid number between 1 and 10");
    return;
  }

  try {
    // Load existing config
    const configDoc = await getDoc(doc(db, "calendarConfig", CAMPUS_ID));
    const existingConfig = configDoc.exists() ? configDoc.data() : {};

    // Update with new slots while preserving other settings
    const updatedConfig = {
      ...existingConfig,
      slotsAvailable: slots,
    };

    await setDoc(doc(db, "calendarConfig", CAMPUS_ID), updatedConfig);
    showToast(
      "Slots updated successfully. Refresh the main calendar page to see changes."
    );
  } catch (error) {
    console.error("Error updating slots:", error);
    showToast("Error updating slots");
  }
};

window.clearCalendar = async function () {
  if (
    !confirm(
      "Are you sure you want to clear ALL time-off entries? This will auto-fill based on mentors with auto-fill enabled."
    )
  ) {
    return;
  }

  const statusDiv = document.getElementById("calendar-status");
  statusDiv.textContent = "Clearing calendar...";
  statusDiv.className = "status-message info";
  statusDiv.style.display = "block";

  try {
    // Clear all time-off data
    timeOffData = {};

    // Auto-fill for mentors with auto-fill enabled
    for (const [name, info] of Object.entries(mentorInfoData)) {
      if (
        info.auto_fill_calendar &&
        info.weekdays &&
        info.weekdays.length > 0
      ) {
        console.log(`Auto-filling for ${name} with weekdays:`, info.weekdays);
        await autoFillMentorDates(name, info.weekdays);
      }
    }

    console.log("Final timeOffData:", timeOffData);

    // Save to Firebase (save once after all auto-fills)
    await setDoc(doc(db, "timeOff", CAMPUS_ID), { mentors: timeOffData });

    statusDiv.textContent = "Calendar cleared and auto-filled successfully!";
    statusDiv.className = "status-message success";

    setTimeout(() => {
      statusDiv.style.display = "none";
    }, 3000);
  } catch (error) {
    console.error("Error clearing calendar:", error);
    statusDiv.textContent = `Error: ${error.message}`;
    statusDiv.className = "status-message error";
  }
};

export { displaySchedule };
