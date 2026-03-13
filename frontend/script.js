/**
 * script.js – Opportunity Tracker Frontend
 * =========================================
 * Handles:
 *  • SPA routing between dashboard pages
 *  • Fetching opportunities from backend API
 *  • Rendering opportunity cards
 *  • Search, filter logic
 *  • Calendar with deadline markers
 *  • Add-opportunity form (manual + Telegram simulation)
 *  • Modal detail view
 *  • Toast notifications
 *
 * API Base: http://localhost:5000
 * Falls back to built-in SAMPLE_DATA when backend is not running.
 */

/* ── CONFIG ─────────────────────────────────────────────── */
const API_BASE = 'http://localhost:5000';

/* ── SAMPLE DATA (fallback when backend is offline) ──── */
const SAMPLE_DATA = [
  {
    _id: 'sample_1',
    company: 'Google',
    role: 'Software Engineer Intern',
    eligibility: 'B.Tech / B.E (CS/IT), 7.5+ CGPA',
    deadline: '2026-03-25',
    description: 'Join Google as a SWE intern. Work on large‑scale distributed systems, search infrastructure, or cloud products. Collaborative team, mentorship and full relocation support provided.',
    applyLink: 'https://careers.google.com/',
    source: 'Website',
    postedDate: '2026-03-01'
  },
  {
    _id: 'sample_2',
    company: 'Microsoft',
    role: 'Product Design Intern',
    eligibility: 'Any stream, 3rd or 4th year',
    deadline: '2026-03-18',
    description: 'Microsoft Design Internship – contribute to real product design challenges on Teams, Azure, or Xbox. Portfolio required.',
    applyLink: 'https://careers.microsoft.com/',
    source: 'Telegram',
    postedDate: '2026-03-05'
  },
  {
    _id: 'sample_3',
    company: 'Amazon',
    role: 'Data Science Intern',
    eligibility: 'M.Tech / B.Tech (DS, CS, Stats), 7+ CGPA',
    deadline: '2026-04-05',
    description: 'Work with Alexa AI, AWS ML, or Supply Chain Analytics teams. Strong Python and SQL skills needed. Paid internship – 3 months.',
    applyLink: 'https://www.amazon.jobs/',
    source: 'Telegram',
    postedDate: '2026-03-03'
  },
  {
    _id: 'sample_4',
    company: 'Flipkart',
    role: 'Backend Engineer Intern',
    eligibility: 'B.Tech (CS/ECE), 8+ CGPA',
    deadline: '2026-03-30',
    description: 'Build and scale backend microservices handling millions of orders per day. Experience with Java/Go preferred.',
    applyLink: 'https://www.flipkartcareers.com/',
    source: 'Website',
    postedDate: '2026-03-07'
  },
  {
    _id: 'sample_5',
    company: 'Swiggy',
    role: 'UI/UX Design Intern',
    eligibility: 'Any stream, portfolio required',
    deadline: '2026-04-10',
    description: "Join Swiggy's consumer experience team. Design screens for our ordering app, research user journeys and run A/B tests.",
    applyLink: 'https://careers.swiggy.com/',
    source: 'Manual',
    postedDate: '2026-03-10'
  },
  {
    _id: 'sample_6',
    company: 'ISRO',
    role: 'Research Intern',
    eligibility: 'B.Tech (ECE/Mechanical/CS), 8.5+ CGPA',
    deadline: '2026-03-20',
    description: 'National-level research internship at ISRO. Opportunity to work with satellite communication, launch vehicles, or AI-based remote sensing.',
    applyLink: 'https://www.isro.gov.in/internship',
    source: 'Website',
    postedDate: '2026-02-28'
  },
  {
    _id: 'sample_7',
    company: 'Zomato',
    role: 'ML Engineer Intern',
    eligibility: 'B.Tech / M.Tech (CS/AI/DS), 7+ CGPA',
    deadline: '2026-04-15',
    description: 'Build recommendation engines, ETA prediction models and fraud detection systems at scale. PyTorch/TF experience preferred.',
    applyLink: 'https://www.zomato.com/careers',
    source: 'Telegram',
    postedDate: '2026-03-08'
  },
  {
    _id: 'sample_8',
    company: 'Infosys',
    role: 'DevOps Intern',
    eligibility: 'B.Tech (any stream), 60%+',
    deadline: '2026-03-22',
    description: 'InfyTQ-certified candidates preferred. Work with Kubernetes, Docker, CI/CD pipelines and cloud infra.',
    applyLink: 'https://www.infosys.com/careers/',
    source: 'Website',
    postedDate: '2026-03-02'
  }
];

