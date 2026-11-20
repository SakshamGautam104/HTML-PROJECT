'use strict';

/* =========================================================
   AURA-ER — application logic (demo data, local session only)
   ========================================================= */

/* ---------- Reference data ---------- */
const DEPARTMENTS = {
  Trauma:     { label: 'Trauma & Resuscitation', prefix: 'TR', count: 6,  icon: 'fa-truck-medical' },
  Cardiology: { label: 'Cardiology',             prefix: 'CD', count: 6,  icon: 'fa-heart-pulse' },
  Neurology:  { label: 'Neurology & Stroke',     prefix: 'NE', count: 5,  icon: 'fa-brain' },
  Pediatric:  { label: 'Pediatric Emergency',    prefix: 'PD', count: 6,  icon: 'fa-baby' },
  General:    { label: 'General Emergency',      prefix: 'GE', count: 10, icon: 'fa-hospital' }
};

const TRIAGE = {
  RED:    { label: 'Critical', esi: 'ESI 1', rank: 1, icon: 'fa-triangle-exclamation', badge: 'bg-red-50 text-aura-red border-red-200' },
  YELLOW: { label: 'Urgent',   esi: 'ESI 2', rank: 2, icon: 'fa-circle-exclamation',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  GREEN:  { label: 'Stable',   esi: 'ESI 3', rank: 3, icon: 'fa-circle-check',         badge: 'bg-green-50 text-green-700 border-green-200' }
};

const STATUS_BADGE = {
  'Triage':        'bg-slate-100 text-slate-700 border-slate-200',
  'Bed Allocated': 'bg-blue-50 text-blue-700 border-blue-200',
  'In Treatment':  'bg-teal-50 text-teal-700 border-teal-200',
  'Lab / Scan':    'bg-violet-50 text-violet-700 border-violet-200',
  'Discharged':    'bg-slate-50 text-slate-500 border-slate-200'
};

const NEXT_STATUS = {
  'Bed Allocated': 'In Treatment',
  'In Treatment':  'Lab / Scan',
  'Lab / Scan':    'In Treatment'
};

const DOCTORS_ON_DUTY = 14;
const ATTENDING_DOCTORS = 6;

/* ---------- State ---------- */
let beds = [];
let patients = [];
let mrnCounter = 48210;
let currentDetailId = null;
let tickerItems = [];
let lastFocused = null;

/* ---------- Helpers ---------- */
const $ = (id) => document.getElementById(id);
const pad2 = (n) => String(n).padStart(2, '0');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function formatTime(date) {
  return pad2(date.getHours()) + ':' + pad2(date.getMinutes());
}

function minutesAgo(min) {
  return new Date(Date.now() - min * 60000);
}

function bedById(id) { return beds.find((b) => b.id === id) || null; }
function patientById(id) { return patients.find((p) => p.id === id) || null; }
function activePatients() { return patients.filter((p) => p.status !== 'Discharged'); }
function availableBeds(dept) {
  return beds.filter((b) => b.state === 'Available' && (!dept || b.dept === dept));
}

function vital(value, suffix) {
  const v = String(value ?? '').trim();
  return v ? v + (suffix || '') : '--';
}

/* ---------- Seed data ---------- */
function buildBeds() {
  beds = [];
  Object.entries(DEPARTMENTS).forEach(([key, dept]) => {
    for (let i = 1; i <= dept.count; i++) {
      beds.push({ id: dept.prefix + '-' + pad2(i), dept: key, state: 'Available', patientId: null });
    }
  });
}

function addPatient(data) {
  const patient = Object.assign({
    id: 'P' + (patients.length + 1) + '-' + Math.random().toString(36).slice(2, 7),
    mrn: 'MRN-' + (mrnCounter++),
    bed: null,
    status: 'Triage',
    time: new Date(),
    vitals: { bp: '', hr: '', spo2: '', temp: '' }
  }, data);
  patients.push(patient);
  if (patient.bed) {
    const bed = bedById(patient.bed);
    if (bed) { bed.state = 'Occupied'; bed.patientId = patient.id; }
  }
  return patient;
}

function seed() {
  buildBeds();
  const rows = [
    { name: 'Robert Hayes',   age: 58, gender: 'Male',   triage: 'RED',    complaint: 'Chest pain with ST elevation, diaphoresis', arrival: 'Ambulance (EMS)', dept: 'Cardiology', bed: 'CD-01', status: 'In Treatment',  mins: 70,  vitals: { bp: '168/98', hr: '112', spo2: '94', temp: '98.2' } },
    { name: 'Maria Lopez',    age: 34, gender: 'Female', triage: 'RED',    complaint: 'Multi-trauma after motor vehicle collision', arrival: 'Ambulance (EMS)', dept: 'Trauma', bed: 'TR-01', status: 'In Treatment',  mins: 95,  vitals: { bp: '88/54', hr: '128', spo2: '91', temp: '97.8' } },
    { name: 'David Chen',     age: 67, gender: 'Male',   triage: 'RED',    complaint: 'Acute stroke — right-sided weakness, slurred speech', arrival: 'Ambulance (EMS)', dept: 'Neurology', bed: 'NE-01', status: 'Lab / Scan', mins: 55, vitals: { bp: '182/104', hr: '88', spo2: '96', temp: '98.4' } },
    { name: 'Aisha Khan',     age: 7,  gender: 'Female', triage: 'YELLOW', complaint: 'Asthma exacerbation, wheezing', arrival: 'Walk-in', dept: 'Pediatric', bed: 'PD-01', status: 'In Treatment', mins: 48, vitals: { bp: '102/64', hr: '118', spo2: '92', temp: '99.1' } },
    { name: 'Thomas Wright',  age: 45, gender: 'Male',   triage: 'YELLOW', complaint: 'Severe right lower abdominal pain', arrival: 'Walk-in', dept: 'General', bed: 'GE-01', status: 'Lab / Scan', mins: 40, vitals: { bp: '134/86', hr: '96', spo2: '98', temp: '100.2' } },
    { name: 'James O\u2019Neil', age: 72, gender: 'Male',  triage: 'YELLOW', complaint: 'Syncope with bradycardia', arrival: 'Hospital Transfer', dept: 'Cardiology', bed: 'CD-02', status: 'Bed Allocated', mins: 25, vitals: { bp: '110/70', hr: '52', spo2: '95', temp: '97.9' } },
    { name: 'Elena Petrova',  age: 29, gender: 'Female', triage: 'GREEN',  complaint: 'Ankle sprain after fall', arrival: 'Walk-in', dept: 'General', bed: 'GE-02', status: 'Bed Allocated', mins: 33, vitals: { bp: '118/76', hr: '74', spo2: '99', temp: '98.6' } },
    { name: 'Grace Miller',   age: 39, gender: 'Female', triage: 'GREEN',  complaint: 'Migraine with nausea', arrival: 'Walk-in', dept: 'General', bed: 'GE-03', status: 'In Treatment', mins: 62, vitals: { bp: '124/80', hr: '80', spo2: '99', temp: '98.4' } },
    { name: 'Lucas Meyer',    age: 4,  gender: 'Male',   triage: 'GREEN',  complaint: 'Fever and ear pain', arrival: 'Walk-in', dept: 'Pediatric', bed: null, status: 'Triage', mins: 8, vitals: { bp: '', hr: '', spo2: '', temp: '101.4' } },
    { name: 'Samuel Okoye',   age: 51, gender: 'Male',   triage: 'YELLOW', complaint: 'Deep laceration, left forearm', arrival: 'Walk-in', dept: 'General', bed: null, status: 'Triage', mins: 12, vitals: { bp: '', hr: '', spo2: '', temp: '' } },
    { name: 'Harold Brooks',  age: 80, gender: 'Male',   triage: 'GREEN',  complaint: 'Dizziness, resolved on arrival', arrival: 'Walk-in', dept: 'General', bed: null, status: 'Discharged', mins: 240, vitals: { bp: '138/82', hr: '70', spo2: '97', temp: '98.2' } }
  ];
  rows.forEach((r) => {
    const mins = r.mins; delete r.mins;
    addPatient(Object.assign(r, { time: minutesAgo(mins) }));
  });

  // Non-patient bed states
  bedById('TR-02').state = 'Reserved';
  bedById('TR-04').state = 'Sanitizing';
  bedById('CD-04').state = 'Sanitizing';
  bedById('GE-05').state = 'Reserved';
}

/* ---------- Toasts ---------- */
function showToast(message, type) {
  const kind = type || 'success';
  const styles = {
    success: { icon: 'fa-circle-check',  color: 'text-aura-green', border: 'border-green-200' },
    error:   { icon: 'fa-circle-xmark',  color: 'text-aura-red',   border: 'border-red-200' },
    info:    { icon: 'fa-circle-info',   color: 'text-aura-primary', border: 'border-blue-200' }
  }[kind];
  const toast = document.createElement('div');
  toast.className = 'toast pointer-events-auto flex items-start gap-2.5 rounded-xl border bg-white shadow-pop px-3.5 py-3 text-[13px] text-aura-navy ' + styles.border;
  toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  toast.innerHTML =
    '<i class="fa-solid ' + styles.icon + ' ' + styles.color + ' mt-0.5" aria-hidden="true"></i>' +
    '<p class="flex-1 min-w-0">' + escapeHtml(message) + '</p>' +
    '<button type="button" class="text-slate-400 hover:text-slate-700 -mr-1 px-1" aria-label="Dismiss notification"><i class="fa-solid fa-xmark text-xs"></i></button>';
  const container = $('toastContainer');
  container.appendChild(toast);
  const remove = () => {
    toast.classList.add('leaving');
    setTimeout(() => toast.remove(), 220);
  };
  toast.querySelector('button').addEventListener('click', remove);
  setTimeout(remove, 4500);
}

/* ---------- Clock ---------- */
function updateClock() {
  const now = new Date();
  $('currentTime').textContent = pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds());
  $('currentDate').textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

/* ---------- Sidebar & navigation ---------- */
function toggleSidebar(open) {
  const sidebar = $('sidebar');
  const overlay = $('sidebarOverlay');
  sidebar.classList.toggle('-translate-x-full', !open);
  overlay.classList.toggle('hidden', !open);
  $('mobileMenuBtn').setAttribute('aria-expanded', String(!!open));
  if (open) {
    const first = sidebar.querySelector('.nav-item');
    if (first) first.focus();
  }
}

function setActiveNav(name) {
  document.querySelectorAll('.nav-item').forEach((el) => {
    const active = el.dataset.nav === name;
    el.classList.toggle('active', active);
    if (active) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
}

function scrollToEl(id) {
  const el = $(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function navigate(section) {
  if (window.innerWidth < 1024) toggleSidebar(false);
  const crumb = $('breadcrumbCurrent');
  switch (section) {
    case 'dashboard':
      switchView('patients');
      resetFilters(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      crumb.textContent = 'Dashboard';
      break;
    case 'patients':
      switchView('patients');
      scrollToEl('patientViewSection');
      crumb.textContent = 'Patient Management';
      break;
    case 'triage':
      switchView('patients');
      resetFilters(true);
      $('triageFilter').value = 'RED';
      applyFilters();
      scrollToEl('patientViewSection');
      crumb.textContent = 'Emergency Triage';
      break;
    case 'beds':
      switchView('beds');
      scrollToEl('bedViewSection');
      crumb.textContent = 'Bed Management';
      break;
    case 'departments':
      scrollToEl('departmentOverview');
      crumb.textContent = 'Departments';
      break;
  }
  setActiveNav(section);
}

function switchView(view) {
  const showPatients = view === 'patients';
  $('patientViewSection').classList.toggle('hidden', !showPatients);
  $('bedViewSection').classList.toggle('hidden', showPatients);

  const on = 'px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-colors bg-white text-aura-navy shadow-card';
  const off = 'px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-colors text-aura-muted hover:text-aura-navy';
  $('tabPatientsBtn').className = showPatients ? on : off;
  $('tabBedsBtn').className = showPatients ? off : on;
  $('tabPatientsBtn').setAttribute('aria-selected', String(showPatients));
  $('tabBedsBtn').setAttribute('aria-selected', String(!showPatients));

  $('breadcrumbCurrent').textContent = showPatients ? 'Patient Board' : 'Bed Matrix';
  setActiveNav(showPatients ? 'patients' : 'beds');
}

/* ---------- Notifications ---------- */
function toggleNotifications(force) {
  const panel = $('notifPanel');
  const open = typeof force === 'boolean' ? force : panel.classList.contains('hidden');
  panel.classList.toggle('hidden', !open);
  $('notifBtn').setAttribute('aria-expanded', String(open));
}

function renderNotifications() {
  const critical = activePatients().filter((p) => p.triage === 'RED');
  const count = $('notifCount');
  count.textContent = critical.length;
  count.classList.toggle('hidden', critical.length === 0);
  $('navCriticalCount').textContent = critical.length;

  const list = $('notifList');
  if (!critical.length) {
    list.innerHTML = '<li class="px-4 py-6 text-center text-[13px] text-aura-muted">No critical patients right now.</li>';
    return;
  }
  list.innerHTML = critical.map((p) =>
    '<li><button type="button" class="w-full text-left px-4 py-3 hover:bg-slate-50 focus-visible:bg-slate-50 focus:outline-none" onclick="openDetailModal(\'' + p.id + '\')">' +
      '<p class="text-sm font-semibold text-aura-navy">' + escapeHtml(p.name) + '</p>' +
      '<p class="text-xs text-aura-muted mt-0.5">' + escapeHtml(p.complaint) + '</p>' +
      '<p class="text-xs mt-1 font-mono text-aura-red">' + escapeHtml(p.bed || 'No bed assigned') + '</p>' +
    '</button></li>'
  ).join('');
}

/* ---------- Priority feed ---------- */
function renderTicker() {
  $('alertTicker').textContent = tickerItems.join(' \u2022 ');
}

function pushTicker(text) {
  tickerItems.unshift('[' + formatTime(new Date()) + '] ' + text.toUpperCase());
  tickerItems = tickerItems.slice(0, 8);
  renderTicker();
}

function toggleTicker() {
  const wrap = $('tickerWrap');
  const btn = $('tickerToggle');
  const paused = wrap.classList.toggle('paused');
  btn.setAttribute('aria-pressed', String(paused));
  btn.setAttribute('aria-label', paused ? 'Resume alert feed' : 'Pause alert feed');
  btn.innerHTML = '<i class="fa-solid ' + (paused ? 'fa-play' : 'fa-pause') + ' text-xs"></i>';
}

/* ---------- Metrics & summaries ---------- */
function renderMetrics() {
  const active = activePatients();
  const totalBeds = beds.length;
  const occupied = beds.filter((b) => b.state === 'Occupied').length;
  const available = availableBeds().length;
  const occupancy = totalBeds ? Math.round((occupied / totalBeds) * 100) : 0;
  const awaiting = active.filter((p) => p.status === 'Triage').length;

  $('metricTotalPatients').textContent = active.length;
  $('metricRedCount').textContent = active.filter((p) => p.triage === 'RED').length;
  $('metricOccupancyRate').textContent = occupancy + '%';
  $('metricBedStats').textContent = occupied + ' of ' + totalBeds + ' occupied';
  $('metricAvailableBeds').textContent = available;
  $('metricResusAvailable').textContent = availableBeds('Trauma').length + ' Avail';
  $('metricDoctors').textContent = DOCTORS_ON_DUTY;
  $('metricAttending').textContent = ATTENDING_DOCTORS + ' attending \u00B7 demo roster';
  $('metricAwaitingTriage').textContent = awaiting + ' awaiting triage';

  // Sidebar capacity
  $('sidebarOccupancy').textContent = occupancy + '%';
  $('sidebarOccupancyBar').setAttribute('aria-valuenow', String(occupancy));
  const fill = $('sidebarOccupancyFill');
  fill.style.width = occupancy + '%';
  fill.className = 'h-full rounded-full transition-all ' +
    (occupancy >= 90 ? 'bg-aura-red' : occupancy >= 75 ? 'bg-aura-amber' : 'bg-aura-primary');
  $('sidebarBedSummary').textContent = available + (available === 1 ? ' bed available' : ' beds available');
}

function renderDepartments() {
  $('departmentSummary').innerHTML = Object.entries(DEPARTMENTS).map(([key, dept]) => {
    const deptBeds = beds.filter((b) => b.dept === key);
    const free = deptBeds.filter((b) => b.state === 'Available').length;
    const total = deptBeds.length;
    const usedPct = total ? Math.round(((total - free) / total) * 100) : 0;
    const tone = free === 0 ? 'bg-aura-red' : free <= 1 ? 'bg-aura-amber' : 'bg-aura-teal';
    const tag = free === 0 ? 'At capacity' : free <= 1 ? 'Nearly full' : 'Beds open';
    const tagColor = free === 0 ? 'text-aura-red' : free <= 1 ? 'text-amber-600' : 'text-aura-teal';
    return '<div class="card p-4">' +
      '<div class="flex items-center gap-2.5">' +
        '<span class="w-8 h-8 rounded-lg bg-aura-subtle text-aura-primary flex items-center justify-center shrink-0" aria-hidden="true"><i class="fa-solid ' + dept.icon + ' text-sm"></i></span>' +
        '<p class="text-[13px] font-semibold text-aura-navy leading-tight">' + escapeHtml(dept.label) + '</p>' +
      '</div>' +
      '<div class="mt-3 flex items-baseline justify-between">' +
        '<p class="tabular-nums"><span class="text-2xl font-semibold text-aura-navy">' + free + '</span><span class="text-sm text-aura-muted"> / ' + total + '</span></p>' +
        '<span class="text-xs font-medium ' + tagColor + '">' + tag + '</span>' +
      '</div>' +
      '<div class="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden" role="progressbar" aria-label="' + escapeHtml(dept.label) + ' occupancy" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + usedPct + '">' +
        '<div class="h-full rounded-full ' + tone + '" style="width:' + usedPct + '%"></div>' +
      '</div>' +
    '</div>';
  }).join('');
}

/* ---------- Patient table ---------- */
function applyFilters() {
  const q = $('searchInput').value.trim().toLowerCase();
  const triage = $('triageFilter').value;
  const dept = $('departmentFilter').value;
  const status = $('statusFilter').value;

  const rows = patients.filter((p) => {
    if (triage !== 'ALL' && p.triage !== triage) return false;
    if (dept !== 'ALL' && p.dept !== dept) return false;
    if (status !== 'ALL' && p.status !== status) return false;
    if (q) {
      const hay = (p.name + ' ' + p.mrn + ' ' + p.complaint + ' ' + (p.bed || '')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => b.time - a.time);

  $('filteredCountBadge').textContent = rows.length + ' Shown';
  $('emptyPatientState').classList.toggle('hidden', rows.length > 0);

  $('patientsTableBody').innerHTML = rows.map((p) => {
    const t = TRIAGE[p.triage];
    const discharged = p.status === 'Discharged';
    const lowO2 = p.vitals.spo2 && Number(p.vitals.spo2) < 92;
    const next = NEXT_STATUS[p.status];
    const advanceDisabled = discharged || !next;
    const advanceTitle = discharged ? 'Patient discharged'
      : p.status === 'Triage' ? 'Assign a bed to move this patient out of triage'
      : 'Move to ' + next;

    return '<tr class="' + (discharged ? 'is-discharged' : '') + '">' +
      '<td class="px-4 py-3 align-top"><span class="badge ' + t.badge + '"><i class="fa-solid ' + t.icon + ' text-[10px]" aria-hidden="true"></i>' + t.label + ' \u00B7 ' + t.esi + '</span></td>' +
      '<td class="px-4 py-3 align-top">' +
        '<p class="font-semibold text-aura-navy">' + escapeHtml(p.name) + '</p>' +
        '<p class="text-xs text-aura-muted mt-0.5">' + p.age + ' yrs \u00B7 ' + escapeHtml(p.gender) + '</p>' +
        '<p class="font-mono text-[11px] text-slate-400 mt-0.5">' + escapeHtml(p.mrn) + '</p>' +
      '</td>' +
      '<td class="px-4 py-3 align-top max-w-[320px]">' +
        '<p class="text-aura-navy">' + escapeHtml(p.complaint) + '</p>' +
        '<p class="font-mono text-[11.5px] text-aura-muted mt-1 flex flex-wrap gap-x-3">' +
          '<span>BP ' + escapeHtml(vital(p.vitals.bp)) + '</span>' +
          '<span>HR ' + escapeHtml(vital(p.vitals.hr)) + '</span>' +
          '<span class="' + (lowO2 ? 'text-aura-red font-semibold' : '') + '">SpO\u2082 ' + escapeHtml(vital(p.vitals.spo2, '%')) + '</span>' +
          '<span>' + escapeHtml(vital(p.vitals.temp, '\u00B0F')) + '</span>' +
        '</p>' +
      '</td>' +
      '<td class="px-4 py-3 align-top">' +
        '<p class="text-aura-navy">' + escapeHtml(DEPARTMENTS[p.dept] ? DEPARTMENTS[p.dept].label : p.dept) + '</p>' +
        '<p class="font-mono text-xs mt-0.5 ' + (p.bed ? 'text-aura-primary font-semibold' : 'text-slate-400') + '">' + escapeHtml(p.bed || 'Unassigned') + '</p>' +
      '</td>' +
      '<td class="px-4 py-3 align-top whitespace-nowrap">' +
        '<p class="font-mono text-aura-navy">' + formatTime(p.time) + '</p>' +
        '<p class="text-xs text-aura-muted mt-0.5">' + escapeHtml(p.arrival) + '</p>' +
      '</td>' +
      '<td class="px-4 py-3 align-top"><span class="badge ' + (STATUS_BADGE[p.status] || STATUS_BADGE['Triage']) + '">' + escapeHtml(p.status) + '</span></td>' +
      '<td class="px-4 py-3 align-top">' +
        '<div class="flex items-center justify-end gap-1.5">' +
          '<button type="button" class="row-action" onclick="openDetailModal(\'' + p.id + '\')" title="View details" aria-label="View details for ' + escapeHtml(p.name) + '"><i class="fa-solid fa-eye text-xs" aria-hidden="true"></i></button>' +
          '<button type="button" class="row-action" onclick="advanceStatus(\'' + p.id + '\')" ' + (advanceDisabled ? 'disabled ' : '') + 'title="' + escapeHtml(advanceTitle) + '" aria-label="' + escapeHtml(advanceTitle) + ' for ' + escapeHtml(p.name) + '"><i class="fa-solid fa-forward-step text-xs" aria-hidden="true"></i></button>' +
          '<button type="button" class="row-action danger" onclick="confirmDischarge(\'' + p.id + '\')" ' + (discharged ? 'disabled ' : '') + 'title="Discharge patient" aria-label="Discharge ' + escapeHtml(p.name) + '"><i class="fa-solid fa-arrow-right-from-bracket text-xs" aria-hidden="true"></i></button>' +
        '</div>' +
      '</td>' +
    '</tr>';
  }).join('');
}

function resetFilters(silent) {
  $('searchInput').value = '';
  $('triageFilter').value = 'ALL';
  $('departmentFilter').value = 'ALL';
  $('statusFilter').value = 'ALL';
  applyFilters();
  if (silent !== true) showToast('Filters cleared.', 'info');
}

/* ---------- Bed matrix ---------- */
function renderBeds() {
  const hints = {
    Available:  'Click to reserve',
    Reserved:   'Click to release',
    Sanitizing: 'Click when cleaned'
  };
  $('bedMatrixContainer').innerHTML = Object.entries(DEPARTMENTS).map(([key, dept]) => {
    const deptBeds = beds.filter((b) => b.dept === key);
    const free = deptBeds.filter((b) => b.state === 'Available').length;
    const tiles = deptBeds.map((b) => {
      const patient = b.patientId ? patientById(b.patientId) : null;
      const detail = b.state === 'Occupied' && patient ? patient.name : hints[b.state];
      const aria = b.id + ', ' + b.state + (patient ? ', ' + patient.name : '') + '. ' + (b.state === 'Occupied' ? 'Open patient details.' : hints[b.state] + '.');
      return '<button type="button" class="bed-tile" data-state="' + b.state + '" onclick="bedAction(\'' + b.id + '\')" aria-label="' + escapeHtml(aria) + '">' +
        '<span class="flex items-center justify-between gap-2">' +
          '<span class="font-mono text-[13px] font-semibold text-aura-navy">' + b.id + '</span>' +
          '<span class="bed-dot" aria-hidden="true"></span>' +
        '</span>' +
        '<span class="block text-xs font-medium text-slate-700 mt-1">' + b.state + '</span>' +
        '<span class="block text-[11px] text-aura-muted mt-0.5 truncate">' + escapeHtml(detail) + '</span>' +
      '</button>';
    }).join('');
    return '<section class="card p-4 lg:p-5" aria-label="' + escapeHtml(dept.label) + ' beds">' +
      '<div class="flex items-center justify-between mb-3">' +
        '<h3 class="text-sm font-semibold text-aura-navy flex items-center gap-2"><i class="fa-solid ' + dept.icon + ' text-aura-primary" aria-hidden="true"></i>' + escapeHtml(dept.label) + '</h3>' +
        '<span class="text-xs text-aura-muted tabular-nums">' + free + ' of ' + deptBeds.length + ' available</span>' +
      '</div>' +
      '<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-2.5">' + tiles + '</div>' +
    '</section>';
  }).join('');
}

function bedAction(bedId) {
  const bed = bedById(bedId);
  if (!bed) return;
  switch (bed.state) {
    case 'Available':
      bed.state = 'Reserved';
      showToast('Bed ' + bed.id + ' reserved.');
      break;
    case 'Reserved':
      bed.state = 'Available';
      showToast('Reservation on ' + bed.id + ' released.', 'info');
      break;
    case 'Sanitizing':
      bed.state = 'Available';
      showToast('Bed ' + bed.id + ' cleaned and available.');
      break;
    case 'Occupied':
      if (bed.patientId) openDetailModal(bed.patientId);
      return;
  }
  renderAll();
}

/* ---------- Patient actions ---------- */
function assignBed(patient, bed) {
  if (patient.bed) {
    const old = bedById(patient.bed);
    if (old) { old.state = 'Sanitizing'; old.patientId = null; }
  }
  bed.state = 'Occupied';
  bed.patientId = patient.id;
  patient.bed = bed.id;
  patient.dept = bed.dept;
  if (patient.status === 'Triage') patient.status = 'Bed Allocated';
}

function advanceStatus(id) {
  const p = patientById(id);
  if (!p || p.status === 'Discharged') return;
  const next = NEXT_STATUS[p.status];
  if (!next) {
    showToast('Assign a bed to ' + p.name + ' before changing status.', 'error');
    return;
  }
  p.status = next;
  showToast(p.name + ' moved to ' + next + '.');
  renderAll();
}

function dischargePatient(id) {
  const p = patientById(id);
  if (!p || p.status === 'Discharged') return;
  if (p.bed) {
    const bed = bedById(p.bed);
    if (bed) { bed.state = 'Sanitizing'; bed.patientId = null; }
  }
  const bedId = p.bed;
  p.bed = null;
  p.status = 'Discharged';
  showToast(p.name + ' discharged.' + (bedId ? ' Bed ' + bedId + ' sent for sanitization.' : ''));
  renderAll();
}

function confirmDischarge(id) {
  const p = patientById(id);
  if (!p) return;
  if (window.confirm('Discharge ' + p.name + '? Their bed will move to the sanitization queue.')) {
    dischargePatient(id);
  }
}

/* ---------- Modal plumbing ---------- */
function openModal(el) {
  lastFocused = document.activeElement;
  el.classList.remove('hidden');
  el.classList.add('flex');
  document.body.classList.add('overflow-hidden');
}

function closeModal(el) {
  el.classList.add('hidden');
  el.classList.remove('flex');
  const anyOpen = document.querySelector('.modal.flex');
  if (!anyOpen) document.body.classList.remove('overflow-hidden');
  if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
}

function trapFocus(e, modal) {
  const focusable = modal.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])');
  const visible = Array.from(focusable).filter((el) => el.offsetParent !== null);
  if (!visible.length) return;
  const first = visible[0];
  const last = visible[visible.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/* ---------- Intake modal ---------- */
function populateBedOptions() {
  const dept = $('intakeDept').value;
  const free = availableBeds(dept);
  const select = $('intakeBedSelect');
  select.innerHTML = '<option value="">No bed yet \u2014 keep in triage queue</option>' +
    free.map((b) => '<option value="' + b.id + '">' + b.id + '</option>').join('');
  if (free.length) select.value = free[0].id;
  $('intakeBedHint').textContent = free.length
    ? free.length + (free.length === 1 ? ' bed' : ' beds') + ' available in this department.'
    : 'No beds available in this department. The patient will wait in the triage queue.';
}

function clearIntakeErrors() {
  ['intakeName', 'intakeAge', 'intakeComplaint', 'intakeBP', 'intakeHR', 'intakeSPO2', 'intakeTemp']
    .forEach((id) => setFieldError(id, ''));
}

function setFieldError(id, message) {
  const input = $(id);
  const err = $('err-' + id);
  if (err) {
    err.textContent = message;
    err.classList.toggle('hidden', !message);
  }
  if (input) input.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function openIntakeModal() {
  $('intakeForm').reset();
  clearIntakeErrors();
  populateBedOptions();
  openModal($('intakeModal'));
  setTimeout(() => $('intakeName').focus(), 30);
}

function closeIntakeModal() {
  closeModal($('intakeModal'));
}

function handlePatientIntake(event) {
  event.preventDefault();
  clearIntakeErrors();
  let firstInvalid = null;
  const fail = (id, msg) => { setFieldError(id, msg); if (!firstInvalid) firstInvalid = id; };

  const name = $('intakeName').value.trim();
  const ageRaw = $('intakeAge').value.trim();
  const complaint = $('intakeComplaint').value.trim();
  const bp = $('intakeBP').value.trim();
  const hrRaw = $('intakeHR').value.trim();
  const spo2Raw = $('intakeSPO2').value.trim();
  const tempRaw = $('intakeTemp').value.trim();

  if (!name) fail('intakeName', 'Enter the patient\u2019s full name.');
  else if (name.length < 2) fail('intakeName', 'Name must be at least 2 characters.');

  const age = Number(ageRaw);
  if (ageRaw === '') fail('intakeAge', 'Enter the age.');
  else if (!Number.isInteger(age) || age < 0 || age > 120) fail('intakeAge', 'Age must be a whole number from 0 to 120.');

  if (!complaint) fail('intakeComplaint', 'Describe the chief complaint or symptoms.');

  if (bp) {
    const m = bp.match(/^(\d{2,3})\s*\/\s*(\d{2,3})$/);
    if (!m) fail('intakeBP', 'Use the format 120/80.');
    else if (+m[1] < 50 || +m[1] > 260 || +m[2] < 30 || +m[2] > 160 || +m[1] <= +m[2]) fail('intakeBP', 'Check the values: systolic must be higher than diastolic.');
  }
  if (hrRaw) {
    const hr = Number(hrRaw);
    if (!Number.isFinite(hr) || hr < 20 || hr > 300) fail('intakeHR', 'Enter 20\u2013300 bpm.');
  }
  if (spo2Raw) {
    const s = Number(spo2Raw);
    if (!Number.isFinite(s) || s < 50 || s > 100) fail('intakeSPO2', 'Enter 50\u2013100%.');
  }
  let tempClean = '';
  if (tempRaw) {
    const t = Number(tempRaw);
    if (!Number.isFinite(t) || t < 85 || t > 110) fail('intakeTemp', 'Enter 85\u2013110 \u00B0F.');
    else tempClean = t.toFixed(1);
  }

  if (firstInvalid) {
    $(firstInvalid).focus();
    return;
  }

  const triage = document.querySelector('input[name="triageLevel"]:checked').value;
  const dept = $('intakeDept').value;
  const bedId = $('intakeBedSelect').value;
  const bed = bedId ? bedById(bedId) : null;

  if (bedId && (!bed || bed.state !== 'Available')) {
    showToast('That bed was just taken. Pick another bed.', 'error');
    populateBedOptions();
    return;
  }

  const patient = addPatient({
    name: name,
    age: age,
    gender: $('intakeGender').value,
    triage: triage,
    complaint: complaint,
    arrival: $('intakeArrivalMode').value,
    dept: dept,
    time: new Date(),
    vitals: {
      bp: bp.replace(/\s+/g, ''),
      hr: hrRaw ? String(Math.round(Number(hrRaw))) : '',
      spo2: spo2Raw ? String(Math.round(Number(spo2Raw))) : '',
      temp: tempClean
    }
  });
  if (bed) assignBed(patient, bed);

  if (triage === 'RED') {
    pushTicker('Critical intake: ' + patient.name + ' \u2014 ' + complaint + (patient.bed ? ' \u2192 bed ' + patient.bed : ' \u2192 awaiting bed'));
  }

  closeIntakeModal();
  switchView('patients');
  resetFilters(true);
  renderAll();
  showToast(patient.name + ' admitted' + (patient.bed ? ' to ' + patient.bed : ' and waiting in triage') + '.');
}

/* ---------- Patient detail modal ---------- */
function openDetailModal(id) {
  const p = patientById(id);
  if (!p) return;
  toggleNotifications(false);
  currentDetailId = id;
  fillDetailModal();
  const modal = $('patientDetailModal');
  if (modal.classList.contains('hidden')) openModal(modal);
}

function fillDetailModal() {
  const p = patientById(currentDetailId);
  if (!p) return;
  const t = TRIAGE[p.triage];
  const discharged = p.status === 'Discharged';

  $('detailTriageBadge').className = 'badge ' + t.badge;
  $('detailTriageBadge').textContent = t.label + ' \u00B7 ' + t.esi;
  $('detailStatus').className = 'badge ' + (STATUS_BADGE[p.status] || STATUS_BADGE['Triage']);
  $('detailStatus').textContent = p.status;
  $('detailPatientName').textContent = p.name + ' (' + p.age + ', ' + p.gender + ')';
  $('detailMRN').textContent = p.mrn;

  $('detailBP').textContent = vital(p.vitals.bp);
  $('detailHR').textContent = vital(p.vitals.hr);
  $('detailSPO2').textContent = vital(p.vitals.spo2, '%');
  $('detailTemp').textContent = vital(p.vitals.temp, '\u00B0F');

  $('detailComplaint').textContent = p.complaint;
  $('detailDepartment').textContent = DEPARTMENTS[p.dept] ? DEPARTMENTS[p.dept].label : p.dept;
  $('detailBed').textContent = p.bed || 'Unassigned';
  $('detailArrival').textContent = p.arrival;
  $('detailTime').textContent = formatTime(p.time);

  const free = availableBeds().sort((a, b) => (a.dept === p.dept ? -1 : 0) - (b.dept === p.dept ? -1 : 0) || a.id.localeCompare(b.id));
  const select = $('transferBedSelect');
  select.innerHTML = '<option value="">' + (free.length ? 'Select destination bed\u2026' : 'No beds available') + '</option>' +
    free.map((b) => '<option value="' + b.id + '">' + b.id + ' \u2014 ' + escapeHtml(DEPARTMENTS[b.dept].label) + '</option>').join('');
  select.disabled = discharged || !free.length;
  $('transferBtn').disabled = discharged || !free.length;
  $('detailDischargeBtn').disabled = discharged;
}

function closeDetailModal() {
  currentDetailId = null;
  closeModal($('patientDetailModal'));
}

function executeBedTransfer() {
  const p = patientById(currentDetailId);
  if (!p || p.status === 'Discharged') return;
  const bedId = $('transferBedSelect').value;
  if (!bedId) {
    showToast('Select a destination bed first.', 'error');
    $('transferBedSelect').focus();
    return;
  }
  const bed = bedById(bedId);
  if (!bed || bed.state !== 'Available') {
    showToast('That bed is no longer available.', 'error');
    renderAll();
    return;
  }
  const from = p.bed;
  assignBed(p, bed);
  showToast(p.name + (from ? ' moved from ' + from + ' to ' : ' assigned to ') + bed.id + '.' + (from ? ' ' + from + ' is being sanitized.' : ''));
  renderAll();
}

function dischargeFromDetail() {
  const p = patientById(currentDetailId);
  if (!p) return;
  if (window.confirm('Discharge ' + p.name + '? Their bed will move to the sanitization queue.')) {
    dischargePatient(p.id);
  }
}

/* ---------- Render everything ---------- */
function renderAll() {
  renderMetrics();
  renderDepartments();
  applyFilters();
  renderBeds();
  renderNotifications();
  if (currentDetailId) fillDetailModal();
}

/* ---------- Global listeners ---------- */
document.addEventListener('keydown', (e) => {
  const intake = $('intakeModal');
  const detail = $('patientDetailModal');
  const openModalEl = !intake.classList.contains('hidden') ? intake
    : !detail.classList.contains('hidden') ? detail : null;

  if (e.key === 'Escape') {
    if (openModalEl === intake) closeIntakeModal();
    else if (openModalEl === detail) closeDetailModal();
    else if (!$('notifPanel').classList.contains('hidden')) { toggleNotifications(false); $('notifBtn').focus(); }
    else if (!$('sidebarOverlay').classList.contains('hidden')) toggleSidebar(false);
  } else if (e.key === 'Tab' && openModalEl) {
    trapFocus(e, openModalEl);
  }
});

document.addEventListener('click', (e) => {
  const panel = $('notifPanel');
  if (!panel.classList.contains('hidden') && !panel.contains(e.target) && !$('notifBtn').contains(e.target)) {
    toggleNotifications(false);
  }
});

window.addEventListener('resize', () => {
  if (window.innerWidth >= 1024) {
    $('sidebarOverlay').classList.add('hidden');
    $('mobileMenuBtn').setAttribute('aria-expanded', 'false');
  }
});

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  seed();
  tickerItems = $('alertTicker').textContent.split(' \u2022 ').map((s) => s.trim()).filter(Boolean);
  renderTicker();
  updateClock();
  setInterval(updateClock, 1000);
  setActiveNav('dashboard');
  renderAll();
});

