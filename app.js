/* ==========================================================================
   SMARTSEAT OFFICE BOOKING SYSTEM - CORE JAVASCRIPT
   Features: LocalStorage State, SVG Layout Generator, Eligibility Engine,
             Admin Controllers, Redis Lock Simulator, Reports & Logs
   ========================================================================== */

// --- BASELINE SIMULATION CALENDAR MAPPING ---
// Week 1 dates
// Monday: 2026-07-20, Tuesday: 2026-07-21, Wednesday: 2026-07-22, Thursday: 2026-07-23, Friday: 2026-07-24
// Week 2 dates
// Monday: 2026-07-27, Tuesday: 2026-07-28, Wednesday: 2026-07-29, Thursday: 2026-07-30, Friday: 2026-07-31

const BASELINE_DATES = {
  1: { 1: "2026-07-20", 2: "2026-07-21", 3: "2026-07-22", 4: "2026-07-23", 5: "2026-07-24", 6: "2026-07-25", 0: "2026-07-26" },
  2: { 1: "2026-07-27", 2: "2026-07-28", 3: "2026-07-29", 4: "2026-07-30", 5: "2026-07-31", 6: "2026-08-01", 0: "2026-08-02" }
};

const DATE_TO_DAY_WEEK = {};
for (let w in BASELINE_DATES) {
  for (let d in BASELINE_DATES[w]) {
    DATE_TO_DAY_WEEK[BASELINE_DATES[w][d]] = { week: parseInt(w), day: parseInt(d) };
  }
}

// Global App State
let state = {
  currentUser: null,
  simWeek: 1,
  simDay: 1,    // Monday
  simHour: 9,   // 09:00 AM
  employees: [],
  seats: [],
  bookings: [],
  holidays: [],
  logs: [],
  theme: "dark"
};

// --- INITIALIZE & SEED DATA ---
function initApp() {
  // Load Theme
  if (localStorage.getItem("ss_theme") === "light") {
    state.theme = "light";
    document.body.classList.remove("dark-mode");
    document.body.classList.add("light-mode");
  } else {
    state.theme = "dark";
    document.body.classList.remove("light-mode");
    document.body.classList.add("dark-mode");
  }

  // Load state from localStorage or seed
  const storedEmployees = localStorage.getItem("ss_employees");
  const storedSeats = localStorage.getItem("ss_seats");
  const storedBookings = localStorage.getItem("ss_bookings");
  const storedHolidays = localStorage.getItem("ss_holidays");
  const storedLogs = localStorage.getItem("ss_logs");
  const storedSim = localStorage.getItem("ss_sim_time");

  if (storedSim) {
    const s = JSON.parse(storedSim);
    state.simWeek = s.week;
    state.simDay = s.day;
    state.simHour = s.hour;
  }

  if (storedEmployees && storedSeats && storedBookings && storedHolidays && storedLogs) {
    state.employees = JSON.parse(storedEmployees);
    state.seats = JSON.parse(storedSeats);
    state.bookings = JSON.parse(storedBookings);
    state.holidays = JSON.parse(storedHolidays);
    state.logs = JSON.parse(storedLogs);
  } else {
    seedDatabase();
  }

  // Set up simulator controls values
  document.getElementById("sim-week").value = state.simWeek;
  document.getElementById("sim-day").value = state.simDay;
  document.getElementById("sim-hour").value = state.simHour;
  updateSimulationHourLabel(state.simHour);

  // Load Session
  const sessionUser = localStorage.getItem("ss_session");
  if (sessionUser) {
    const userEmail = JSON.parse(sessionUser);
    state.currentUser = state.employees.find(e => e.email === userEmail) || { email: "admin@smartseat.local", role: "admin", fullName: "SmartSeat Admin" };
  } else {
    // Default to admin on first check if no session
    state.currentUser = null;
  }

  // Setup layout visibility
  refreshAuthUI();
  
  if (state.currentUser) {
    setupMainLayout();
  }
}

function seedDatabase() {
  showToast("Database Seeding", "Initializing SmartSeat database seed records...", "info");

  // 1. Generate 80 Employees
  // Squad A (1-16), Squad B (17-32), Squad C (33-48), Squad D (49-64), Squad E (65-80)
  // Batch 1 (1-40), Batch 2 (41-80)
  state.employees = [];
  const squads = ["Squad A", "Squad B", "Squad C", "Squad D", "Squad E"];
  
  for (let i = 1; i <= 80; i++) {
    const email = `employee${String(i).padStart(3, '0')}@smartseat.local`;
    const batch = i <= 40 ? 1 : 2;
    const squadIndex = Math.floor((i - 1) / 16);
    
    // Employee 12 will have NO designated desk assigned to test floaters
    let designatedSeatId = null;
    if (i !== 12) {
      // Seat numbers: Desk D-01 to D-40
      // Seat number D-x is shared by employee x (Batch 1) and employee x+40 (Batch 2)
      // Since employee 12 has no seat, D-12 is shared by employee 52 and nobody from Batch 1!
      const seatNum = i <= 40 ? i : i - 40;
      designatedSeatId = `D-${String(seatNum).padStart(2, '0')}`;
    }

    state.employees.push({
      id: `emp-${String(i).padStart(3, '0')}`,
      fullName: `Employee ${String(i).padStart(3, '0')}`,
      email: email,
      role: "employee",
      batch: batch,
      squad: squads[squadIndex],
      designatedSeat: designatedSeatId,
      status: "active" // active/inactive
    });
  }

  // 2. Generate 50 Seats
  state.seats = [];
  // 40 Designated Seats: D-01 to D-40
  for (let i = 1; i <= 40; i++) {
    const seatId = `D-${String(i).padStart(2, '0')}`;
    // Squad allocations
    // D-1 to D-8: Squad A
    // D-9 to D-16: Squad B
    // D-17 to D-24: Squad C
    // D-25 to D-32: Squad D
    // D-33 to D-40: Squad E
    let squadArea = "Squad A";
    if (i > 8 && i <= 16) squadArea = "Squad B";
    else if (i > 16 && i <= 24) squadArea = "Squad C";
    else if (i > 24 && i <= 32) squadArea = "Squad D";
    else if (i > 32) squadArea = "Squad E";

    state.seats.push({
      id: seatId,
      type: "designated",
      squadArea: squadArea,
      blocks: [] // array of block objects
    });
  }

  // 10 Floater Seats: F-01 to F-10
  for (let i = 1; i <= 10; i++) {
    state.seats.push({
      id: `F-${String(i).padStart(2, '0')}`,
      type: "floater",
      squadArea: "Floater Area",
      blocks: []
    });
  }

  // 3. Preseed Holidays
  state.holidays = [
    { date: "2026-07-24", name: "Summer Wellness Day", createdBy: "Admin" }, // Friday Week 1
    { date: "2026-07-29", name: "Mid-Year Company Retreat", createdBy: "Admin" } // Wednesday Week 2
  ];

  // 4. Preseed Bookings
  // Let's create some designated bookings and some floater bookings for Week 1
  state.bookings = [];
  
  // Let's seed automatic designated bookings for active employees on office days in Week 1
  // Mon-Wed = Batch 1 in-office. Thu-Fri = Batch 2 in-office.
  const week1Mon = "2026-07-20";
  const week1Tue = "2026-07-21";
  const week1Wed = "2026-07-22";
  const week1Thu = "2026-07-23";
  const week1Fri = "2026-07-24"; // Note: Friday is a Holiday!
  
  // Batch 1 Designated checkins
  state.employees.forEach(emp => {
    if (emp.role === "employee" && emp.status === "active" && emp.designatedSeat) {
      if (emp.batch === 1) {
        // Mon, Tue, Wed
        state.bookings.push({
          id: `bk-${Math.random().toString(36).substr(2, 9)}`,
          employeeId: emp.id,
          seatId: emp.designatedSeat,
          date: week1Mon,
          type: "designated",
          status: "active",
          lockStatus: "released"
        });
        state.bookings.push({
          id: `bk-${Math.random().toString(36).substr(2, 9)}`,
          employeeId: emp.id,
          seatId: emp.designatedSeat,
          date: week1Tue,
          type: "designated",
          status: "active",
          lockStatus: "released"
        });
        state.bookings.push({
          id: `bk-${Math.random().toString(36).substr(2, 9)}`,
          employeeId: emp.id,
          seatId: emp.designatedSeat,
          date: week1Wed,
          type: "designated",
          status: "active",
          lockStatus: "released"
        });
      } else if (emp.batch === 2) {
        // Thu (Friday is holiday, so no automatic seat)
        state.bookings.push({
          id: `bk-${Math.random().toString(36).substr(2, 9)}`,
          employeeId: emp.id,
          seatId: emp.designatedSeat,
          date: week1Thu,
          type: "designated",
          status: "active",
          lockStatus: "released"
        });
      }
    }
  });

  // Seed a couple of Floater bookings
  // Employee 12 (No designated seat) books F-01 for Monday
  state.bookings.push({
    id: "bk-floater-001",
    employeeId: "emp-012",
    seatId: "F-01",
    date: week1Mon,
    type: "floater",
    status: "active",
    lockStatus: "released"
  });

  // Employee 05 (Batch 1, Squad A) books F-03 for Tuesday because their seat D-05 is blocked!
  // Let's block D-05 for Tuesday Week 1
  const d05 = state.seats.find(s => s.id === "D-05");
  d05.blocks.push({
    type: "single-date",
    date: week1Tue,
    reason: "Undergoing electrical repairs"
  });
  
  // Cancel the automatic booking on D-05 for Tuesday
  const autoBookingIdx = state.bookings.findIndex(b => b.employeeId === "emp-005" && b.date === week1Tue);
  if (autoBookingIdx > -1) {
    state.bookings[autoBookingIdx].status = "cancelled";
  }

  // Create their floater booking on F-03
  state.bookings.push({
    id: "bk-floater-002",
    employeeId: "emp-005",
    seatId: "F-03",
    date: week1Tue,
    type: "floater",
    status: "active",
    lockStatus: "released"
  });

  // 5. Seed some logs
  state.logs = [
    { time: "2026-07-19 14:02:10", user: "system", action: "Database initialized and seeded", desk: "-", status: "success" },
    { time: "2026-07-19 14:30:15", user: "admin@smartseat.local", action: "Blocked seat D-05 for 2026-07-21", desk: "D-05", status: "success" },
    { time: "2026-07-19 15:05:44", user: "employee005@smartseat.local", action: "Acquired Redis booking lock and confirmed floater seat F-03 for 2026-07-21", desk: "F-03", status: "success" }
  ];

  saveState();
}