/* ── STATE ─────────────────────────────────────────────── */
let allOpportunities = [];   // master list fetched / seeded
let calendarDate = new Date(); // currently viewed month in calendar
let selectedCalDate = null;   // selected day in calendar
let extractedTgData = null;   // parsed data from Telegram simulation

/* ── UTILS ─────────────────────────────────────────────── */

/**
 * Calculates days until a given deadline string.
 * Returns an integer (negative = past).
 */
function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  return Math.ceil((d - today) / 86400000);
}

/**
 * Returns urgency class based on days remaining.
 */
function urgencyClass(days) {
  if (days < 0)  return 'normal'; // already passed
  if (days <= 7) return 'urgent';
  if (days <= 14) return 'soon';
  return 'normal';
}

/**
 * Returns a human-readable deadline label.
 */
function deadlineLabel(dateStr) {
  const days = daysUntil(dateStr);
  if (days < 0)   return `Expired ${Math.abs(days)}d ago`;
  if (days === 0) return 'Due Today!';
  if (days === 1) return 'Due Tomorrow!';
  if (days <= 7)  return `${days} days left`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Generates 1-2 letter abbreviation for logo.
 */
function logoLetters(company) {
  return company.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

/**
 * Returns CSS class for source tag.
 */
function sourceClass(source) {
  return (source || '').toLowerCase();
}

/**
 * Shows a toast notification.
 */
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  setTimeout(() => { toast.className = 'toast'; }, 3500);
}

/* ── API HELPERS ──────────────────────────────────────── */

/**
 * Fetch all opportunities from the backend.
 * Falls back to SAMPLE_DATA if the backend is unreachable.
 */
async function fetchOpportunities() {
  try {
    const res = await fetch(`${API_BASE}/opportunities`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    return data.length ? data : SAMPLE_DATA;
  } catch {
    console.warn('Backend not reachable – using sample data.');
    return SAMPLE_DATA;
  }
}

/**
 * POST a new opportunity to the backend.
 * Falls back to local push if backend is down.
 */
async function postOpportunity(opp) {
  try {
    const res = await fetch(`${API_BASE}/opportunity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(opp),
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) throw new Error('API error');
    return await res.json();
  } catch {
    // Offline fallback: push locally
    const newOpp = { _id: `local_${Date.now()}`, postedDate: new Date().toISOString().split('T')[0], ...opp };
    allOpportunities.unshift(newOpp);
    return newOpp;
  }
}

/* ── RENDER HELPERS ───────────────────────────────────── */

/**
 * Builds an opportunity card element.
 */
function buildCard(opp) {
  const days   = daysUntil(opp.deadline);
  const urg    = urgencyClass(days);
  const label  = deadlineLabel(opp.deadline);
  const srcCls = sourceClass(opp.source);

  const card = document.createElement('div');
  card.className = 'opp-card';
  card.dataset.id = opp._id;

  card.innerHTML = `
    <div class="card-top">
      <div>
        <div class="company-name">${opp.company}</div>
        <div class="role-name">${opp.role}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.4rem;">
        <div class="company-logo">${logoLetters(opp.company)}</div>
        <span class="source-tag ${srcCls}">${opp.source}</span>
      </div>
    </div>

    <div class="card-details">
      <div class="card-detail-item">
        <i class="fa-solid fa-user-graduate"></i>
        <span>${opp.eligibility || 'Open for all'}</span>
      </div>
      <div class="card-detail-item">
        <i class="fa-solid fa-calendar-xmark"></i>
        <span>Deadline: ${new Date(opp.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
      </div>
    </div>

    <span class="deadline-badge ${urg}">
      <i class="fa-solid fa-clock"></i> ${label}
    </span>

    <div class="card-footer">
      ${opp.applyLink
        ? `<a href="${opp.applyLink}" target="_blank" rel="noopener" class="btn-apply">
             <i class="fa-solid fa-arrow-up-right-from-square"></i> Apply
           </a>`
        : `<span class="btn-apply" style="opacity:0.5;cursor:not-allowed;">No Link</span>`
      }
      <button class="btn-view" data-id="${opp._id}">
        <i class="fa-solid fa-eye"></i> View
      </button>
    </div>
  `;

  // View button opens modal
  card.querySelector('.btn-view').addEventListener('click', (e) => {
    e.stopPropagation();
    openModal(opp._id);
  });

  // Clicking card area also opens modal
  card.addEventListener('click', (e) => {
    if (!e.target.closest('.btn-apply')) openModal(opp._id);
  });

  return card;
}

/**
 * Renders a list of cards into a target container.
 */
function renderCards(container, list) {
  container.innerHTML = '';
  if (!list.length) {
    container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-inbox"></i><p>No opportunities found.</p></div>';
    return;
  }
  list.forEach(opp => container.appendChild(buildCard(opp)));
}

/* ── MODAL ────────────────────────────────────────────── */

function openModal(id) {
  const opp = allOpportunities.find(o => o._id === id);
  if (!opp) return;

  const days   = daysUntil(opp.deadline);
  const urg    = urgencyClass(days);
  const label  = deadlineLabel(opp.deadline);
  const srcCls = sourceClass(opp.source);

  document.getElementById('modalContent').innerHTML = `
    <div class="modal-company-header">
      <div class="modal-logo">${logoLetters(opp.company)}</div>
      <div>
        <div class="modal-role">${opp.role}</div>
        <div class="modal-company">${opp.company}</div>
        <span class="source-tag ${srcCls}" style="margin-top:0.4rem;display:inline-block;">${opp.source}</span>
      </div>
    </div>

    <div class="modal-meta">
      <div class="meta-item">
        <div class="meta-label">Eligibility</div>
        <div class="meta-value">${opp.eligibility || 'Open for all'}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Deadline</div>
        <div class="meta-value" style="color:var(--${urg === 'urgent' ? 'red' : urg === 'soon' ? 'orange' : 'green'})">
          ${new Date(opp.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          <div style="font-size:0.78rem;font-weight:400;margin-top:2px;">${label}</div>
        </div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Source</div>
        <div class="meta-value">${opp.source}</div>
      </div>
      <div class="meta-item">
        <div class="meta-label">Posted On</div>
        <div class="meta-value">${new Date(opp.postedDate || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
      </div>
    </div>

    ${opp.description
      ? `<div class="modal-desc">${opp.description}</div>`
      : ''
    }

    <div class="modal-actions">
      ${opp.applyLink
        ? `<a href="${opp.applyLink}" target="_blank" rel="noopener" class="btn-primary">
             <i class="fa-solid fa-arrow-up-right-from-square"></i> Apply Now
           </a>`
        : ''
      }
      <button class="btn-outline" onclick="closeModal()">
        <i class="fa-solid fa-xmark"></i> Close
      </button>
    </div>
  `;

  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalOverlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
});

/* ── DASHBOARD ────────────────────────────────────────── */

function renderDashboard() {
  const now = new Date();
  document.getElementById('todayDate').textContent =
    now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const total     = allOpportunities.length;
  const urgent    = allOpportunities.filter(o => { const d = daysUntil(o.deadline); return d >= 0 && d <= 7; }).length;
  const telegram  = allOpportunities.filter(o => o.source === 'Telegram').length;
  const website   = allOpportunities.filter(o => o.source === 'Website').length;

  animateCount('statTotal',    total);
  animateCount('statUrgent',   urgent);
  animateCount('statTelegram', telegram);
  animateCount('statWebsite',  website);

  document.getElementById('totalBadge').textContent = total;

  // Notification dot: urgent deadlines
  if (urgent > 0) document.getElementById('notifDot').classList.add('visible');

  // Recent cards (latest 6)
  const recent = [...allOpportunities].slice(0, 6);
  renderCards(document.getElementById('recentCards'), recent);

  // Upcoming deadlines (next 5, sorted by deadline)
  const upcoming = allOpportunities
    .filter(o => daysUntil(o.deadline) >= 0)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))
    .slice(0, 5);
  renderDeadlineList(document.getElementById('upcomingDeadlines'), upcoming);
}

/**
 * Animates a count-up for stat numbers.
 */
function animateCount(id, target) {
  const el = document.getElementById(id);
  let start = 0;
  const step  = Math.ceil(target / 20);
  const timer = setInterval(() => {
    start = Math.min(start + step, target);
    el.textContent = start;
    if (start >= target) clearInterval(timer);
  }, 40);
}

/**
 * Renders a deadline list into a container.
 */
function renderDeadlineList(container, list) {
  if (!list.length) {
    container.innerHTML = '<p class="no-data">🎉 No upcoming deadlines.</p>';
    return;
  }
  container.innerHTML = list.map(opp => {
    const days = daysUntil(opp.deadline);
    const urg  = urgencyClass(days);
    return `
      <div class="deadline-item" onclick="openModal('${opp._id}')">
        <div class="dl-bar ${urg}"></div>
        <div class="dl-info">
          <div class="dl-company">${opp.company}</div>
          <div class="dl-role">${opp.role}</div>
        </div>
        <div class="dl-date">${deadlineLabel(opp.deadline)}</div>
      </div>
    `;
  }).join('');
}

/* ── OPPORTUNITIES PAGE ──────────────────────────────── */

let currentSourceFilter = 'all';

function renderOpportunities(filter = 'all') {
  const list = filter === 'all'
    ? allOpportunities
    : allOpportunities.filter(o => o.source === filter);
  renderCards(document.getElementById('allCards'), list);
}

// Quick source filter chips
document.querySelectorAll('.filter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentSourceFilter = chip.dataset.filter;
    renderOpportunities(currentSourceFilter);
  });
});

/* ── SEARCH & FILTER PAGE ─────────────────────────────── */

/**
 * Populates select dropdowns with unique values from data.
 */
function populateFilterDropdowns() {
  const roles = [...new Set(allOpportunities.map(o => o.role).filter(Boolean))];
  const eligibilities = [...new Set(allOpportunities.map(o => o.eligibility).filter(Boolean))];

  const roleSelect = document.getElementById('filterRole');
  const eligSelect = document.getElementById('filterEligibility');

  roles.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r;
    roleSelect.appendChild(opt);
  });

  eligibilities.forEach(e => {
    const opt = document.createElement('option');
    opt.value = e;
    opt.textContent = e;
    eligSelect.appendChild(opt);
  });
}

/**
 * Runs the combined search + filter query and renders results.
 */
function runSearch() {
  const query  = document.getElementById('searchInput').value.trim().toLowerCase();
  const role   = document.getElementById('filterRole').value;
  const source = document.getElementById('filterSource').value;
  const elig   = document.getElementById('filterEligibility').value;
  const within = parseInt(document.getElementById('filterDeadline').value) || null;

  let results = allOpportunities.filter(opp => {
    const text = `${opp.company} ${opp.role} ${opp.eligibility} ${opp.description}`.toLowerCase();
    if (query && !text.includes(query)) return false;
    if (role   && opp.role !== role)    return false;
    if (source && opp.source !== source) return false;
    if (elig   && opp.eligibility !== elig) return false;
    if (within) {
      const d = daysUntil(opp.deadline);
      if (d < 0 || d > within) return false;
    }
    return true;
  });

  document.getElementById('searchResultsInfo').textContent =
    results.length ? `Found ${results.length} result(s)` : '';
  renderCards(document.getElementById('searchResults'), results);
}

document.getElementById('applyFilters').addEventListener('click', runSearch);
document.getElementById('searchInput').addEventListener('input', runSearch);

document.getElementById('clearSearch').addEventListener('click', () => {
  document.getElementById('searchInput').value = '';
  document.getElementById('searchResults').innerHTML =
    '<div class="empty-state"><i class="fa-solid fa-magnifying-glass-minus"></i><p>Start searching or apply filters above.</p></div>';
  document.getElementById('searchResultsInfo').textContent = '';
});

document.getElementById('resetFilters').addEventListener('click', () => {
  document.getElementById('filterRole').selectedIndex = 0;
  document.getElementById('filterSource').selectedIndex = 0;
  document.getElementById('filterEligibility').selectedIndex = 0;
  document.getElementById('filterDeadline').selectedIndex = 0;
  document.getElementById('searchInput').value = '';
  document.getElementById('searchResultsInfo').textContent = '';
  document.getElementById('searchResults').innerHTML =
    '<div class="empty-state"><i class="fa-solid fa-magnifying-glass-minus"></i><p>Start searching or apply filters above.</p></div>';
});

/* ── CALENDAR PAGE ────────────────────────────────────── */

function renderCalendar() {
  const year  = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  document.getElementById('calMonthYear').textContent =
    new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // Build set of days that have deadlines this month
  const deadlineDays = new Set();
  allOpportunities.forEach(opp => {
    const d = new Date(opp.deadline);
    if (d.getFullYear() === year && d.getMonth() === month) {
      deadlineDays.add(d.getDate());
    }
  });

  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const calBody = document.getElementById('calBody');
  calBody.innerHTML = '';

  // Blank cells before first day
  for (let i = 0; i < firstDay; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-day empty';
    calBody.appendChild(blank);
  }

  for (let d = 1; d <= totalDays; d++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    cell.textContent = d;

    const isToday = today.getDate() === d && today.getMonth() === month && today.getFullYear() === year;
    if (isToday) cell.classList.add('today');

    if (deadlineDays.has(d)) cell.classList.add('has-deadlines');

    if (selectedCalDate && selectedCalDate.getDate() === d &&
        selectedCalDate.getMonth() === month && selectedCalDate.getFullYear() === year) {
      cell.classList.add('selected');
    }

    cell.addEventListener('click', () => {
      selectedCalDate = new Date(year, month, d);
      renderCalendar(); // re-render to update selected state
      showDeadlinesForDate(selectedCalDate);
    });

    calBody.appendChild(cell);
  }
}

function showDeadlinesForDate(date) {
  const label = document.getElementById('selectedDateLabel');
  label.textContent = `Deadlines on ${date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}`;

  const matching = allOpportunities.filter(opp => {
    const d = new Date(opp.deadline);
    return d.getDate() === date.getDate() && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
  });

  renderDeadlineList(document.getElementById('calDeadlineList'), matching);

  if (!matching.length) {
    document.getElementById('calDeadlineList').innerHTML = '<p class="no-data">No deadlines on this date.</p>';
  }
}

document.getElementById('calPrev').addEventListener('click', () => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
  renderCalendar();
});

document.getElementById('calNext').addEventListener('click', () => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
  renderCalendar();
});

/* ── ADD OPPORTUNITY PAGE ─────────────────────────────── */

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// Manual form submit
document.getElementById('addForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const company     = document.getElementById('fc-company').value.trim();
  const role        = document.getElementById('fc-role').value.trim();
  const eligibility = document.getElementById('fc-eligibility').value.trim();
  const deadline    = document.getElementById('fc-deadline').value;
  const applyLink   = document.getElementById('fc-applyLink').value.trim();
  const source      = document.getElementById('fc-source').value;
  const description = document.getElementById('fc-description').value.trim();
  const msg         = document.getElementById('formMsg');

  if (!company || !role || !deadline) {
    msg.textContent = '⚠️ Please fill in required fields (Company, Role, Deadline).';
    msg.className = 'form-msg error';
    return;
  }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving…';

  const opp = { company, role, eligibility, deadline, applyLink, source, description };
  const saved = await postOpportunity(opp);

  if (!allOpportunities.find(o => o._id === saved._id)) {
    allOpportunities.unshift(saved);
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-plus"></i> Add Opportunity';
  msg.textContent = `✅ "${role}" at ${company} added successfully!`;
  msg.className = 'form-msg success';
  document.getElementById('addForm').reset();
  showToast(`Added: ${role} @ ${company}`, 'success');

  // Refresh stats
  renderDashboard();
});

/* ── TELEGRAM SIMULATION PIPELINE ───────────────────── */
/**
 * Simulates the data pipeline:
 * 1. Ingests raw Telegram message text.
 * 2. Uses regex-based text parsing to extract fields.
 * 3. Returns structured opportunity object.
 */
function parseTelegramMessage(rawText) {
  if (!rawText.trim()) return null;

  // ── Extraction helpers ──

  // Company: line containing "hiring" or first line before ":"
  const companyMatch =
    rawText.match(/(?:at|by|from)\s+([A-Z][a-zA-Z\s&.]+?)(?:\s+is|\s*!|\s*\n)/i) ||
    rawText.match(/([A-Z][a-zA-Z\s&.]+?)\s+(?:is\s+)?hiring/i);
  const company = companyMatch ? companyMatch[1].trim() : 'Unknown Company';

  // Role
  const roleMatch =
    rawText.match(/role\s*[:\-–]\s*(.+)/i) ||
    rawText.match(/position\s*[:\-–]\s*(.+)/i) ||
    rawText.match(/hiring\s+(?:a\s+)?(.+?)(?:\n|!|\.|at\s)/i);
  const role = roleMatch ? roleMatch[1].trim() : 'Opportunity';

  // Eligibility
  const eligMatch =
    rawText.match(/eligib(?:ility|le)\s*[:\-–]\s*(.+)/i) ||
    rawText.match(/(?:for|who)\s*[:\-–]\s*(.+)/i) ||
    rawText.match(/(B\.?Tech[^,\n]*)/i);
  const eligibility = eligMatch ? eligMatch[1].replace(/[\n\r]/g, '').trim() : '';

  // Deadline – various formats
  const dlMatch =
    rawText.match(/deadline\s*[:\-–]\s*(.+)/i) ||
    rawText.match(/last\s+date\s*[:\-–]\s*(.+)/i) ||
    rawText.match(/apply\s+by\s*[:\-–]?\s*(.+)/i) ||
    rawText.match(/(?:closes?\s+on|due\s+by\s*[:\-–]?\s*)(.+)/i) ||
    rawText.match(/(\w+ \d{1,2},? \d{4})/);

  let deadline = '';
  if (dlMatch) {
    const raw = dlMatch[1].trim().split('\n')[0];
    const parsed = new Date(raw);
    deadline = isNaN(parsed)
      ? new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
      : parsed.toISOString().split('T')[0];
  } else {
    deadline = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
  }

  // Apply link
  const linkMatch = rawText.match(/https?:\/\/[^\s]+/i);
  const applyLink = linkMatch ? linkMatch[0] : '';

  return { company, role, eligibility, deadline, applyLink, source: 'Telegram', description: rawText.trim() };
}

document.getElementById('parseTgBtn').addEventListener('click', () => {
  const raw = document.getElementById('tgInput').value;
  const msg = document.getElementById('tgMsg');
  msg.textContent = '';

  if (!raw.trim()) {
    msg.textContent = '⚠️ Please paste a message first.';
    msg.className = 'form-msg error';
    return;
  }

  extractedTgData = parseTelegramMessage(raw);

  // Show preview
  document.getElementById('tgPreviewContent').innerHTML = `
    <div class="extracted-field"><span>Company</span> ${extractedTgData.company}</div>
    <div class="extracted-field"><span>Role</span> ${extractedTgData.role}</div>
    <div class="extracted-field"><span>Eligibility</span> ${extractedTgData.eligibility || '—'}</div>
    <div class="extracted-field"><span>Deadline</span> ${extractedTgData.deadline}</div>
    <div class="extracted-field"><span>Apply Link</span> ${extractedTgData.applyLink || '—'}</div>
    <div class="extracted-field"><span>Source</span> ${extractedTgData.source}</div>
  `;
  document.getElementById('tgPreview').style.display = 'block';
});

document.getElementById('confirmTgBtn').addEventListener('click', async () => {
  if (!extractedTgData) return;
  const msg = document.getElementById('tgMsg');

  const saved = await postOpportunity(extractedTgData);
  if (!allOpportunities.find(o => o._id === saved._id)) {
    allOpportunities.unshift(saved);
  }

  document.getElementById('tgPreview').style.display = 'none';
  document.getElementById('tgInput').value = '';
  extractedTgData = null;
  msg.textContent = `✅ Opportunity extracted and saved!`;
  msg.className = 'form-msg success';
  showToast('Telegram opportunity added!', 'success');
  renderDashboard();
});

/* ── ROUTING / NAVIGATION ─────────────────────────────── */

const PAGE_TITLES = {
  dashboard:     'Dashboard',
  opportunities: 'Opportunities',
  search:        'Search & Filter',
  calendar:      'Deadlines Calendar',
  add:           'Add Opportunity'
};

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));

  const page = document.getElementById(`page-${pageId}`);
  const navLink = document.getElementById(`nav-${pageId}`);
  if (page) page.classList.add('active');
  if (navLink) navLink.classList.add('active');

  document.getElementById('pageTitle').textContent = PAGE_TITLES[pageId] || pageId;

  // Close sidebar on mobile after navigation
  document.getElementById('sidebar').classList.remove('open');

  // Refresh page-specific content
  if (pageId === 'dashboard') renderDashboard();
  if (pageId === 'opportunities') renderOpportunities(currentSourceFilter);
  if (pageId === 'calendar') renderCalendar();
}

// Nav link clicks
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    showPage(link.dataset.page);
  });
});

// "View All" button on dashboard
document.querySelectorAll('.view-all').forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    showPage(a.dataset.page);
  });
});

// Mobile sidebar toggle
document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.add('open');
});
document.getElementById('sidebarClose').addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('open');
});

// Refresh button
document.getElementById('refreshBtn').addEventListener('click', async () => {
  showToast('Refreshing data…', 'info');
  allOpportunities = await fetchOpportunities();
  showPage('dashboard');
  showToast('Data refreshed!', 'success');
});

/* ── INIT ─────────────────────────────────────────────── */
async function init() {
  allOpportunities = await fetchOpportunities();
  populateFilterDropdowns();
  showPage('dashboard');
}

init();
