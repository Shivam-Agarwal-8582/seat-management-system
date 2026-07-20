# SmartSeat SPA — Implementation Walkthrough

## What Was Built

A fully client-side, single-page Office Seat Booking application built using **HTML5, CSS3, and vanilla JavaScript** — no build tools, no backend, no dependencies beyond Lucide Icons from CDN.

---

## Project Files

| File | Purpose |
|------|---------|
| [index.html](file:///Users/shivamagarwal/Desktop/untitled%20folder%202/index.html) | SPA shell with all views, modals, simulator widget |
| [styles.css](file:///Users/shivamagarwal/Desktop/untitled%20folder%202/styles.css) | Dark glassmorphism theme, SVG desk styles, animations |
| [app.js](file:///Users/shivamagarwal/Desktop/untitled%20folder%202/app.js) | State engine, seed data, routing, business rules |
| [README.md](file:///Users/shivamagarwal/Desktop/untitled%20folder%202/README.md) | Full feature list, business rules, login guide |

---

## Features Implemented

### 🕹️ Time Simulator (Bottom-right floating panel)
- Collapse/expand toggle
- Week 1 / Week 2 switcher (changes active batch rotation)
- Day selector (Mon–Sun)
- Hour slider (controls the 3 PM floater window open/close)
- Live display: active batch label + floater window status

### 👤 Employee Portal
- **Dashboard** with hero card, batch/squad/desk info badges
- **Weekly schedule calendar** — 5-day grid showing office vs remote days (with holiday detection)
- **Today's Desk Status** — warns on block, holiday, or no desk assigned
- **Floater Booking** — 5-step eligibility engine:
  1. Holiday check
  2. Batch rotation day check
  3. Next-working-day-only rule
  4. After-3PM time check
  5. Duplicate booking check
- **SVG seating plan** — interactive click-to-inspect map of all 50 desks
- **Redis lock simulation** — 1-second animated spinner with conflict detection on booking confirmation
- **My Bookings** — full ledger, cancel floater bookings

### 🛡️ Admin Portal
- **KPI dashboard** — Total desks, occupied today, floater rate, blocked count (live)
- **Seat Management** — Block permanently, single-date, or date range; convert designated ↔ floater; cascade cancels affected bookings
- **Employee Roster** — Toggle active/inactive (cascades cancellations), batch rotation selector, seat assignment picker, per-employee stats alert
- **Holiday Planner** — Add/remove holidays; registering a holiday auto-cancels ALL seat bookings on that date, with per-booking audit logs
- **Reports & Analytics** — Squad utilization bars (animated), rotation compliance gauge SVG, full audit log table, CSV export download

---

## Business Rules Enforced

| Rule | Enforcement |
|------|------------|
| Batch 1 (Mon-Wed W1), Batch 2 (Thu-Fri W1) | `getEmployeeOfficeDaysInWeek()` |
| Batch swaps on Week 2 | BASELINE_DATES week-aware mapping |
| Floater opens at 15:00 | `state.simHour >= 15` check |
| Next-working-day only | `getNextWorkingDay()` traversal |
| No double-booking | Concurrent lock simulation with 1s delay + re-check |
| Holiday → release bookings | `addCompanyHoliday()` cascade loop |
| Seat block → cancel reservations | `submitBlockSeat()` cascade loop |
| Deactivate employee → release bookings | `toggleEmployeeActive()` cascade loop |

---

## How to Test

1. Open `http://localhost:8000` (server is running) or just open `index.html` directly in the browser
2. Use the **Quick Login** buttons on the login screen:
   - **Admin Portal** → sees Seat Management, Employees, Holidays, Reports
   - **Employee 1 (Batch 1)** → sees dashboard with Mon-Wed schedule
   - **Employee 12 (No Desk)** → sees no designated seat, must book floater
   - **Employee 41 (Batch 2)** → sees Thu-Fri schedule
3. Use the **Time Simulator** widget (bottom-right) to:
   - Set hour to `15` or later → enables floater booking window
   - Set to Week 2 → flips which batch is in office Mon-Wed vs Thu-Fri
4. Use the **Quick Role Switcher** in the header to switch between accounts without logging out

> [!TIP]
> Test the holiday cascade: Log in as Admin → Holiday Planner → Add holiday for `2026-07-21` → Switch to Employee 1 → Dashboard will show that Tuesday is now closed and the booking is released.
