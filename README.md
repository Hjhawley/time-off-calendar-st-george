# NeuroDev Time-Off Calendar

## Overview
This project integrates the employee time-off calendar with an admin portal for generating schedules.

## Features

### Employee Calendar (index.html)
- Employees can mark dates they are unavailable
- Data is stored in Firebase and syncs in real-time
- Simple, intuitive interface

### Admin Portal (admin.html)
- **Password Protected**: Access requires admin password (default: "neurodev2025")
- **Mentor Management**: 
  - Add/edit/delete mentor information
  - Set hours wanted per week
  - Configure weekday availability and preferences
  - View time-off dates pulled directly from the calendar
- **Schedule Generation**:
  - Select month and year
  - Configure holidays
  - Generate optimized schedules based on all constraints
- **Schedule Viewing**:
  - Calendar-style display matching your provided format
  - Shows shift assignments (A/B/C shifts)
  - Displays shift times
  - Summary table with hours and days off

## How to Use

### For Employees:
1. Visit the main calendar page
2. Select your name from the dropdowns on days you can't work
3. Changes are saved automatically

### For Admins:
1. Click "Admin Portal" link at the bottom of the main page
2. Enter admin password (default: "neurodev2025")
3. **Manage Mentors**:
   - Select a mentor or create new one
   - Set their hours wanted per week
   - Configure their weekday preferences
   - Dates unavailable are automatically pulled from the employee calendar
   - Click "Save Mentor"
4. **Generate Schedule**:
   - Go to "Generate Schedule" tab
   - Enter schedule name, year, and month
   - Adjust holidays if needed (defaults are provided)
   - Click "Generate Schedule"
5. **View Schedule**:
   - Switch to "View Schedule" tab to see the generated calendar
   - Export or screenshot the schedule as needed

## Files Added/Modified

### New Files:
- `admin.html` - Admin portal page
- `admin.js` - Admin functionality and schedule generation
- `admin-styles.css` - Admin-specific styling
- `auth.js` - Authentication system
- `scheduler.js` - JavaScript port of Python scheduling algorithm

### Modified Files:
- `index.html` - Removed generate strings button, added admin link
- `styles.css` - Added admin link styling

### Unchanged Files:
- `calendar.js` - Employee calendar functionality
- `firebase.js` - Firebase configuration
- `config.js` - Campus configuration
- `ui.js` - UI utilities
- `theme-toggle.js` - Dark mode toggle

## Configuration

### Change Admin Password:
Edit `auth.js` and modify the `ADMIN_PASSWORD` constant.

### Adjust Shift Times:
Edit `admin.js` and modify the `SEASONAL_SHIFT_INFO` object to adjust shift hours for summer/winter seasons.

### Change National Holidays:
Edit `admin.js` and modify the `NATIONAL_HOLIDAYS` object.

## Firebase Collections

### `timeOff/{CAMPUS_ID}`
Stores employee time-off selections:
```
{
  mentors: {
    "1": ["Aidri B", "Avree M"],
    "2": ["Sofia D"],
    ...
  }
}
```

### `mentorInfo/{CAMPUS_ID}` (New)
Stores mentor configuration:
```
{
  mentors: {
    "Aidri B": {
      hours_wanted: 30,
      weekdays: ["Monday", "Tuesday"],
      preferred_weekdays: ["Sunday"],
      weekday_behavior: ["Re"],
      hard_dates: [1, 2, 3, ...],
      soft_dates: []
    },
    ...
  }
}
```

## Technical Details

The scheduling algorithm:
1. Splits the month into two pay periods (15 days each)
2. Prioritizes days with fewer available mentors
3. Assigns shifts based on:
   - Mentor availability (hard dates from calendar)
   - Weekday preferences
   - Hours wanted
   - Avoiding overtime (max 80 hours per pay period)
   - Special Saturday rotation rules
4. Generates optimized schedule minimizing conflicts

## Browser Compatibility
- Modern browsers with ES6 module support
- Firebase 10.7.0+
- Tested on Chrome, Firefox, Safari, Edge
