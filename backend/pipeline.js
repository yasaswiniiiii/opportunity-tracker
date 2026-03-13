/**
 * pipeline.js – Data Pipeline
 * ============================
 * The pipeline converts raw, unstructured notification text
 * (from Telegram, Email, Web forms) into clean, structured
 * Opportunity documents ready to be stored in MongoDB.
 *
 * Pipeline Steps:
 *  [1] Ingestion  – receive raw input (string or object)
 *  [2] Parsing    – tokenise and clean the text
 *  [3] Extraction – regex/heuristic field extraction
 *  [4] Validation – ensure required fields exist
 *  [5] Normalise  – standardise formats (dates, URLs)
 *  [6] Output     – return structured opportunity object
 */

/* ── STEP 1 & 2: INGESTION + TOKENISATION ─────────── */

/**
 * Cleans emoji / unicode decorators from text.
 */
function cleanText(text) {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '') // broad emoji range
    .replace(/[^\x00-\x7F]/g, ' ')           // non-ASCII
    .replace(/\s{2,}/g, ' ')                 // collapse whitespace
    .trim();
}

/* ── STEP 3: FIELD EXTRACTION ─────────────────────── */

/**
 * Extracts the company name from raw message text.
 */
function extractCompany(text) {
  // "Google is hiring…"
  const m1 = text.match(/([A-Z][A-Za-z0-9\s&.,']+?)\s+(?:is\s+)?hiring/i);
  if (m1) return m1[1].trim();

  // "at Google" / "by Google" / "from Google"
  const m2 = text.match(/(?:at|by|from)\s+([A-Z][A-Za-z0-9\s&.,']+?)(?:\s+is|\s*[\n!,])/i);
  if (m2) return m2[1].trim();

  // "Company: Google"
  const m3 = text.match(/company\s*[:\-–]\s*(.+)/i);
  if (m3) return m3[1].split('\n')[0].trim();

  return 'Unknown Company';
}

/**
 * Extracts the job/internship role from raw message text.
 */
function extractRole(text) {
  const patterns = [
    /role\s*[:\-–]\s*(.+)/i,
    /position\s*[:\-–]\s*(.+)/i,
    /(?:for\s+(?:the\s+)?)(?:role\s+of\s+)?(.+?(?:intern|developer|engineer|designer|analyst|researcher|manager)[^\n,]*)/i,
    /hiring\s+(?:for\s+)?(?:a\s+)?(.+?)(?:\n|!|\.|at\s)/i
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].split('\n')[0].trim();
  }
  return 'Internship / Role';
}

/**
 * Extracts eligibility criteria.
 */
function extractEligibility(text) {
  const patterns = [
    /eligib(?:ility|le)\s*[:\-–]\s*(.+)/i,
    /who\s+can\s+apply\s*[:\-–]?\s*(.+)/i,
    /(?:open\s+for|for)\s*[:\-–]\s*(.+)/i,
    /((?:B\.?Tech|M\.?Tech|B\.?E|MCA)[^\n,;]+)/i
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].split('\n')[0].trim();
  }
  return '';
}

/**
 * Extracts application deadline as ISO date string.
 * Falls back to 14 days from now if not found.
 */
function extractDeadline(text) {
  const patterns = [
    /deadline\s*[:\-–]\s*(.+)/i,
    /last\s+date\s*[:\-–]\s*(.+)/i,
    /apply\s+by\s*[:\-–]?\s*(.+)/i,
    /closes?\s+on\s*[:\-–]?\s*(.+)/i,
    /due\s+(?:date|by)\s*[:\-–]?\s*(.+)/i
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const raw = m[1].split('\n')[0].trim();
      const d = new Date(raw);
      if (!isNaN(d)) return d.toISOString().split('T')[0];
    }
  }

  // Fallback: detect standalone date patterns
  const datePat = text.match(
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+ \d{1,2},? \d{4}|\d{1,2} \w+ \d{4})/i
  );
  if (datePat) {
    const d = new Date(datePat[1]);
    if (!isNaN(d)) return d.toISOString().split('T')[0];
  }

  // Default: 14 days from now
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 14);
  return fallback.toISOString().split('T')[0];
}

/**
 * Extracts the first HTTP(S) URL found in the text.
 */
function extractApplyLink(text) {
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0] : '';
}

/* ── STEP 4: VALIDATION ───────────────────────────── */

/**
 * Returns true if the text looks like an opportunity announcement.
 * Filters out unrelated messages in Telegram channels.
 */
function looksLikeOpportunity(text) {
  const keywords = [
    'intern', 'hiring', 'apply', 'opportunity', 'job', 'role',
    'deadline', 'application', 'careers', 'recruitment', 'position'
  ];
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
}

/* ── STEP 5: NORMALISE ────────────────────────────── */

/**
 * Normalises and validates a deadline ISO string.
 */
function normaliseDeadline(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d) ? null : d.toISOString().split('T')[0];
}

/**
 * Ensures applyLink is a proper URL.
 */
function normaliseLink(link) {
  if (!link) return '';
  try {
    new URL(link);
    return link;
  } catch {
    return link.startsWith('http') ? link : `https://${link}`;
  }
}

/* ── STEP 6: PUBLIC API ───────────────────────────── */

/**
 * process(data)
 * ──────────────
 * Processes a manually-submitted structured object (from the API form).
 * Still validates and normalises all fields.
 *
 * @param {Object} data – raw request body
 * @returns {Object}    – cleaned opportunity object
 */
function process(data) {
  if (!data.company) throw new Error('Missing required field: company');
  if (!data.role)    throw new Error('Missing required field: role');
  if (!data.deadline) throw new Error('Missing required field: deadline');

  const deadline = normaliseDeadline(data.deadline);
  if (!deadline) throw new Error('Invalid deadline date');

  return {
    company:     data.company.trim(),
    role:        data.role.trim(),
    eligibility: (data.eligibility || '').trim(),
    deadline,
    description: (data.description || '').trim(),
    applyLink:   normaliseLink(data.applyLink || ''),
    source:      data.source || 'Manual',
    postedDate:  new Date().toISOString().split('T')[0]
  };
}

/**
 * processFromTelegram(rawText)
 * ──────────────────────────────
 * Processes a raw Telegram message string through the full pipeline:
 *  1. Clean text
 *  2. Check relevance
 *  3. Extract all fields
 *  4. Return structured object or null (if not an opportunity)
 *
 * @param {string} rawText – raw Telegram message
 * @returns {Object|null}  – structured opportunity or null
 */
function processFromTelegram(rawText) {
  // Step 1 – Clean
  const clean = cleanText(rawText);

  // Step 2 – Relevance gate
  if (!looksLikeOpportunity(clean)) return null;

  // Steps 3-5 – Extract & normalise
  return {
    company:     extractCompany(clean),
    role:        extractRole(clean),
    eligibility: extractEligibility(clean),
    deadline:    extractDeadline(clean),
    description: rawText.trim(),            // keep original for reference
    applyLink:   extractApplyLink(rawText), // URLs survive emoji stripping
    source:      'Telegram',
    postedDate:  new Date().toISOString().split('T')[0]
  };
}

module.exports = { process, processFromTelegram, looksLikeOpportunity };