function saveState() {
  localStorage.setItem("ss_employees", JSON.stringify(state.employees));
  localStorage.setItem("ss_seats", JSON.stringify(state.seats));
  localStorage.setItem("ss_bookings", JSON.stringify(state.bookings));
  localStorage.setItem("ss_holidays", JSON.stringify(state.holidays));
  localStorage.setItem("ss_logs", JSON.stringify(state.logs));
  localStorage.setItem("ss_sim_time", JSON.stringify({ week: state.simWeek, day: state.simDay, hour: state.simHour }));
}

// --- SIMULATED DATE/TIME CONTROLLER ---
function toggleSimulator() {
  const widget = document.getElementById("time-simulator");
  widget.classList.toggle("collapsed");
}

function updateSimulationHourLabel(hourVal) {
  const hr = parseInt(hourVal);
  let label = "";
  if (hr === 0) label = "12:00 AM";
  else if (hr < 12) label = `${hr}:00 AM`;
  else if (hr === 12) label = "12:00 PM";
  else label = `${hr - 12}:00 PM`;
  document.getElementById("sim-hour-label").textContent = label;
}

function updateSimulation() {
  state.simWeek = parseInt(document.getElementById("sim-week").value);
  state.simDay = parseInt(document.getElementById("sim-day").value);
  state.simHour = parseInt(document.getElementById("sim-hour").value);
  
  // Calculate simulated date string
  const currentSimDate = getSimulatedTodayDate();
  
  // Display updates in Widget
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  let hr = state.simHour;
  let ampm = hr >= 12 ? "PM" : "AM";
  let displayHr = hr % 12 === 0 ? 12 : hr % 12;
  let formattedTime = `${String(displayHr).padStart(2, '0')}:00 ${ampm}`;
  
  document.getElementById("sim-status-indicator").textContent = `W${state.simWeek} • ${daysOfWeek[state.simDay].substring(0,3)} ${formattedTime}`;
  
  // Active batch status display
  // Week 1: Batch 1 (Mon-Wed), Batch 2 (Thu-Fri)
  // Week 2: Batch 1 (Thu-Fri), Batch 2 (Mon-Wed)
  let activeBatchDesc = "";
  if (state.simWeek === 1) {
    activeBatchDesc = "Batch 1 (Mon-Wed) / Batch 2 (Thu-Fri)";
  } else {
    activeBatchDesc = "Batch 1 (Thu-Fri) / Batch 2 (Mon-Wed)";
  }
  document.getElementById("info-active-batch").textContent = activeBatchDesc;

  // Floater window indicator: closes/opens based on hour (>= 15:00)
  const floaterWindowOpen = state.simHour >= 15 && state.simDay >= 1 && state.simDay <= 5;
  const fwIndicator = document.getElementById("info-floater-window");
  if (floaterWindowOpen) {
    fwIndicator.textContent = "Open";
    fwIndicator.className = "status-pill success";
  } else {
    fwIndicator.textContent = "Closed";
    fwIndicator.className = "status-pill danger";
  }

  saveState();
  
  // Cascade UI refreshes if logged in
  if (state.currentUser) {
    refreshCurrentView();
    updateQuickSwitcherList();
  }
}

function resetSimulation() {
  document.getElementById("sim-week").value = 1;
  document.getElementById("sim-day").value = 1; // Monday
  document.getElementById("sim-hour").value = 9; // 9:00 AM
  updateSimulationHourLabel(9);
  updateSimulation();
  showToast("Simulation Reset", "Time reset to Week 1, Monday 9:00 AM", "success");
}

function getSimulatedTodayDate() {
  return BASELINE_DATES[state.simWeek][state.simDay];
}

// Gets the next calendar date in our mapping system (skipping weekends if doing working days)
function getNextWorkingDay(dateStr) {
  const currentDetails = DATE_TO_DAY_WEEK[dateStr];
  if (!currentDetails) return null;
  
  let currentWeek = currentDetails.week;
  let currentDay = currentDetails.day;
  
  let nextDay = currentDay + 1;
  let nextWeek = currentWeek;
  
  // Skip to next week if Friday
  if (nextDay > 5) {
    nextDay = 1; // Monday
    nextWeek = currentWeek === 1 ? 2 : 1; // Toggle week
  }
  
  return BASELINE_DATES[nextWeek][nextDay];
}

// --- AUTHENTICATION FLOWS ---
function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  
  if (email === "admin@smartseat.local") {
    state.currentUser = { email: email, role: "admin", fullName: "SmartSeat Admin" };
    localStorage.setItem("ss_session", JSON.stringify(email));
    showToast("Access Granted", "Logged in as Administrator", "success");
    setupMainLayout();
  } else {
    const employee = state.employees.find(e => e.email.toLowerCase() === email.toLowerCase());
    if (employee) {
      if (employee.status !== "active") {
        showToast("Access Denied", "This employee account is deactivated. Contact Admin.", "danger");
        return;
      }
      state.currentUser = employee;
      localStorage.setItem("ss_session", JSON.stringify(email));
      showToast("Access Granted", `Welcome back, ${employee.fullName}!`, "success");
      setupMainLayout();
    } else {
      showToast("Invalid Login", "Employee record not found.", "danger");
    }
  }
}

function quickLogin(email, password) {
  document.getElementById("login-email").value = email;
  document.getElementById("login-password").value = password;
  document.getElementById("login-form").dispatchEvent(new Event('submit'));
}

function logout() {
  state.currentUser = null;
  localStorage.removeItem("ss_session");
  refreshAuthUI();
  showToast("Logged Out", "You have signed out of SmartSeat.", "info");
}

function refreshAuthUI() {
  const appContainer = document.getElementById("app");
  const loginContainer = document.getElementById("login-container");
  
  if (state.currentUser) {
    appContainer.classList.remove("hidden");
    loginContainer.classList.add("hidden");
  } else {
    appContainer.classList.add("hidden");
    loginContainer.classList.remove("hidden");
  }
}

function setupMainLayout() {
  refreshAuthUI();
  
  // Show / Hide items depending on role
  const isEmployee = state.currentUser.role === "employee";
  const employeeEls = document.querySelectorAll(".employee-only");
  const adminEls = document.querySelectorAll(".admin-only");
  
  employeeEls.forEach(el => {
    if (isEmployee) el.classList.remove("hidden");
    else el.classList.add("hidden");
  });
  
  adminEls.forEach(el => {
    if (!isEmployee) el.classList.remove("hidden");
    else el.classList.add("hidden");
  });

  // Populate User Info in Sidebar
  const avatar = document.getElementById("sidebar-user-avatar");
  const nameLabel = document.getElementById("sidebar-user-name");
  const roleLabel = document.getElementById("sidebar-user-role");

  if (state.currentUser.role === "admin") {
    avatar.textContent = "AD";
    avatar.style.background = "linear-gradient(135deg, #EF4444, #F59E0B)";
    nameLabel.textContent = "SmartSeat Admin";
    roleLabel.textContent = "Administrator";
    // Navigate to Admin Seats View by default
    switchView("admin-seats");
  } else {
    // Employee initials
    const initials = state.currentUser.fullName.split(" ").map(n => n[0]).join("");
    avatar.textContent = initials;
    avatar.style.background = "linear-gradient(135deg, var(--primary-light), var(--info))";
    nameLabel.textContent = state.currentUser.fullName;
    roleLabel.textContent = `${state.currentUser.squad} • Batch ${state.currentUser.batch}`;
    // Navigate to Employee Dashboard by default
    switchView("dashboard");
  }

  // Populate quick switcher list
  updateQuickSwitcherList();
}

function updateQuickSwitcherList() {
  const switcher = document.getElementById("quick-role-select");
  switcher.innerHTML = "";
  
  // Admin option
  const adminOpt = document.createElement("option");
  adminOpt.value = "admin@smartseat.local";
  adminOpt.textContent = "SmartSeat Admin";
  if (state.currentUser.email === "admin@smartseat.local") adminOpt.selected = true;
  switcher.appendChild(adminOpt);

  // Quick select employees
  const keyEmployees = [
    { email: "employee001@smartseat.local", label: "Emp 01 (Batch 1, Squad A)" },
    { email: "employee012@smartseat.local", label: "Emp 12 (Batch 1, No Desk)" },
    { email: "employee017@smartseat.local", label: "Emp 17 (Batch 1, Squad B)" },
    { email: "employee041@smartseat.local", label: "Emp 41 (Batch 2, Squad A)" },
    { email: "employee075@smartseat.local", label: "Emp 75 (Batch 2, Squad E)" }
  ];

  keyEmployees.forEach(e => {
    const opt = document.createElement("option");
    opt.value = e.email;
    opt.textContent = e.label;
    if (state.currentUser.email === e.email) opt.selected = true;
    switcher.appendChild(opt);
  });
}

