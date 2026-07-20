# Implementation Plan - SmartSeat SPA (HTML, CSS, JS)

We will build the **SmartSeat Office Seat Booking System** as a premium, state-of-the-art Single Page Application (SPA) using vanilla HTML5, CSS3, and JavaScript. The application will run entirely client-side, with simulated database and locks using `localStorage` and memory. It will include a rich, responsive interface with high-fidelity aesthetics, neon dark-mode elements, smooth micro-animations, and full representation of all business rules.

---

## User Review Required

> [!IMPORTANT]
> **Key Design Choices & Interactions:**
> 1. **Time Simulation Control Panel**: Since the floater seat booking depends on specific timing rules (e.g., opening after 3:00 PM for the next working day), we will add a floating "Time Controller" widget. This will let you mock the current day/time to test booking window limits without changing your system clock.
> 2. **Seed Data**: We will pre-populate `localStorage` with 80 employees across 2 batches (Batch 1: Mon–Wed, Batch 2: Thu–Fri) and 5 squads, plus 50 seats (40 designated, 10 floater) to make the system fully functional and interactive from the first load.
> 3. **Role Switcher**: To easily test both Employee and Admin flows, a quick-switch header widget will let you jump between an admin account and various employee roles with one click.

---

## Proposed Changes

We will create a clean and structured project inside the workspace directory.

### Project Structure
```text
untitled folder 2/
├── index.html         # Main entry point (SPA Shell, Views, Modals)
├── styles.css         # Modern, premium styling (dark/light themes, dashboard UI)
├── app.js             # Core JS logic: Router, State Management, Business Rules
└── README.md          # Project instructions & how to run
```

---

### Component Specifications

#### [NEW] [index.html](file:///Users/shivamagarwal/Desktop/untitled%20folder%202/index.html)
The HTML shell will contain:
- Head section importing Outfit/Inter fonts from Google Fonts and CSS styles.
- A **Header & Quick Switcher** allowing the user to select accounts (e.g. Admin, Batch 1 Employee, Batch 2 Employee) and change simulated time/date.
- **Login View**: Elegant card-based login with auto-fill buttons for quick testing.
- **Employee View**:
  - Welcome Banner with Batch/Squad assignment.
  - Weekly rotation schedule tracker.
  - Designated seat info card.
  - Floater booking window widget (checks date, working day, simulated time).
  - My Bookings section (upcoming trips, cancel booking buttons).
  - Interactive Seating Plan (SVG layout of the office showing seats, hover tooltips, and click-to-book panels).
- **Admin View**:
  - Operations Dashboard with KPI cards (Occupancy today, Floater utilization, block rates).
  - Seat Management panel (grid layout, click to permanently block, date block, range block).
  - Employee activation/deactivation toggles and squad/batch editing.
  - Holiday management form and checklist.
  - Rotation-aware utilization reports.
- **Modals**: For seat details, booking confirmations, date-range blocks, and alerts.

#### [NEW] [styles.css](file:///Users/shivamagarwal/Desktop/untitled%20folder%202/styles.css)
CSS rules focused on rich aesthetics:
- Modern dark/light theme supporting system preferences, defaulting to a dark glassmorphism dashboard (dark slate backgrounds, emerald/blue gradients, neon glow borders, subtle card dropshadows).
- Consistent layout using Flexbox and Grid.
- Micro-animations for buttons, modal transitions, seat hovers, and page views.
- Seating plan SVG styles: smooth transition on seat colors, pulse animations for booked seats.
- Responsive queries for mobile, tablet, and desktop views.

#### [NEW] [app.js](file:///Users/shivamagarwal/Desktop/untitled%20folder%202/app.js)
The JS bundle will manage:
- **State Management**:
  - Initialize seed data (80 employees, 50 seats, holidays, booking history) in `localStorage` if not present.
  - Reactive view updates based on the active route/view.
- **Business Logic Rules**:
  - Week 1/2 batch rotation checker.
  - Floater booking opening window (checks current simulated time >= 15:00, target date is next working day, target date matches employee's office days).
  - Double-booking preventer (simulating Redis lock).
  - Automatically releasing floater bookings on newly added holidays.
- **Simulated Date/Time**: Holds state for `simulatedNow` date and hour.
- **SVG Floor Map Rendering**: Dynamically updates the color, details, and actions of the office seating layout.

---

## Verification Plan

### Manual Verification
1. **Interactive Demo Checks**:
   - Open `index.html` in Chrome/Safari/Firefox.
   - Log in as `employee001@smartseat.local` (Batch 1 - Mon-Wed). Verify they can see their designated seat and check their scheduled office days.
   - Adjust the simulated clock to 2:00 PM, and attempt to book a floater seat for the next working day. The system should block it with a message stating bookings open at 3:00 PM.
   - Adjust simulated clock to 3:30 PM, and try booking. It should succeed and appear under "My Bookings" and update the Seating Plan.
   - Log in as Admin. Add a holiday for that same booking date. Verify that the employee's booking is automatically cancelled and the seat is released.
   - Block a seat range as Admin, then switch back to Employee and verify those seats are disabled/blocked on the interactive seating plan.
2. **Device Responsiveness**: Test viewport sizes down to mobile widths to ensure cards and tables flow correctly.
