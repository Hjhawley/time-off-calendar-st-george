# Schedule Management System

## Overview
The employee scheduler generates monthly schedules for mentors based on their availability, preferred days, and target hours. The system uses a fair distribution algorithm to ensure everyone gets the hours they want.

## Scheduling Rules

### Hard Rules (Must Be Followed)
1. **80-Hour Pay Period Limit**: No mentor can work more than 80 hours in a 2-week pay period
2. **No Working Requested Days Off**: Days marked as unavailable on the calendar are strictly honored
3. **No Working Unavailable Weekdays**: Weekdays marked as unavailable in the mentor profile are never scheduled
4. **One Shift Per Day**: Each mentor can only work one shift per day

### Scheduling Logic
1. **Preferred Weekdays First**: Mentors with a preferred weekday get scheduled on that day every week (unless a hard rule prevents it)
2. **Equal Rate Distribution**: Hours are given at the same rate to all mentors until everyone reaches their weekly target
3. **Force Fill**: If shifts remain unfilled after normal distribution, they are force-filled and flagged for review

## Mentor Settings

### Hours Wanted
- This is the **weekly** target hours for the mentor
- The system calculates monthly targets based on weeks in the month

### Weekdays Unavailable
- Days of the week the mentor **cannot** work (e.g., always off on Sundays)

### Preferred Weekday
- The weekday the mentor **wants** to work every week
- They will be scheduled for this day automatically if no rules are broken

### Days Off (Calendar)
- Specific dates the mentor has requested off
- Pulled from the main employee calendar

## Pay Periods
- Pay periods are 2 weeks long, starting January 1st of each year
- They do NOT align with calendar months
- The 80-hour limit is enforced per actual pay period

## Features

### 1. Generate Schedule Tab
- **Saved Schedules Section**: Below the generation form, you'll find a list of all previously saved schedules
- **Schedule Cards**: Each schedule displays:
  - Schedule name (e.g., "January 2026")
  - Month and year
- **Load Schedule**: Click any schedule card to load it into the View Schedule tab

### 2. View Schedule Tab
- **Save Button**: After generating a schedule, click "Save Schedule" to save it
- **Auto-naming**: Schedules are automatically named based on month and year
- **Overwrite Protection**: Only one schedule per month is allowed - saving overwrites existing schedule for that month

### 3. Database Structure
- **Collection**: `savedSchedules`
- **Document ID Format**: `{CAMPUS_ID}_{month}_{year}` (e.g., "St. George_1_2026")
- **Fields**:
  - `campusId`: Campus identifier
  - `name`: Display name (e.g., "January 2026")
  - `year`: Schedule year
  - `month`: Schedule month (1-12)
  - `generatedAt`: ISO timestamp of when schedule was saved
  - `schedule`: Full schedule data with pay periods
  - `validationMessages`: Array of validation messages

## Workflow

### Generating and Saving a New Schedule
1. Go to "Generate Schedule" tab
2. Select month and year
3. Click "Generate Schedule"
4. System auto-switches to "View Schedule" tab
5. Review the schedule and hours summary
6. Click "Save Schedule" button
7. Schedule is saved and appears in the saved schedules list

### Loading an Existing Schedule
1. Go to "Generate Schedule" tab
2. Scroll to "Saved Schedules" section
3. Click on any schedule card
4. System loads the schedule and switches to "View Schedule" tab
5. Schedule is displayed with all original data intact

### Editing a Schedule
1. Load the schedule you want to edit
2. Make changes (e.g., drag-drop mentors)
3. Click "Save Schedule" to update
4. The existing schedule for that month is overwritten

## Technical Details

### Save Function
- Function: `saveCurrentSchedule()`
- Creates document ID from campus, month, and year
- Serializes all date objects to ISO strings
- Saves to Firebase Firestore
- Updates saved schedules list automatically

### Load Function
- Function: `loadScheduleById(scheduleId)`
- Fetches schedule from Firestore
- Deserializes ISO strings back to Date objects
- Populates `currentSchedule` global variable
- Displays schedule and validation messages

### Schedule List
- Function: `loadSavedSchedulesList()`
- Queries all schedules for current campus
- Sorts by year and month (newest first)
- Updates UI with clickable cards

## Migration Notes

### Old Structure (Deprecated)
- Collection: `savedSchedule`
- Single document per campus
- Limited to one active schedule

### New Structure (Current)
- Collection: `savedSchedules`
- Multiple documents per campus
- One document per month-year combination
- Backward compatible - old single-schedule documents remain untouched

## Future Enhancements

Potential features for future implementation:
- Delete button for individual schedules
- Export schedules to PDF or Excel
- Duplicate schedule to another month
- Schedule comparison view
- Unsaved changes warning
- Schedule notes/comments field
- Approval workflow for schedules
