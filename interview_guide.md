# SmartSeat — Interview Explanation Guide

## 1. The Elevator Pitch (30 seconds)

> *"SmartSeat is an office seat booking system I built for a company that has a hybrid work policy. The company has 80 employees split into two batches. Batch 1 comes into the office on certain days, Batch 2 on other days — they rotate every week. Each employee has a designated desk. But if their desk is blocked, or they need to come in on an off-day, they can book one of 10 shared 'floater' desks — but only after 3 PM for the next day. I built this as a full-stack-like frontend SPA using HTML, CSS, and JavaScript, with all state managed in localStorage."*

---

## 2. Start With the Problem Statement

**Say this first — don't jump to code.**

> "The business problem is: how do you manage 80 employees sharing 50 desks in a hybrid work model where not everyone comes in on the same day?"

Then explain the two core challenges:
1. **Designated Allocation** — each employee is pre-assigned a desk they share with one person from the other batch (since they never come in on the same day).
2. **Floater Booking** — 10 shared desks available for edge cases (blocked designated desk, no assigned desk, special visit). These must be booked carefully to avoid conflicts.

---

## 3. Walk Through the Architecture

### What I built:
```
SmartSeat (Frontend SPA)
├── index.html    → UI shell: all views, modals, SVG office map
├── styles.css    → Design system: dark glassmorphism, animations
└── app.js        → Everything else:
                     ├── State Management (localStorage)
                     ├── Data Seeding (80 employees, 50 seats)
                     ├── Business Rules Engine
                     ├── SPA Router
                     ├── SVG Map Generator
                     └── Admin Control Actions
```

### Why no backend?
> "The original system uses Spring Boot + PostgreSQL + Redis. I rebuilt the frontend layer as a standalone SPA that simulates all those layers using localStorage for persistence and in-memory operations for locking — so the core UX and business logic is fully demonstrable without spinning up Java or a database."

---

## 4. Explain the Data Model

Tell them what entities you have and how they relate:

**Employees**
```js
{
  id: "emp-001",
  email: "employee001@smartseat.local",
  batch: 1,             // 1 or 2
  squad: "Squad A",     // A, B, C, D, E
  designatedSeat: "D-01",
  status: "active"
}
```

**Seats**
```js
{
  id: "D-01",           // D-01 to D-40 = designated, F-01 to F-10 = floater
  type: "designated",
  squadArea: "Squad A",
  blocks: [             // Admin-applied restrictions
    { type: "single-date", date: "2026-07-21", reason: "Repairs" }
  ]
}
```

**Bookings**
```js
{
  id: "bk-abc123",
  employeeId: "emp-001",
  seatId: "D-01",
  date: "2026-07-20",
  type: "designated",    // or "floater"
  status: "active",      // or "cancelled"
  lockStatus: "released" // simulates Redis distributed lock
}
```

> "Each booking has a lock status field — this represents the Redis distributed lock lifecycle: ACQUIRE → WRITE → RELEASE. In the real system this prevents two people booking the same floater desk simultaneously."

---

## 5. Explain the Batch Rotation Logic (This is the Core)

This is what makes SmartSeat interesting. Explain it clearly:

> "There are two batches of employees: Batch 1 and Batch 2, with 40 each."

> "In **Week 1**: Batch 1 is in the office Monday, Tuesday, Wednesday. Batch 2 is in Thursday, Friday."

> "In **Week 2**: The rotation FLIPS. Batch 1 comes in Thursday, Friday. Batch 2 comes in Monday, Tuesday, Wednesday."

> "This means desk D-01 is shared between Employee 01 (Batch 1) and Employee 41 (Batch 2) — because they are never in office on the same day in a given week."

The code that enforces this:
```js
function getEmployeeOfficeDaysInWeek(employee, weekNum) {
  const b1Days = weekNum === 1 ? [1, 2, 3] : [4, 5];  // Mon-Wed or Thu-Fri
  const b2Days = weekNum === 1 ? [4, 5] : [1, 2, 3];  // Thu-Fri or Mon-Wed
  return employee.batch === 1 ? b1Days : b2Days;
}
```

---

## 6. Explain the Floater Booking Eligibility Engine (5-Step Rule Chain)

> "The floater booking has strict business rules. When an employee tries to book, my code runs through 5 checks in sequence:"

```
1. Is the target date a registered company holiday?
   → Block. Office is closed.

2. Is the target date within the employee's office rotation days?
   → Block. Can't come in on a remote day.

3. Is the target date the NEXT working day only?
   → Block. Can't book 2+ days in advance.

4. Is the current simulated time AFTER 3:00 PM?
   → Block. Booking window hasn't opened.

5. Does the employee already have an active booking for that day?
   → Block. No double-booking allowed.

All 5 pass? → Eligible to book.
```

**Why this design?** 
> "Each rule is independent and returns a user-friendly message explaining exactly why they can't book. This gives the employee clear guidance rather than a generic error."

---

## 7. Explain the Redis Lock Simulation

This is a great talking point to show depth:

> "In the real backend, when two employees try to book the same floater seat simultaneously, Redis is used to acquire a distributed lock. The first to acquire it completes the booking; the second gets a conflict error."