function quickSwitchUser(email) {
  if (email === "admin@smartseat.local") {
    state.currentUser = { email: email, role: "admin", fullName: "SmartSeat Admin" };
  } else {
    state.currentUser = state.employees.find(e => e.email === email);
  }
  localStorage.setItem("ss_session", JSON.stringify(email));
  showToast("Role Swapped", `Switched acting user to ${state.currentUser.fullName}`, "info");
  setupMainLayout();
  refreshCurrentView();
}

// --- NAVIGATION ROUTER ---
function switchView(viewName) {
  // Update Active Link in Sidebar
  const menuItems = document.querySelectorAll(".sidebar-menu .menu-item");
  menuItems.forEach(item => {
    if (item.dataset.view === viewName) item.classList.add("active");
    else item.classList.remove("active");
  });

  // Toggle View Section
  const views = document.querySelectorAll(".app-view");
  views.forEach(view => {
    if (view.id === `view-${viewName}`) view.classList.add("active");
    else view.classList.remove("active");
  });

  // Update Title Header
  let title = "Dashboard";
  if (viewName === "seating-plan") title = "Interactive Seating Plan";
  else if (viewName === "my-bookings") title = "My Bookings";
  else if (viewName === "admin-seats") title = "Office Seats Inventory";
  else if (viewName === "admin-employees") title = "Employee Allocations";
  else if (viewName === "admin-holidays") title = "Holiday Configuration";
  else if (viewName === "admin-reports") title = "Utilization Logs & Analytics";
  
  document.getElementById("view-title").textContent = title;

  // Initialize view specific layouts
  if (viewName === "dashboard" && state.currentUser.role === "employee") {
    renderEmployeeDashboard();
  } else if (viewName === "my-bookings" && state.currentUser.role === "employee") {
    renderMyBookings();
  } else if (viewName === "seating-plan") {
    renderSeatingPlan();
  } else if (viewName === "admin-seats") {
    renderAdminSeats();
  } else if (viewName === "admin-employees") {
    renderAdminEmployees();
  } else if (viewName === "admin-holidays") {
    renderAdminHolidays();
  } else if (viewName === "admin-reports") {
    renderAdminReports();
  }
}

function refreshCurrentView() {
  const activeView = document.querySelector(".app-view.active");
  if (!activeView) return;
  const viewName = activeView.id.replace("view-", "");
  switchView(viewName);
}

// --- EMPLOYEE VIEW GENERATORS ---
function getEmployeeOfficeDaysInWeek(employee, weekNum) {
  // Week 1: Batch 1 = Mon-Wed, Batch 2 = Thu-Fri
  // Week 2: Batch 1 = Thu-Fri, Batch 2 = Mon-Wed
  const b1Days = weekNum === 1 ? [1, 2, 3] : [4, 5];
  const b2Days = weekNum === 1 ? [4, 5] : [1, 2, 3];
  
  return employee.batch === 1 ? b1Days : b2Days;
}

function renderEmployeeDashboard() {
  const emp = state.currentUser;
  
  // Welcome & Profile badges
  document.getElementById("employee-welcome").textContent = `Hello, ${emp.fullName}!`;
  document.getElementById("dash-squad").textContent = emp.squad;
  document.getElementById("dash-batch").textContent = `Batch ${emp.batch} (${emp.batch === 1 ? 'Mon-Wed' : 'Thu-Fri'} in W1)`;
  
  const designatedSeat = emp.designatedSeat ? emp.designatedSeat : "None Assigned";
  document.getElementById("dash-seat").textContent = designatedSeat;

  // 1. Render Attendance Calendar card
  const scheduleBadge = document.getElementById("schedule-week-badge");
  scheduleBadge.textContent = `Week ${state.simWeek} Rotation`;
  
  const scheduleGrid = document.getElementById("weekly-schedule-grid");
  scheduleGrid.innerHTML = "";
  
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const officeDays = getEmployeeOfficeDaysInWeek(emp, state.simWeek);
  
  for (let d = 1; d <= 5; d++) {
    const isOffice = officeDays.includes(d);
    const dateStr = BASELINE_DATES[state.simWeek][d];
    
    // Check if there is an active company holiday
    const isHoliday = state.holidays.some(h => h.date === dateStr);
    
    // Check if the desk is booked/checked in
    const isBooked = state.bookings.some(b => b.employeeId === emp.id && b.date === dateStr && b.status === "active");
    
    const dayCard = document.createElement("div");
    dayCard.className = `day-schedule-card ${isOffice ? 'office-day' : 'remote-day'} ${state.simDay === d ? 'selected-day' : ''}`;
    
    let statusText = "Remote";
    if (isHoliday) statusText = "Holiday";
    else if (isBooked) statusText = "Seat Booked";
    else if (isOffice) statusText = "Office";

    dayCard.innerHTML = `
      <div class="day-name">${daysOfWeek[d]}</div>
      <span class="day-date">${dateStr}</span>
      <span class="day-status">${statusText}</span>
    `;
    scheduleGrid.appendChild(dayCard);
  }

  // 2. Render Today's Desk Status Card
  const todayDate = getSimulatedTodayDate();
  const todayStatusContainer = document.getElementById("seat-status-container");
  todayStatusContainer.innerHTML = "";

  const todayHoliday = state.holidays.find(h => h.date === todayDate);
  const officeDaysToday = getEmployeeOfficeDaysInWeek(emp, state.simWeek);
  const isOfficeToday = officeDaysToday.includes(state.simDay);

  if (todayHoliday) {
    todayStatusContainer.innerHTML = `
      <div class="alert-box alert-warning">
        <h5>🏢 Office Closed Today</h5>
        <p class="mt-2">The office is closed due to a registered company holiday: <strong>${todayHoliday.name}</strong>.</p>
      </div>
    `;
  } else if (!isOfficeToday) {
    todayStatusContainer.innerHTML = `
      <div class="alert-box alert-neutral">
        <h5>🏡 Remote Working Day</h5>
        <p class="mt-2">According to your batch rotation (${emp.batch === 1 ? 'Batch 1' : 'Batch 2'}), you are scheduled to work remotely today.</p>
      </div>
    `;
  } else {
    // Today is office day for employee! Let's check their seat booking
    const activeBooking = state.bookings.find(b => b.employeeId === emp.id && b.date === todayDate && b.status === "active");
    
    if (activeBooking) {
      const isDesignated = activeBooking.type === "designated";
      todayStatusContainer.innerHTML = `
        <div class="alert-box alert-success">
          <h5>✅ Desk Allocated for Today</h5>
          <div class="mt-4 flex flex-row items-center gap-4">
            <div class="user-avatar" style="width: 44px; height: 44px; font-size: 1.1rem;">${activeBooking.seatId}</div>
            <div>
              <strong>Seat Allocation: ${activeBooking.seatId}</strong>
              <span class="description-text block">${isDesignated ? 'Automatic Designated seat assignment.' : 'Booked Floater seat.'}</span>
            </div>
          </div>
        </div>
      `;
    } else {
      // No active booking. Check if designated seat is blocked.
      const userSeat = state.seats.find(s => s.id === emp.designatedSeat);
      const isBlockedToday = userSeat ? isSeatBlockedOnDate(userSeat, todayDate) : false;
      
      if (isBlockedToday) {
        todayStatusContainer.innerHTML = `
          <div class="alert-box alert-danger">
            <h5>⚠️ Designated Desk Blocked</h5>
            <p class="mt-2">Your designated desk <strong>${emp.designatedSeat}</strong> is blocked by admin today. Please book a floater seat immediately!</p>
          </div>
        `;
      } else if (!emp.designatedSeat) {
        todayStatusContainer.innerHTML = `
          <div class="alert-box alert-warning">
            <h5>🔍 No Designated Desk Assigned</h5>
            <p class="mt-2">You don't have a designated desk template. You must book a floater seat to work in the office today.</p>
          </div>
        `;
      } else {
        // Wait, why do they not have a booking? If they are active and designated seat is active, they should have a booking!
        // This is a backup block.
        todayStatusContainer.innerHTML = `
          <div class="alert-box alert-warning">
            <h5>⚠️ No Seat Confirmed</h5>
            <p class="mt-2">We couldn't confirm a seat allocation for you today. Please check in or contact administrators.</p>
          </div>
        `;
      }
    }
  }

  // 3. Render Floater Booking Date Select Options
  const targetDateSelect = document.getElementById("floater-booking-date");
  targetDateSelect.innerHTML = "";
  
  // Next 5 working days can be target options
  let ptrDate = getSimulatedTodayDate();
  for (let i = 0; i < 5; i++) {
    ptrDate = getNextWorkingDay(ptrDate);
    if (!ptrDate) break;
    const opt = document.createElement("option");
    opt.value = ptrDate;
    
    // Format date beautifully (e.g. Wednesday, July 22)
    const dtDetails = DATE_TO_DAY_WEEK[ptrDate];
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    opt.textContent = `${days[dtDetails.day]}, ${ptrDate}`;
    targetDateSelect.appendChild(opt);
  }

  // Calculate Eligibility immediately on load
  checkFloaterEligibility();

  // 4. Render Upcoming Bookings Table
  renderUpcomingBookingsTable();
}

