import { db, doc, setDoc, getDoc, onSnapshot, createBackup } from './firebase.js';
import { CAMPUS_ID } from './config.js';
import { showToast, updateDayStyles } from './ui.js';

const mentors = ["Alexie", "Avree", "Emma", "HayLee", "Mitch"];
const slotsAvailable = 2;
const targetMonth = 7; // 7 = august
const targetYear = 2025;
let timeOffData = {};

async function loadTimeOffData() {
    try {
        const docSnap = await getDoc(doc(db, "timeOff", CAMPUS_ID));
        if (docSnap.exists()) {
            timeOffData = docSnap.data()?.mentors || {};
            console.log("Loaded Time Off Data:", timeOffData);
        } else {
            console.warn("No Time Off Data Found");
        }
    } catch (error) {
        console.error("Error loading time off data:", error);
    }
}

export async function createCalendar() {
    await loadTimeOffData();

    const calendar = document.getElementById("calendar");
    calendar.innerHTML = "";

    document.getElementById("campus-name").textContent = `${CAMPUS_ID}`;

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById("month-name").textContent = `${monthNames[targetMonth]} ${targetYear}`;

    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const firstDay = new Date(targetYear, targetMonth, 1).getDay();

    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    daysOfWeek.forEach(day => {
        const header = document.createElement("div");
        header.className = "header";
        header.textContent = day;
        calendar.appendChild(header);
    });

    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement("div");
        emptyCell.className = "empty";
        calendar.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayDiv = document.createElement("div");
        dayDiv.className = "day";

        const dateLabel = document.createElement("div");
        dateLabel.className = "date";
        dateLabel.textContent = day;
        dayDiv.appendChild(dateLabel);

        for (let i = 0; i < slotsAvailable; i++) {
            const select = document.createElement("select");
            select.innerHTML = '<option value="">-</option>' + mentors.map(emp => `<option value="${emp}">${emp}</option>`).join("");
            select.onchange = () => saveTimeOff(day, i, select);
            if (timeOffData[day] && timeOffData[day][i] !== undefined) {
                select.value = timeOffData[day][i];
            }
            dayDiv.appendChild(select);
        }

        calendar.appendChild(dayDiv);
    }

    updateDayStyles();
}

async function saveTimeOff(day, index, select) {
    const name = select.value;
    const dayDiv = select.parentElement;
    const selects = dayDiv.querySelectorAll("select");

    for (let i = 0; i < selects.length; i++) {
        if (i !== index && selects[i].value === name && name !== "") {
            showToast(`${name} already claimed a slot for this day.`);
            select.value = "";
            return;
        }
    }

    try {
        if (!timeOffData[day]) timeOffData[day] = Array(slotsAvailable).fill("");
        timeOffData[day][index] = name;

        await setDoc(doc(db, "timeOff", CAMPUS_ID), { mentors: timeOffData });
        await createBackup(timeOffData);

        showToast("Saved!");
        updateDayStyles();
    } catch (error) {
        console.error("Error saving time-off data:", error);
    }
}

export function generateReport() {
    let report = "";
    let mentorRequests = {};

    Object.keys(timeOffData).forEach(day => {
        timeOffData[day].forEach(name => {
            if (name && name !== "") {
                if (!mentorRequests[name]) mentorRequests[name] = [];
                mentorRequests[name].push(day);
            }
        });
    });

    Object.keys(mentorRequests).forEach(name => {
        report += `${name}: ${mentorRequests[name].join(", ")}\n`;
    });

    document.getElementById("report").textContent = report;
}

export async function clearAll() {
    const password = prompt("Enter your name to confirm:");
    if (password?.trim().toLowerCase() !== "hayden") {
        showToast("Incorrect.");
        return;
    }

    if (!confirm("Are you sure you want to clear all entries?")) return;

    try {
        await createBackup(timeOffData, "manual-clear");
        timeOffData = {};
        await setDoc(doc(db, "timeOff", CAMPUS_ID), { mentors: timeOffData });
        showToast("All entries cleared.");
        createCalendar();
    } catch (error) {
        console.error("Failed to clear all data:", error);
        showToast("Failed to clear.");
    }
}

onSnapshot(doc(db, "timeOff", CAMPUS_ID), (docSnap) => {
    if (docSnap.exists()) {
        timeOffData = docSnap.data()?.mentors || {};
        createCalendar();
    }
});