> "In my frontend simulation, when a user clicks 'Book Floater Seat', I show an animated spinner with the lock key — `LOCK:SEAT:F-01:2026-07-21` — for 1 second. When it resolves, I re-check seat availability in memory before writing the booking. This simulates the exact same flow: acquire lock → verify availability → write → release lock."

```js
function bookFloaterSeat(seatId, targetDate) {
  // Show "Acquiring Redis Lock..." spinner for 1 second
  setTimeout(() => {
    // Re-check availability (simulates concurrent transaction check)
    const status = getSeatStatusOnDate(seat, targetDate);
    if (status !== "available") {
      showToast("Redis Lock Conflict", "Double booking prevented!", "danger");
      return;
    }
    // Write the booking
    state.bookings.push({ ... });
  }, 1000);
}
```

---

## 8. Explain the Cascade Cancellation System

Three triggers automatically cancel related bookings:

| Trigger | What gets cancelled |
|---------|-------------------|
| Admin blocks a seat (permanent/date/range) | All active bookings on that seat in the blocked period |
| Admin adds a company holiday | ALL active bookings on that date (designated + floater) |
| Admin deactivates an employee | All upcoming active bookings for that employee |

> "This mirrors exactly what the real backend would do with database cascade operations or event-driven listeners on Redis pub/sub."

---

## 9. Explain the Interactive SVG Floor Map

> "I dynamically generate an SVG office layout in JavaScript. Each desk is a rectangle with a color-coded status:"

| Color | Meaning |
|-------|---------|
| Blue border (faint) | Designated – Available |
| Blue filled | Designated – Occupied |
| Green border | Floater – Available |
| Gray | Floater – Booked |
| Red dashed | Blocked |
| Purple glow | Your assigned desk |

> "When you click a desk, a Desk Inspector panel on the right shows the occupant's name, squad, booking details, and context-aware action buttons — for employees it shows a 'Book' button (if eligible), for admins it shows 'Block / Convert / Unblock' buttons."

---

## 10. Explain the Admin Features

Walk through each admin capability:

1. **Seat Blocking** — 3 types: permanent, single date, date range. Includes cascade cancellations.
2. **Employee Management** — Toggle active/inactive, change batch rotation, reassign designated desks.
3. **Holiday Planner** — Register company holidays, automatically releases all bookings for that day.
4. **Analytics** — Squad utilization bars, rotation policy compliance gauge (SVG donut chart), full audit logs, CSV export.

---

## 11. Common Interview Questions & Answers

**Q: Why did you use localStorage instead of a real database?**
> "This is a frontend demonstration of the system's UX and business logic. The data model is identical to what a real PostgreSQL schema would look like. Switching to a real backend would just mean replacing `localStorage.getItem/setItem` calls with `axios.get/post` calls to the Spring Boot API."

**Q: How would you make this production-ready?**
> "Add the Spring Boot backend with JWT authentication, replace localStorage with PostgreSQL via Spring Data JPA, replace the simulated Redis lock with a real `redisTemplate.opsForValue().setIfAbsent()` call (SET NX EX pattern), and deploy with Docker Compose."

**Q: How does the batch rotation work exactly?**
> "Each employee has a batch number (1 or 2). The system tracks two-week cycles. In Week 1, Batch 1 is Mon-Wed and Batch 2 is Thu-Fri. In Week 2, they swap. My `getEmployeeOfficeDaysInWeek()` function takes the employee's batch and the simulated week number and returns which days (1-5) are their in-office days."

**Q: What if the same floater desk is booked twice at the same moment?**
> "The Redis distributed lock prevents this. The lock key is scoped to `seat:F-01:date:2026-07-21`. The first transaction acquires the lock, reads that the seat is available, writes the booking, then releases the lock. The second transaction can't acquire the lock during that window, so it waits. If the first booking succeeded, the seat is now occupied and the second fails gracefully with a user-friendly conflict message."

**Q: What design patterns did you use?**
> "I used a single-source-of-truth state store (like Redux but without the library), a command pattern for admin actions with audit logging, a chain-of-responsibility pattern for the 5-step floater eligibility engine, and event-driven cascade updates when holidays or blocks are created."

**Q: How would you scale this to multiple offices?**
> "Add a `locationId` field to employees and seats, scope all queries by location, and add location-based access control to the admin panel. The batch rotation rules could be made configurable per location."

---

## 12. One-Line Technical Highlights to Drop

- *"I implemented a simulated Redis distributed lock with re-verification to prevent race conditions on floater seat bookings."*
- *"Holiday registration triggers a cascade cancellation loop across all bookings — exactly how a backend event listener or database trigger would behave."*
- *"The SVG office map is fully dynamically generated from the seat state — no hardcoded HTML. Every desk's color, label, and click handler is computed from the live data."*
- *"I built a Time Simulation Control Panel so interviewers can test the 3 PM booking window rule without waiting for the actual clock."*
- *"The batch rotation algorithm accounts for both Week 1 and Week 2 cycles — a Wednesday in Week 1 and a Wednesday in Week 2 have completely different office populations."*