function checkFloaterEligibility() {
  const emp = state.currentUser;
  const targetDate = document.getElementById("floater-booking-date").value;
  const msgBox = document.getElementById("floater-eligibility-msg");
  const proceedBtn = document.getElementById("btn-proceed-floater");
  const statusBadge = document.getElementById("floater-status-badge");
  
  if (!targetDate) return;
  
  const targetDetails = DATE_TO_DAY_WEEK[targetDate];
  const targetOfficeDays = getEmployeeOfficeDaysInWeek(emp, targetDetails.week);
  const isTargetOfficeDay = targetOfficeDays.includes(targetDetails.day);

  // Check Holiday
  const isTargetHoliday = state.holidays.find(h => h.date === targetDate);

  // Check window open time rules:
  // Floater booking opens at 3:00 PM (15:00) on the working day PRECEDING target date
  const todayDate = getSimulatedTodayDate();
  const nextWorkingDay = getNextWorkingDay(todayDate);
  const isImmediatelyNextWorkingDay = (targetDate === nextWorkingDay);
  const isAfter3PM = state.simHour >= 15;

  let isEligible = false;
  let reasonMsg = "";

  if (isTargetHoliday) {
    reasonMsg = `❌ Office Closed: The target date (${targetDate}) is a registered holiday: <strong>${isTargetHoliday.name}</strong>.`;
  } else if (!isTargetOfficeDay) {
    reasonMsg = `❌ Rotation Rule: The selected date is NOT your scheduled office day. Your rotation for Week ${targetDetails.week} covers office attendance on <strong>${targetDetails.day <= 3 ? 'Mon-Wed' : 'Thu-Fri'}</strong> only.`;
  } else if (!isImmediatelyNextWorkingDay) {
    reasonMsg = `❌ Next-Day Rule: You can only book a floater seat for the next working day (${nextWorkingDay}). Dates further out are locked.`;
  } else if (!isAfter3PM) {
    reasonMsg = `🕒 Booking Closed: Floater seat bookings for tomorrow open today at <strong>3:00 PM (15:00)</strong>. Current simulated time is ${document.getElementById("sim-hour-label").textContent}.`;
  } else {
    // Check if they already have an active booking on that date
    const existingBk = state.bookings.find(b => b.employeeId === emp.id && b.date === targetDate && b.status === "active");
    
    if (existingBk) {
      if (existingBk.type === "designated") {
        // They have a designated seat, is it blocked?
        const userSeat = state.seats.find(s => s.id === emp.designatedSeat);
        const isBlocked = userSeat ? isSeatBlockedOnDate(userSeat, targetDate) : false;
        
        if (isBlocked) {
          isEligible = true;
          reasonMsg = `✅ Eligible: Your designated desk ${emp.designatedSeat} is blocked for tomorrow. You are approved to book a floater desk!`;
        } else {
          reasonMsg = `ℹ️ Designated Seat Active: You already have a designated seat (${emp.designatedSeat}) ready for tomorrow. No floater booking required!`;
        }
      } else {
        reasonMsg = `ℹ️ Already Booked: You already booked floater desk <strong>${existingBk.seatId}</strong> for this date.`;
      }
    } else {
      // They have no booking. Do they have a designated seat that is active?
      // Wait, if it was active it would have a seeded designated booking!
      // But what if they have no designated seat (like Employee 12)?
      isEligible = true;
      reasonMsg = `✅ Eligible: Floater seat bookings are open. You do not have an active desk for tomorrow.`;
    }
  }

  // Display status
  if (isEligible) {
    msgBox.className = "alert-box alert-success mt-4";
    msgBox.innerHTML = reasonMsg;
    proceedBtn.disabled = false;
    statusBadge.textContent = "Window Open";
    statusBadge.className = "window-indicator status-pill success";
  } else {
    msgBox.className = "alert-box alert-warning mt-4";
    msgBox.innerHTML = reasonMsg;
    proceedBtn.disabled = true;
    statusBadge.textContent = "Window Closed";
    statusBadge.className = "window-indicator status-pill danger";
  }
}

function openFloaterSeatSelection() {
  const targetDate = document.getElementById("floater-booking-date").value;
  // Set the plan view date input
  document.getElementById("plan-view-date").value = targetDate;
  // Pre-filter map to show floater available
  document.getElementById("seat-filter-type").value = "floater";
  
  switchView("seating-plan");
  showToast("Select Floater Desk", `Showing available floater desks for ${targetDate}. Click a desk to book.`, "info");
}

