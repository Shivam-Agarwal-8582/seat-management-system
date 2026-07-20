# SmartSeat - Office Seat Booking System (HTML/CSS/JS Version)

Welcome to the client-side Single-Page Application (SPA) version of **SmartSeat**, a monolithic office seat booking system with batch-based attendance rotation, designated seat allocation, and floater seat booking.

This application is built using standard **HTML5**, **Vanilla CSS3**, and **ES6 Javascript**, runs entirely in the browser, and utilizes `localStorage` for persistent states (no external databases, Java dependencies, or API backends required to run).

---

## Features

### 🕒 Time Simulator Widget (Collapsible Control Panel)
To test complex scheduling window limitations easily (e.g., booking seats only after 3:00 PM), the page contains a floating control widget in the bottom-right corner:
- **Simulation Week Switcher**: Toggle between Week 1 and Week 2 rotations.
- **Simulation Day Switcher**: Test schedule outcomes for weekdays and weekends.
- **Simulation Time Slider**: Adjust simulated hours in real-time (closes/opens the floater booking window).

### 👥 Employee Portal
- **Rotation Attendance Calendar**: Visualizes expected office presence (green days) vs remote working (gray days) according to active batch calendars.
- **Designated Desk Status**: Check allocated desk status. Flags blocks and triggers warnings if the desk is unavailable.
- **Floater Booking**: Interactive booking wizard that performs strict validation:
  1. Opens after 3:00 PM for the next working day.
  2. Restricts booking to the employee's designated office rotation days.
  3. Displays responsive error prompts based on scheduling eligibility.
- **Booking Concurrency Lock**: Simulates Redis distributed locking (e.g., `lock:seat:F-03:2026-07-21`) with animated delay checks to prevent double bookings.
- **My Bookings Summary**: Review attendance ledger and cancel floater reservations anytime.
- **Interactive SVG Office Map**: High-fidelity office blueprint displaying live occupancy metrics, desk types, and detailed hover/click popovers.

### 🛡️ Administrator Portal
- **Dashboard & KPIs**: High-level counters tracking occupied desks, utilization rates, floater bookings, and active blocks.
- **Seat Inventory Management**: Register date blocks, date-range blocks, and convert desks between Designated and Floater allocations.
- **Employee Roster**: Toggle user status (active/inactive), rotate batch groups, and manually map designated seating configurations.
- **Holiday Planner**: Add company holidays which automatically perform cascading reservation releases on affected dates.
- **Analytics & Reports**: Visual squad occupancy rates, compliance gauges, activity audit logs, and spreadsheet compilation (simulates a `.csv` report download).

---

## Seed Accounts & Access

A **Quick Role Switcher** is provided at the top-right header of the application to easily swap roles without typing credentials. 

### Tester Logins
- **Admin**: `admin@smartseat.local` / `password123`
- **Employee 01 (Batch 1, Squad A)**: `employee001@smartseat.local` / `password`
- **Employee 12 (Batch 1, No designated desk)**: `employee012@smartseat.local` / `password`
- **Employee 41 (Batch 2, Squad A)**: `employee041@smartseat.local` / `password`
- **Employee 75 (Batch 2, Squad E)**: `employee075@smartseat.local` / `password`

---

## Business Rules Implemented
1. **50 seats total**: 40 designated (`D-01` to `D-40`) and 10 floater (`F-01` to `F-10`).
2. **80 employees**: 5 squads (A, B, C, D, E), split into Batch 1 (1–40) and Batch 2 (41–80).
3. **Weekly rotation**:
   - **Week 1**: Batch 1 expected Mon-Wed; Batch 2 expected Thu-Fri.
   - **Week 2**: Batch 1 expected Thu-Fri; Batch 2 expected Mon-Wed.
4. **Pre-assigned Sharing**: Designated seat `D-x` is shared between Employee `x` (Batch 1) and Employee `x+40` (Batch 2).
5. **Floater Window**: Eligible employees can book floaters starting at **3:00 PM** on the working day preceding their office rotation day.
6. **Holiday Cascades**: Registering a company holiday automatically cancels all bookings on that day.
7. **Deactivation Cascades**: Deactivating an employee profile automatically releases all upcoming seating reservations for that employee.

---

## How to Run Locally

You can launch and interact with SmartSeat in two ways:

### Option A: Double-Click (Static File)
Simply double-click the `index.html` file in your workspace to run it directly inside any modern web browser.

### Option B: Local Server (Recommended for Lucide/CDN asset loading reliability)
If you have Node installed, you can spin up a lightweight local web server in the project directory:

```bash
# Install serve globally (if not already installed)
npm install -g serve

# Run serve in the project root
serve .
```
Then navigate to `http://localhost:3000` or the port displayed in your terminal.