function renderUpcomingBookingsTable() {
  const emp = state.currentUser;
  const tbody = document.getElementById("dash-upcoming-bookings");
  tbody.innerHTML = "";

  // Get active bookings starting from simulated today
  const todayDate = getSimulatedTodayDate();
  
  const upcoming = state.bookings.filter(b => b.employeeId === emp.id && b.date >= todayDate && b.status === "active")
    .sort((a,b) => a.date.localeCompare(b.date));

  if (upcoming.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No upcoming office visits found.</td></tr>`;
    return;
  }

  upcoming.forEach(bk => {
    const isDesignated = bk.type === "designated";
    const userSeat = state.seats.find(s => s.id === bk.seatId);
    const isBlocked = userSeat ? isSeatBlockedOnDate(userSeat, bk.date) : false;

    let trClass = "";
    let seatDisplay = bk.seatId;
    let typeBadge = `<span class="status-pill info">Floater</span>`;
    let actionBtn = `<button class="btn btn-sm btn-danger" onclick="cancelFloaterBooking('${bk.id}')">Cancel</button>`;
    
    if (isDesignated) {
      typeBadge = `<span class="status-pill success">Designated</span>`;
      actionBtn = `<span class="text-secondary font-xs">-</span>`;
      if (isBlocked) {
        trClass = "text-danger";
        seatDisplay = `${bk.seatId} (Blocked)`;
        typeBadge = `<span class="status-pill danger">Designated</span>`;
      }
    }

    const tr = document.createElement("tr");
    if (trClass) tr.className = trClass;
    tr.innerHTML = `
      <td><strong>${bk.date}</strong></td>
      <td>${typeBadge}</td>
      <td><strong>${seatDisplay}</strong></td>
      <td><span class="status-pill success">Confirmed</span></td>
      <td>${actionBtn}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderMyBookings() {
  const emp = state.currentUser;
  const tbody = document.getElementById("my-bookings-list");
  tbody.innerHTML = "";

  const userBookings = state.bookings.filter(b => b.employeeId === emp.id)
    .sort((a, b) => b.date.localeCompare(a.date)); // Sort descending date for ledger

  if (userBookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No bookings ledger items found.</td></tr>`;
    return;
  }

  userBookings.forEach(bk => {
    const isDesignated = bk.type === "designated";
    let typeBadge = `<span class="status-pill info">Floater</span>`;
    let actionBtn = `<button class="btn btn-sm btn-danger" onclick="cancelFloaterBooking('${bk.id}')">Cancel</button>`;
    let lockLabel = `<span class="status-pill success">Acquired & Released</span>`;
    
    if (isDesignated) {
      typeBadge = `<span class="status-pill success">Designated</span>`;
      actionBtn = `<span class="text-secondary font-xs">-</span>`;
      lockLabel = `<span class="text-muted font-xs">Pre-assigned</span>`;
    }

    if (bk.status === "cancelled") {
      actionBtn = `<span class="text-danger font-xs">Cancelled</span>`;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${bk.date}</strong></td>
      <td>${typeBadge}</td>
      <td><strong>${bk.seatId}</strong></td>
      <td><span class="status-pill ${bk.status === 'active' ? 'success' : 'danger'}">${bk.status.toUpperCase()}</span></td>
      <td>${lockLabel}</td>
      <td>${actionBtn}</td>
    `;
    tbody.appendChild(tr);
  });
}

function cancelFloaterBooking(bookingId) {
  const bk = state.bookings.find(b => b.id === bookingId);
  if (!bk) return;
  
  if (confirm(`Are you sure you want to cancel your floater booking on seat ${bk.seatId} for ${bk.date}?`)) {
    bk.status = "cancelled";
    
    // Add log
    state.logs.push({
      time: new Date().toISOString().replace('T', ' ').substring(0, 19),
      user: state.currentUser.email,
      action: `Cancelled floater seat booking on desk ${bk.seatId}`,
      desk: bk.seatId,
      status: "success"
    });
    
    saveState();
    showToast("Booking Cancelled", `Floater seat ${bk.seatId} has been released.`, "success");
    refreshCurrentView();
  }
}

// --- INTERACTIVE SEATING PLAN SVG GENERATOR ---
function renderSeatingPlan() {
  const dateInput = document.getElementById("plan-view-date");
  // Set default plan date to simulated today if empty
  if (!dateInput.value) {
    dateInput.value = getSimulatedTodayDate();
  }
  
  const targetDate = dateInput.value;
  const desksGroup = document.getElementById("svg-desks-group");
  desksGroup.innerHTML = "";

  // Desk placement specifications
  // SVG size is 1000 x 650
  // Zone A: Top-Left (Squad A & B)
  // Zone B: Top-Right (Squad C & D)
  // Zone C: Bottom-Left (Squad E)
  // Zone D: Bottom-Right (Floater desks)
  
  // Let's position 40 designated desks in neat clusters
  // Desk D-01 to D-08 (Squad A): Cluster 1 & 2
  // Desk D-09 to D-16 (Squad B): Cluster 3 & 4
  // Desk D-17 to D-24 (Squad C): Cluster 5 & 6
  // Desk D-25 to D-32 (Squad D): Cluster 7 & 8
  // Desk D-33 to D-40 (Squad E): Cluster 9 & 10
  
  const deskLocations = {};

  // Helper to place clusters of 4 desks (2x2)
  // center x, center y, list of desk IDs (4 desks)
  function placeCluster(cx, cy, deskIds, direction = "horizontal") {
    // width 40, height 30, rx 4
    // spacing between desks is 10
    const offsets = [
      { x: -45, y: -35, chairY: -45, chairX: -35 },
      { x: 5, y: -35, chairY: -45, chairX: 15 },
      { x: -45, y: 5, chairY: 35, chairX: -35 },
      { x: 5, y: 5, chairY: 35, chairX: 15 }
    ];
    
    deskIds.forEach((id, idx) => {
      if (idx < 4) {
        deskLocations[id] = {
          x: cx + offsets[idx].x,
          y: cy + offsets[idx].y,
          chairX: cx + offsets[idx].x + 10,
          chairY: cy + offsets[idx].y + (offsets[idx].y < 0 ? -10 : 30)
        };
      }
    });
  }

  // Zone A placements (X: 50 - 450, Y: 50 - 280)
  placeCluster(130, 180, ["D-01", "D-02", "D-03", "D-04"]);
  placeCluster(250, 180, ["D-05", "D-06", "D-07", "D-08"]);
  placeCluster(370, 180, ["D-09", "D-10", "D-11", "D-12"]);
  placeCluster(250, 280, ["D-13", "D-14", "D-15", "D-16"]);

  // Zone B placements (X: 550 - 950, Y: 50 - 280)
  placeCluster(630, 180, ["D-17", "D-18", "D-19", "D-20"]);
  placeCluster(750, 180, ["D-21", "D-22", "D-23", "D-24"]);
  placeCluster(870, 180, ["D-25", "D-26", "D-27", "D-28"]);
  placeCluster(750, 280, ["D-29", "D-30", "D-31", "D-32"]);

  // Zone C placements (X: 50 - 450, Y: 350 - 580)
  placeCluster(130, 450, ["D-33", "D-34", "D-35", "D-36"]);
  placeCluster(310, 450, ["D-37", "D-38", "D-39", "D-40"]);

  // Zone D placements - Float Desks (X: 550 - 950, Y: 350 - 580)
  // Let's place floaters F-01 to F-10 in linear clusters
  placeCluster(680, 450, ["F-01", "F-02", "F-03", "F-04"]);
  placeCluster(820, 450, ["F-05", "F-06", "F-07", "F-08"]);
  
  // F-09, F-10 two desk cluster
  deskLocations["F-09"] = { x: 910, y: 415, chairX: 920, chairY: 405 };
  deskLocations["F-10"] = { x: 910, y: 455, chairX: 920, chairY: 485 };

  // Render SVG Elements
  state.seats.forEach(seat => {
    const loc = deskLocations[seat.id];
    if (!loc) return;

    // Determine seat state for targetDate
    const status = getSeatStatusOnDate(seat, targetDate);
    const occupant = getSeatOccupantOnDate(seat, targetDate);
    const isUserDesk = state.currentUser.role === "employee" && isEmployeeSeat(state.currentUser, seat.id);

    // Apply Search/Squad filters
    const searchVal = document.getElementById("seat-search").value.toLowerCase();
    const filterSquad = document.getElementById("seat-filter-squad").value;
    const filterType = document.getElementById("seat-filter-type").value;

    let visible = true;

    if (searchVal) {
      const occupantName = occupant ? occupant.fullName.toLowerCase() : "";
      const seatIdLower = seat.id.toLowerCase();
      if (!occupantName.includes(searchVal) && !seatIdLower.includes(searchVal)) {
        visible = false;
      }
    }

    if (filterSquad !== "all") {
      if (seat.type === "floater") {
        visible = false; // Floaters have no squad area
      } else if (seat.squadArea !== filterSquad) {
        visible = false;
      }
    }

    if (filterType !== "all") {
      if (filterType === "designated" && seat.type !== "designated") visible = false;
      if (filterType === "floater" && seat.type !== "floater") visible = false;
      if (filterType === "blocked" && status !== "blocked") visible = false;
    }

    if (!visible) return;

    // Create SVG Node `<g>`
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", `desk-group type-${seat.type} status-${status} ${isUserDesk ? 'is-user-desk' : ''}`);
    g.setAttribute("id", `svg-desk-${seat.id}`);
    g.setAttribute("onclick", `selectSeatInspector('${seat.id}')`);

    // Rect (Desk)
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", loc.x);
    rect.setAttribute("y", loc.y);
    rect.setAttribute("width", 40);
    rect.setAttribute("height", 30);
    rect.setAttribute("rx", 6);
    rect.setAttribute("class", "desk-rect");
    g.appendChild(rect);

    // Chair representation
    const chair = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    chair.setAttribute("x", loc.chairX);
    chair.setAttribute("y", loc.chairY);
    chair.setAttribute("width", 20);
    chair.setAttribute("height", 8);
    chair.setAttribute("rx", 2);
    chair.setAttribute("fill", "var(--text-muted)");
    chair.setAttribute("opacity", 0.7);
    g.appendChild(chair);

    // Label (Seat ID)
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", loc.x + 20);
    text.setAttribute("y", loc.y + 14);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("class", "desk-label");
    text.textContent = seat.id;
    g.appendChild(text);

    // Sublabel (Occupant or Squad)
    const subtext = document.createElementNS("http://www.w3.org/2000/svg", "text");
    subtext.setAttribute("x", loc.x + 20);
    subtext.setAttribute("y", loc.y + 24);
    subtext.setAttribute("text-anchor", "middle");
    subtext.setAttribute("class", "desk-sublabel");
    
    if (status === "blocked") {
      subtext.textContent = "BLOCKED";
      subtext.setAttribute("fill", "var(--danger)");
    } else if (status === "occupied" && occupant) {
      // Show first name
      subtext.textContent = occupant.fullName.split(" ")[0];
    } else {
      subtext.textContent = seat.type === "designated" ? "DESIG" : "FLOAT";
    }
    g.appendChild(subtext);

    desksGroup.appendChild(g);
  });

  // Re-initialize Lucide Icons loaded dynamically
  lucide.createIcons();
}

function onPlanDateChange() {
  renderSeatingPlan();
  
  // If a desk was selected, refresh the inspector for the new date
  const inspector = document.getElementById("seat-inspector-body");
  const activeDeskIdEl = inspector.querySelector(".seat-id-token");
  if (activeDeskIdEl) {
    selectSeatInspector(activeDeskIdEl.textContent.trim());
  }
}

function filterSeatingPlan() {
  renderSeatingPlan();
}

function simulateLiveRefresh() {
  const icon = document.getElementById("btn-refresh-icon");
  icon.classList.add("spin-animation");
  
  setTimeout(() => {
    icon.classList.remove("spin-animation");
    renderSeatingPlan();
    showToast("Map Refreshed", "Interactive seating plan synchronized with database.", "success");
  }, 750);
}

// Seat Checker Rules
function isSeatBlockedOnDate(seat, dateStr) {
  return seat.blocks.some(b => {
    if (b.type === "permanent") return true;
    if (b.type === "single-date" && b.date === dateStr) return true;
    if (b.type === "date-range" && dateStr >= b.startDate && dateStr <= b.endDate) return true;
    return false;
  });
}

function getSeatStatusOnDate(seat, dateStr) {
  if (isSeatBlockedOnDate(seat, dateStr)) {
    return "blocked";
  }
  
  // Check if booking exists
  const activeBooking = state.bookings.find(b => b.seatId === seat.id && b.date === dateStr && b.status === "active");
  if (activeBooking) {
    return "occupied";
  }
  
  return "available";
}

function getSeatOccupantOnDate(seat, dateStr) {
  const activeBooking = state.bookings.find(b => b.seatId === seat.id && b.date === dateStr && b.status === "active");
  if (activeBooking) {
    return state.employees.find(e => e.id === activeBooking.employeeId);
  }
  return null;
}

// Returns if seat ID matches the employee's designated seat
function isEmployeeSeat(employee, seatId) {
  return employee.designatedSeat === seatId;
}

// --- DESK INSPECTOR PANEL (Seating View Right Column) ---
function selectSeatInspector(seatId) {
  // Highlight selected desk in SVG
  const allGroups = document.querySelectorAll(".desk-group");
  allGroups.forEach(g => g.classList.remove("selected"));

  const targetGroup = document.getElementById(`svg-desk-${seatId}`);
  if (targetGroup) targetGroup.classList.add("selected");

  const targetDate = document.getElementById("plan-view-date").value;
  const seat = state.seats.find(s => s.id === seatId);
  const inspector = document.getElementById("seat-inspector-body");
  
  if (!seat) return;

  const status = getSeatStatusOnDate(seat, targetDate);
  const occupant = getSeatOccupantOnDate(seat, targetDate);
  
  // Details building
  let badgeClass = "tag-designated";
  if (seat.type === "floater") badgeClass = "tag-floater";
  if (status === "blocked") badgeClass = "tag-blocked";

  let statusHtml = "";
  if (status === "blocked") {
    const activeBlock = seat.blocks.find(b => {
      if (b.type === "permanent") return true;
      if (b.type === "single-date" && b.date === targetDate) return true;
      if (b.type === "date-range" && targetDate >= b.startDate && targetDate <= b.endDate) return true;
      return false;
    });
    statusHtml = `
      <div class="alert-box alert-danger mt-2">
        <strong>Blocked by Administrator</strong>
        <p class="font-xs mt-1">Reason: ${activeBlock.reason || 'None provided'}</p>
      </div>
    `;
  } else if (status === "occupied" && occupant) {
    statusHtml = `
      <div class="occupant-profile-box mt-4">
        <h6>CURRENT OCCUPANT</h6>
        <div class="occupant-details">
          <div class="user-avatar">${occupant.fullName.split(" ").map(n=>n[0]).join("")}</div>
          <div class="occupant-info">
            <strong>${occupant.fullName}</strong>
            <span>${occupant.squad} • Batch ${occupant.batch}</span>
            <span class="font-xs text-muted">${occupant.email}</span>
          </div>
        </div>
      </div>
    `;
  } else {
    statusHtml = `
      <div class="alert-box alert-success mt-2">
        <strong>Desk Available</strong>
        <p class="font-xs">This desk is free for allocation on ${targetDate}.</p>
      </div>
    `;
  }

  // Action Button config
  let actionBtnHtml = "";
  const isEmployee = state.currentUser.role === "employee";
  
  if (isEmployee) {
    const emp = state.currentUser;
    const isTargetOfficeDay = getEmployeeOfficeDaysInWeek(emp, DATE_TO_DAY_WEEK[targetDate].week).includes(DATE_TO_DAY_WEEK[targetDate].day);
    const today = getSimulatedTodayDate();
    const nextWorkingDay = getNextWorkingDay(today);
    const isPrecedingDay = (targetDate === nextWorkingDay);
    const isAfter3PM = state.simHour >= 15;
    
    // Check if employee already has a booking
    const alreadyBooked = state.bookings.find(b => b.employeeId === emp.id && b.date === targetDate && b.status === "active");

    if (status === "available" && seat.type === "floater") {
      let disableReason = "";
      if (alreadyBooked) disableReason = "You already have a seat booked for this date.";
      else if (!isTargetOfficeDay) disableReason = "This date is not your scheduled office batch day.";
      else if (!isPrecedingDay) disableReason = "You can only book for the next working day.";
      else if (!isAfter3PM) disableReason = "Floater bookings open after 3:00 PM.";
      
      if (disableReason) {
        actionBtnHtml = `
          <button class="btn btn-primary w-full mt-4" disabled>
            <i data-lucide="lock"></i> Booking Restricted
          </button>
          <p class="font-xs text-center text-muted mt-2">${disableReason}</p>
        `;
      } else {
        actionBtnHtml = `
          <button class="btn btn-primary w-full mt-4" onclick="bookFloaterSeat('${seat.id}', '${targetDate}')">
            <i data-lucide="check-square"></i> Book Floater Desk
          </button>
        `;
      }
    } else if (alreadyBooked && alreadyBooked.seatId === seat.id && seat.type === "floater") {
      actionBtnHtml = `
        <button class="btn btn-danger w-full mt-4" onclick="cancelFloaterBooking('${alreadyBooked.id}')">
          <i data-lucide="trash-2"></i> Cancel Booking
        </button>
      `;
    }
  } else {
    // Admin Inspector buttons
    actionBtnHtml = `
      <div class="flex flex-col gap-2 mt-4">
        <button class="btn btn-outline-secondary w-full" onclick="openBlockSeatModal('${seat.id}')">
          <i data-lucide="ban"></i> Block / Restrict Seat
        </button>
        ${seat.blocks.length > 0 ? `
          <button class="btn btn-outline-primary w-full" onclick="removeSeatBlocks('${seat.id}')">
            <i data-lucide="check-circle"></i> Clear Active Blocks
          </button>
        ` : ''}
        <button class="btn btn-outline-secondary w-full" onclick="toggleSeatType('${seat.id}')">
          <i data-lucide="refresh-cw"></i> Switch to ${seat.type === 'designated' ? 'Floater' : 'Designated'} Type
        </button>
      </div>
    `;
  }

  // Build the complete panel HTML
  inspector.innerHTML = `
    <div class="inspector-header">
      <h5 class="seat-id-token">${seat.id}</h5>
      <span class="seat-tag ${badgeClass}">${seat.type.toUpperCase()}</span>
    </div>
    
    <div class="inspector-meta-list">
      <div class="meta-row">
        <span>Squad Location:</span>
        <strong>${seat.squadArea}</strong>
      </div>
      <div class="meta-row">
        <span>Target Date:</span>
        <strong>${targetDate}</strong>
      </div>
      <div class="meta-row">
        <span>Current Status:</span>
        <strong>${status.toUpperCase()}</strong>
      </div>
    </div>

    ${statusHtml}
    
    ${actionBtnHtml}
  `;

  // Initialize Lucide icons
  lucide.createIcons();
}

// SIMULATE REDIS DISTRIBUTED LOCK ON BOOKING
function bookFloaterSeat(seatId, targetDate) {
  const emp = state.currentUser;
  const inspector = document.getElementById("seat-inspector-body");
  
  // Disable inspector UI and show lock animation
  inspector.innerHTML = `
    <div class="flex-col items-center justify-center text-center p-6" style="min-height: 250px; display: flex;">
      <div class="spin-animation mb-4" style="border: 4px solid var(--border-color); border-top-color: var(--primary-light); width: 40px; height: 40px; border-radius: 50%;"></div>
      <h5 class="text-warning">Acquiring Redis Lock...</h5>
      <code class="font-xs block text-muted mt-2">LOCK:SEAT:${seatId}:${targetDate}</code>
      <p class="font-xs mt-4">Validating distributed concurrency buffers to prevent double-booking collisions.</p>
    </div>
  `;

  // Simulating the 800ms lock attempt
  setTimeout(() => {
    // Re-verify seat is still available in memory (simulate concurrent database transactions)
    const seat = state.seats.find(s => s.id === seatId);
    const status = getSeatStatusOnDate(seat, targetDate);

    if (status !== "available") {
      showToast("Redis Lock Conflict", "Double booking prevention triggered! Seat was taken in a competing threads transaction.", "danger");
      selectSeatInspector(seatId); // Reset view
      return;
    }

    // Success: Write booking
    const bookingId = `bk-${Math.random().toString(36).substr(2, 9)}`;
    state.bookings.push({
      id: bookingId,
      employeeId: emp.id,
      seatId: seatId,
      date: targetDate,
      type: "floater",
      status: "active",
      lockStatus: "released" // Released once transaction commits!
    });

    // Write log
    state.logs.push({
      time: new Date().toISOString().replace('T', ' ').substring(0, 19),
      user: emp.email,
      action: `Redis Lock acquired. Booked floater desk ${seatId} for ${targetDate}`,
      desk: seatId,
      status: "success"
    });

    saveState();
    showToast("Booking Successful", `Floater seat ${seatId} has been secured for ${targetDate}!`, "success");
    
    // Refresh components
    renderSeatingPlan();
    selectSeatInspector(seatId);
  }, 1000);
}

// --- ADMIN CONTROL ACTIONS ---

// 1. Seat Blocking Forms
function openBlockSeatModal(seatId) {
  document.getElementById("block-seat-id").value = seatId;
  
  // Set default dates
  const today = getSimulatedTodayDate();
  document.getElementById("block-single-date").value = today;
  document.getElementById("block-start-date").value = today;
  document.getElementById("block-end-date").value = today;
  document.getElementById("block-reason").value = "";
  
  // Show modal
  document.getElementById("modal-block-desk").classList.remove("hidden");
  
  // Initialize form visibility
  toggleBlockTypeInputs("permanent");
}

function toggleBlockTypeInputs(type) {
  const singleDateGroup = document.getElementById("block-single-date-group");
  const rangeGroup = document.getElementById("block-range-group");
  
  if (type === "permanent") {
    singleDateGroup.classList.add("hidden");
    rangeGroup.classList.add("hidden");
  } else if (type === "single-date") {
    singleDateGroup.classList.remove("hidden");
    rangeGroup.classList.add("hidden");
  } else {
    singleDateGroup.classList.add("hidden");
    rangeGroup.classList.remove("hidden");
  }
}

function submitBlockSeat() {
  const seatId = document.getElementById("block-seat-id").value;
  const blockType = document.getElementById("block-type-select").value;
  const reason = document.getElementById("block-reason").value.trim() || "Maintenance Block";
  
  const seat = state.seats.find(s => s.id === seatId);
  if (!seat) return;

  let blockConfig = { type: blockType, reason: reason };

  if (blockType === "single-date") {
    blockConfig.date = document.getElementById("block-single-date").value;
  } else if (blockType === "date-range") {
    blockConfig.startDate = document.getElementById("block-start-date").value;
    blockConfig.endDate = document.getElementById("block-end-date").value;
    if (blockConfig.startDate > blockConfig.endDate) {
      showToast("Validation Error", "Start date cannot exceed end date.", "danger");
      return;
    }
  }

  seat.blocks.push(blockConfig);

  // CASCADE CANCELLATION: cancel any active bookings on this seat matching the block config
  let cancelledCount = 0;
  state.bookings.forEach(bk => {
    if (bk.seatId === seatId && bk.status === "active") {
      let matches = false;
      if (blockType === "permanent") matches = true;
      else if (blockType === "single-date" && bk.date === blockConfig.date) matches = true;
      else if (blockType === "date-range" && bk.date >= blockConfig.startDate && bk.date <= blockConfig.endDate) matches = true;
      
      if (matches) {
        bk.status = "cancelled";
        cancelledCount++;
        // Add log for cancellation
        state.logs.push({
          time: new Date().toISOString().replace('T', ' ').substring(0, 19),
          user: "system-cascade",
          action: `Automated cancellation: seat ${seatId} blocked for date ${bk.date}`,
          desk: seatId,
          status: "warning"
        });
      }
    }
  });

  // Log the action
  state.logs.push({
    time: new Date().toISOString().replace('T', ' ').substring(0, 19),
    user: state.currentUser.email,
    action: `Created block type [${blockType}] on seat ${seatId}`,
    desk: seatId,
    status: "success"
  });

  saveState();
  closeModal("modal-block-desk");
  
  let msg = `Seat ${seatId} has been blocked successfully.`;
  if (cancelledCount > 0) {
    msg += ` Released ${cancelledCount} active booking(s).`;
    showToast("Cascaded Cancellations", `Released ${cancelledCount} conflicting seat reservations.`, "warning");
  } else {
    showToast("Seat Blocked", msg, "success");
  }

  refreshCurrentView();
}

function removeSeatBlocks(seatId) {
  const seat = state.seats.find(s => s.id === seatId);
  if (!seat) return;

  if (confirm(`Clear all block restrictions from seat ${seatId}?`)) {
    seat.blocks = [];
    
    state.logs.push({
      time: new Date().toISOString().replace('T', ' ').substring(0, 19),
      user: state.currentUser.email,
      action: `Cleared all block rules for seat ${seatId}`,
      desk: seatId,
      status: "success"
    });

    saveState();
    showToast("Blocks Cleared", `Seat ${seatId} blocks have been removed.`, "success");
    refreshCurrentView();
  }
}

function toggleSeatType(seatId) {
  const seat = state.seats.find(s => s.id === seatId);
  if (!seat) return;

  const newType = seat.type === "designated" ? "floater" : "designated";
  
  // If switching designated to floater, clear default designated occupant associations
  if (newType === "floater") {
    // Clear designatedSeat field on any employee assigned to this seat
    state.employees.forEach(emp => {
      if (emp.designatedSeat === seatId) {
        emp.designatedSeat = null;
      }
    });
  }

  seat.type = newType;
  seat.squadArea = newType === "floater" ? "Floater Area" : "Squad A"; // Default placeholder squad

  state.logs.push({
    time: new Date().toISOString().replace('T', ' ').substring(0, 19),
    user: state.currentUser.email,
    action: `Converted seat template of ${seatId} to [${newType}]`,
    desk: seatId,
    status: "success"
  });

  saveState();
  showToast("Seat Converted", `Desk ${seatId} converted to ${newType} type.`, "success");
  refreshCurrentView();
}

// 2. Admin Seats Table View Generator
function renderAdminSeats() {
  const filterType = document.getElementById("admin-seat-filter-type").value;
  const today = getSimulatedTodayDate();
  const tbody = document.getElementById("admin-seats-table-body");
  tbody.innerHTML = "";

  state.seats.forEach(seat => {
    // Filter
    const todayStatus = getSeatStatusOnDate(seat, today);
    if (filterType === "designated" && seat.type !== "designated") return;
    if (filterType === "floater" && seat.type !== "floater") return;
    if (filterType === "blocked" && todayStatus !== "blocked") return;

    // Get block text
    let blocksDesc = "No active blocks";
    if (seat.blocks.length > 0) {
      blocksDesc = seat.blocks.map(b => {
        if (b.type === "permanent") return "Permanent";
        if (b.type === "single-date") return `Single: ${b.date}`;
        return `Range: ${b.startDate} to ${b.endDate}`;
      }).join(", ");
    }

    // Get default allocation user details
    let assignmentText = "-";
    if (seat.type === "designated") {
      const assignedEmps = state.employees.filter(e => e.designatedSeat === seat.id);
      if (assignedEmps.length > 0) {
        assignmentText = assignedEmps.map(e => `${e.fullName} (B${e.batch})`).join(" & ");
      } else {
        assignmentText = "Unassigned / Open";
      }
    }

    // Status pill
    let statPill = `<span class="status-pill success">Available</span>`;
    if (todayStatus === "blocked") statPill = `<span class="status-pill danger">Blocked</span>`;
    else if (todayStatus === "occupied") statPill = `<span class="status-pill info">Occupied</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${seat.id}</strong></td>
      <td><span class="status-pill ${seat.type === 'designated' ? 'info' : 'warning'}">${seat.type.toUpperCase()}</span></td>
      <td>${seat.squadArea}</td>
      <td class="font-xs">${assignmentText}</td>
      <td>${statPill}</td>
      <td class="font-xs text-secondary">${blocksDesc}</td>
      <td>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-outline-secondary" onclick="openBlockSeatModal('${seat.id}')">Block</button>
          ${seat.blocks.length > 0 ? `<button class="btn btn-sm btn-outline-primary" onclick="removeSeatBlocks('${seat.id}')">Unblock</button>` : ''}
          <button class="btn btn-sm btn-outline-secondary" onclick="toggleSeatType('${seat.id}')">Convert</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 3. Admin Employee View Generator
function renderAdminEmployees() {
  const searchVal = document.getElementById("admin-employee-search").value.toLowerCase();
  const filterBatch = document.getElementById("admin-employee-filter-batch").value;
  const filterSquad = document.getElementById("admin-employee-filter-squad").value;
  
  const tbody = document.getElementById("admin-employees-table-body");
  tbody.innerHTML = "";

  state.employees.forEach(emp => {
    // Filters
    if (searchVal && !emp.fullName.toLowerCase().includes(searchVal) && !emp.email.toLowerCase().includes(searchVal)) return;
    if (filterBatch !== "all" && emp.batch !== parseInt(filterBatch)) return;
    if (filterSquad !== "all" && emp.squad !== filterSquad) return;

    const isChecked = emp.status === "active";
    const designatedDesk = emp.designatedSeat ? emp.designatedSeat : "None";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="flex items-center gap-2">
          <div class="user-avatar" style="width: 32px; height: 32px; font-size: 0.8rem;">${emp.fullName.split(" ").map(n=>n[0]).join("")}</div>
          <div>
            <strong>${emp.fullName}</strong>
            <span class="description-text block" style="font-size: 0.75rem;">${emp.email}</span>
          </div>
        </div>
      </td>
      <td>${emp.squad}</td>
      <td>
        <select class="form-select form-select-sm font-xs" onchange="updateEmployeeBatch('${emp.id}', this.value)">
          <option value="1" ${emp.batch === 1 ? 'selected' : ''}>Batch 1 (Mon-Wed)</option>
          <option value="2" ${emp.batch === 2 ? 'selected' : ''}>Batch 2 (Thu-Fri)</option>
        </select>
      </td>
      <td>
        <select class="form-select form-select-sm font-xs" onchange="updateEmployeeSeat('${emp.id}', this.value)">
          <option value="">None</option>
          ${state.seats.filter(s => s.type === "designated").map(s => `
            <option value="${s.id}" ${emp.designatedSeat === s.id ? 'selected' : ''}>${s.id}</option>
          `).join('')}
        </select>
      </td>
      <td>
        <label class="switch">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleEmployeeActive('${emp.id}', this.checked)">
          <span class="slider"></span>
        </label>
      </td>
      <td>
        <button class="btn btn-sm btn-outline-secondary" onclick="showEmployeeStats('${emp.id}')">Stats</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function updateEmployeeBatch(empId, batchVal) {
  const emp = state.employees.find(e => e.id === empId);
  if (!emp) return;
  
  emp.batch = parseInt(batchVal);
  saveState();
  showToast("Employee Updated", `${emp.fullName} moved to Batch ${batchVal}.`, "success");
}

function updateEmployeeSeat(empId, seatId) {
  const emp = state.employees.find(e => e.id === empId);
  if (!emp) return;

  emp.designatedSeat = seatId || null;
  saveState();
  showToast("Employee Updated", `${emp.fullName} assigned to desk ${seatId || 'None'}.`, "success");
}

function toggleEmployeeActive(empId, isChecked) {
  const emp = state.employees.find(e => e.id === empId);
  if (!emp) return;

  const newStatus = isChecked ? "active" : "inactive";
  emp.status = newStatus;

  let extraMsg = "";
  if (newStatus === "inactive") {
    // Cancel all future active bookings for this employee!
    let cancelledCount = 0;
    const today = getSimulatedTodayDate();
    
    state.bookings.forEach(bk => {
      if (bk.employeeId === empId && bk.date >= today && bk.status === "active") {
        bk.status = "cancelled";
        cancelledCount++;
      }
    });
    
    if (cancelledCount > 0) extraMsg = ` Released ${cancelledCount} upcoming booking reservations.`;
  }

  state.logs.push({
    time: new Date().toISOString().replace('T', ' ').substring(0, 19),
    user: state.currentUser.email,
    action: `Changed status of ${emp.fullName} to [${newStatus}]`,
    desk: "-",
    status: isChecked ? "success" : "warning"
  });

  saveState();
  showToast("Status Changed", `Account of ${emp.fullName} is now ${newStatus}.${extraMsg}`, "info");
  
  // Refresh views
  renderAdminEmployees();
}

function showEmployeeStats(empId) {
  const emp = state.employees.find(e => e.id === empId);
  if (!emp) return;

  const bks = state.bookings.filter(b => b.employeeId === empId);
  const activeCount = bks.filter(b => b.status === "active").length;
  const cancelCount = bks.filter(b => b.status === "cancelled").length;

  alert(`Employee Record Summary:\n\nName: ${emp.fullName}\nSquad: ${emp.squad}\nBatch Rotation: Batch ${emp.batch}\nDesignated seat: ${emp.designatedSeat || 'None'}\n\nLedger Totals:\nActive Bookings: ${activeCount}\nCancelled Bookings: ${cancelCount}`);
}

// 4. Admin Holidays View Generator
function renderAdminHolidays() {
  const tbody = document.getElementById("admin-holidays-table-body");
  tbody.innerHTML = "";

  state.holidays.sort((a,b) => a.date.localeCompare(b.date)).forEach(h => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${h.date}</strong></td>
      <td>${h.name}</td>
      <td><span class="status-pill danger">All Bookings Cancelled</span></td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="removeCompanyHoliday('${h.date}')">Remove</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function addCompanyHoliday(event) {
  event.preventDefault();
  const name = document.getElementById("holiday-name").value.trim();
  const dateStr = document.getElementById("holiday-date").value;
  
  if (state.holidays.some(h => h.date === dateStr)) {
    showToast("Duplicate Error", "A company holiday is already registered for this date.", "danger");
    return;
  }

  // Create Holiday
  state.holidays.push({
    date: dateStr,
    name: name,
    createdBy: state.currentUser.email
  });

  // CASCADE RELEASES: cancel all active bookings (designated or floater) on that day!
  let releasedCount = 0;
  state.bookings.forEach(bk => {
    if (bk.date === dateStr && bk.status === "active") {
      bk.status = "cancelled";
      releasedCount++;
      // Write cascade log
      state.logs.push({
        time: new Date().toISOString().replace('T', ' ').substring(0, 19),
        user: "system-cascade",
        action: `Released seat ${bk.seatId} automatically due to newly added holiday: ${name}`,
        desk: bk.seatId,
        status: "warning"
      });
    }
  });

  // Write admin action log
  state.logs.push({
    time: new Date().toISOString().replace('T', ' ').substring(0, 19),
    user: state.currentUser.email,
    action: `Added company holiday: ${name} on ${dateStr}`,
    desk: "-",
    status: "success"
  });

  saveState();
  
  document.getElementById("holiday-name").value = "";
  document.getElementById("holiday-date").value = "";
  
  showToast("Holiday Added", `Holiday "${name}" registered on ${dateStr}. released ${releasedCount} seats.`, "success");
  
  refreshCurrentView();
}

function removeCompanyHoliday(dateStr) {
  if (confirm(`Remove the company holiday scheduled for ${dateStr}?`)) {
    state.holidays = state.holidays.filter(h => h.date !== dateStr);
    
    state.logs.push({
      time: new Date().toISOString().replace('T', ' ').substring(0, 19),
      user: state.currentUser.email,
      action: `Deleted company holiday rule for ${dateStr}`,
      desk: "-",
      status: "success"
    });

    saveState();
    showToast("Holiday Deleted", `Office status restored to normal working schedules for ${dateStr}.`, "success");
    refreshCurrentView();
  }
}

// 5. Admin Reports & Analytics View
function renderAdminReports() {
  // Update KPI counters dynamically
  const today = getSimulatedTodayDate();
  
  // Total Desks
  const totalSeats = state.seats.length;
  document.getElementById("admin-kpi-total").textContent = `${totalSeats} Desks`;
  
  // Occupied Desks today
  const bksToday = state.bookings.filter(b => b.date === today && b.status === "active");
  const occupiedCount = bksToday.length;
  const utilRate = Math.round((occupiedCount / totalSeats) * 100);
  
  document.getElementById("admin-kpi-occupied").textContent = `${occupiedCount} Desks`;
  document.getElementById("admin-kpi-utilization").textContent = `${utilRate}% utilization rate today`;

  // Floater Bookings occupied
  const floaterBks = bksToday.filter(b => b.type === "floater").length;
  const totalFloaters = state.seats.filter(s => s.type === "floater").length;
  const floaterRate = Math.round((floaterBks / totalFloaters) * 100) || 0;
  
  document.getElementById("admin-kpi-floaters").textContent = `${floaterBks} Booked`;
  document.getElementById("admin-kpi-floaters-rate").textContent = `${floaterRate}% capacity booked (${floaterBks}/${totalFloaters})`;

  // Blocked Desks today
  const blockedCount = state.seats.filter(s => isSeatBlockedOnDate(s, today)).length;
  document.getElementById("admin-kpi-blocked").textContent = `${blockedCount} Blocked`;
  document.getElementById("admin-kpi-blocked-sub").textContent = `Unavailable due to admin blocks`;

  // Render utilization by Squad graphs
  // For simplicity, calculate from total bookings across all days
  const squads = ["Squad A", "Squad B", "Squad C", "Squad D", "Squad E"];
  const barContainer = document.getElementById("reports-squad-bars");
  barContainer.innerHTML = "";

  squads.forEach(sq => {
    // Count employees in squad
    const squadEmps = state.employees.filter(e => e.squad === sq && e.status === "active");
    const squadEmpIds = squadEmps.map(e => e.id);
    
    // Count active bookings for squad
    const activeBks = state.bookings.filter(b => squadEmpIds.includes(b.employeeId) && b.status === "active").length;
    
    // Calculate a simulated average compliance percentage
    let rate = Math.round((activeBks / (squadEmps.length * 3)) * 100); // 3 days expected avg in-office
    if (rate > 100) rate = 100;
    if (isNaN(rate)) rate = 0;
    
    const row = document.createElement("div");
    row.className = "squad-bar-row";
    row.innerHTML = `
      <div class="squad-bar-label">
        <span>${sq} (${squadEmps.length} active members)</span>
        <strong>${rate}% Avg Occupancy</strong>
      </div>
      <div class="squad-bar-track">
        <div class="squad-bar-fill" style="width: ${rate}%;"></div>
      </div>
    `;
    barContainer.appendChild(row);
  });

  // Render logs
  const logsTbody = document.getElementById("admin-reports-logs-body");
  logsTbody.innerHTML = "";

  // Sort logs by time descending
  state.logs.slice().reverse().forEach(lg => {
    let statPill = `<span class="status-pill success">Success</span>`;
    if (lg.status === "warning") statPill = `<span class="status-pill warning">Alert</span>`;
    else if (lg.status === "danger") statPill = `<span class="status-pill danger">Failed</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="text-secondary font-xs">${lg.time}</span></td>
      <td><strong>${lg.user}</strong></td>
      <td style="font-size: 0.85rem;">${lg.action}</td>
      <td><code>${lg.desk}</code></td>
      <td>${statPill}</td>
    `;
    logsTbody.appendChild(tr);
  });
}

function simulateExportCSV() {
  showToast("Generating CSV", "Compiling bookings data ledger...", "info");
  
  setTimeout(() => {
    let csv = "BookingID,Date,EmployeeName,EmployeeEmail,Squad,SeatID,AllocationType,Status,RedisLock\n";
    
    state.bookings.forEach(b => {
      const emp = state.employees.find(e => e.id === b.employeeId) || { fullName: "Admin System", email: "system@smartseat.local", squad: "Admin" };
      csv += `${b.id},${b.date},"${emp.fullName}",${emp.email},"${emp.squad}",${b.seatId},${b.type},${b.status},${b.type === 'floater' ? 'concurrency-checked' : 'static-lease'}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `SmartSeat_Bookings_Report_${getSimulatedTodayDate()}.csv`);
    a.click();

    state.logs.push({
      time: new Date().toISOString().replace('T', ' ').substring(0, 19),
      user: state.currentUser.email,
      action: "Exported bookings ledger to CSV spreadsheet",
      desk: "-",
      status: "success"
    });
    saveState();

    showToast("CSV Downloaded", "Spreadsheet exported successfully.", "success");
    refreshCurrentView();
  }, 1000);
}

// --- UTILITIES / DIALOGS ---
function showToast(title, msg, type = "info") {
  const container = document.getElementById("toast-container");
  
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  let iconName = "info";
  if (type === "success") iconName = "check-circle";
  else if (type === "warning") iconName = "alert-triangle";
  else if (type === "danger") iconName = "ban";

  toast.innerHTML = `
    <i data-lucide="${iconName}" class="toast-icon"></i>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${msg}</div>
    </div>
  `;
  
  container.appendChild(toast);
  
  // Initialize Lucide Icons for toast
  lucide.createIcons();

  // Slide out and remove
  setTimeout(() => {
    toast.style.transform = "translateX(100%)";
    toast.style.opacity = "0";
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add("hidden");
}

// THEME TOGGLE
function toggleTheme() {
  if (state.theme === "dark") {
    state.theme = "light";
    document.body.classList.remove("dark-mode");
    document.body.classList.add("light-mode");
    localStorage.setItem("ss_theme", "light");
  } else {
    state.theme = "dark";
    document.body.classList.remove("light-mode");
    document.body.classList.add("dark-mode");
    localStorage.setItem("ss_theme", "dark");
  }
}

// RUN ON LOAD
window.addEventListener("DOMContentLoaded", initApp);
