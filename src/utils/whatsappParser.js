/**
 * WorkLedger - WhatsApp Message Parser
 *
 * Parses job data that Mr. Roz (and similar freelance technicians) send via
 * WhatsApp. Converts unstructured Malay/English text messages into structured
 * work entry objects ready for QuickEntry.jsx to pre-fill.
 *
 * ── SUPPORTED MESSAGE FORMATS ────────────────────────────────────────────────
 *
 * Format 1 (Full date header):
 *   Jumaat, 20 Feb 2026
 *   Unit 12A, Sri Damansara
 *   aircond bocor, outdoor unit leak
 *   Siap: 2pm
 *
 * Format 2 (Short date):
 *   20/2/26 - Unit 5B Empire Damansara
 *   Aircond tak sejuk, gas leak
 *
 * Format 3 (Free-form, date anywhere):
 *   Pagi tadi pergi 12A Sri Damansara
 *   aircond outdoor bocor
 *   tarikh: 20 Feb
 *
 * @module utils/whatsappParser
 * @created February 21, 2026 - Session 13
 */

// ── Malay day & month maps ─────────────────────────────────────────────────

const MALAY_MONTHS = {
  jan: 0, feb: 1, mac: 2, mar: 2, apr: 3,
  mei: 4, may: 4, jun: 5, jul: 6, ogo: 7, aug: 7,
  sep: 8, okt: 9, oct: 9, nov: 10, dis: 11, dec: 11
};

// ── Common job keywords → field mapping ───────────────────────────────────
const JOB_KEYWORDS = {
  // Equipment type signals
  'aircond':    'air_conditioner',
  'air cond':   'air_conditioner',
  'air-cond':   'air_conditioner',
  'penghawa':   'air_conditioner',
  'pump':       'pump',
  'pam':        'pump',
  'chiller':    'chiller',
  'lift':       'lift',
  'escalator':  'escalator',
  'generator':  'generator',
  'genset':     'generator',
  'water heater': 'water_heater',
  'water tank': 'water_tank',
  'paip':       'plumbing',
  'pipe':       'plumbing'
};

const PROBLEM_KEYWORDS = [
  'bocor', 'leak', 'rosak', 'breakdown', 'tak sejuk', 'tak dingin',
  'gas habis', 'gas leak', 'no cooling', 'noisy', 'bising',
  'trip', 'overload', 'voltage', 'electrical', 'wiring',
  'tersumbat', 'blocked', 'clogged', 'compressor', 'fan'
];

// ──────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ──────────────────────────────────────────────────────────────────────────

/**
 * Parse a raw WhatsApp message string into a structured work entry object.
 *
 * @param {string} rawText - The WhatsApp message text
 * @returns {{
 *   entry_date: string|null,       // YYYY-MM-DD or null if not found
 *   location: string|null,         // extracted location/unit
 *   equipment_type: string|null,   // normalised equipment type
 *   job_description: string,       // full cleaned description
 *   problems_detected: string[],   // list of problem keywords found
 *   raw_lines: string[],           // original lines for display
 *   confidence: 'high'|'medium'|'low',  // how confident the parse was
 *   warnings: string[],            // things the user should verify
 * }}
 */
export function parseWhatsAppMessage(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return _emptyResult('No message text provided.');
  }

  const lines   = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const full    = rawText.toLowerCase();
  const warnings = [];

  // ── 1. Extract date ────────────────────────────────────────────────────
  const { date: entry_date, confidence: dateCon } = _extractDate(lines, warnings);

  // ── 2. Extract location ────────────────────────────────────────────────
  const location = _extractLocation(lines);

  // ── 3. Extract equipment type ──────────────────────────────────────────
  const equipment_type = _extractEquipment(full);

  // ── 4. Extract problems ────────────────────────────────────────────────
  const problems_detected = _extractProblems(full);

  // ── 5. Build job description (non-date, non-location lines joined) ─────
  const descLines = lines.filter(l => {
    const lo = l.toLowerCase();
    // Skip lines that look like pure date lines
    if (_looksLikeDate(lo)) {
      return false;
    }
    return true;
  });
  const job_description = descLines.join(' ').replace(/\s+/g, ' ').trim();

  // ── 6. Overall confidence ─────────────────────────────────────────────
  let confidence = 'high';
  if (!entry_date)      {
    confidence = 'low';    warnings.push('Could not detect a date — please set manually.'); 
  } else if (dateCon === 'medium') {
    confidence = 'medium'; 
  }
  if (!location)        {
    warnings.push('No location/unit found — please fill in manually.');
  }
  if (!equipment_type)  {
    warnings.push('Equipment type not detected — please select manually.');
  }

  return {
    entry_date,
    location,
    equipment_type,
    job_description,
    problems_detected,
    raw_lines: lines,
    confidence,
    warnings
  };
}

/**
 * Convert parsed result into work entry data JSONB fields.
 * Maps to the generic field names used by the Air-Cond / Maintenance templates.
 *
 * @param {Object} parsed - result from parseWhatsAppMessage()
 * @param {Object} overrides - any manual overrides from the form
 * @returns {Object} data object ready for workEntryService.createWorkEntry()
 */
export function toWorkEntryData(parsed, overrides = {}) {
  return {
    location:         parsed.location        || '',
    equipment_type:   parsed.equipment_type  || '',
    job_description:  parsed.job_description || '',
    problems_detected: parsed.problems_detected.join(', '),
    source:           'whatsapp',
    ...overrides
  };
}

// ──────────────────────────────────────────────────────────────────────────
// PRIVATE HELPERS
// ──────────────────────────────────────────────────────────────────────────

function _emptyResult(warning) {
  return {
    entry_date: null, location: null, equipment_type: null,
    job_description: '', problems_detected: [],
    raw_lines: [], confidence: 'low', warnings: [warning]
  };
}

/**
 * Try to extract a date from the message lines.
 * Returns { date: 'YYYY-MM-DD'|null, confidence: 'high'|'medium' }
 *
 * Handles:
 *   - "Jumaat, 20 Feb 2026"  → high
 *   - "20/2/26"              → high
 *   - "20 Feb"               → medium (assumes current year)
 *   - "tarikh: 20 Feb 2026"  → high
 */
function _extractDate(lines, warnings) {
  const currentYear = new Date().getFullYear();

  for (const line of lines) {
    const lo = line.toLowerCase().replace(/[:,]/g, ' ').trim();

    // ── Pattern: "jumaat 20 feb 2026" or "20 feb 2026" ────────────────
    const fullDateMatch = lo.match(
      /(?:isnin|selasa|rabu|khamis|jumaat|sabtu|ahad|minggu)?\s*(\d{1,2})\s+(jan|feb|mac|mar|apr|mei|may|jun|jul|ogo|aug|sep|okt|oct|nov|dis|dec)\s+(\d{2,4})/
    );
    if (fullDateMatch) {
      const day   = parseInt(fullDateMatch[1]);
      const month = MALAY_MONTHS[fullDateMatch[2]];
      let year    = parseInt(fullDateMatch[3]);
      if (year < 100) {
        year += 2000;
      }
      const d = _safeDate(year, month, day);
      if (d) {
        return { date: d, confidence: 'high' };
      }
    }

    // ── Pattern: "20/2/26" or "20-02-2026" ────────────────────────────
    const numericMatch = lo.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (numericMatch) {
      const day   = parseInt(numericMatch[1]);
      const month = parseInt(numericMatch[2]) - 1;
      let year    = parseInt(numericMatch[3]);
      if (year < 100) {
        year += 2000;
      }
      const d = _safeDate(year, month, day);
      if (d) {
        return { date: d, confidence: 'high' };
      }
    }

    // ── Pattern: "20 Feb" (no year — assume current) ──────────────────
    const shortDateMatch = lo.match(/(\d{1,2})\s+(jan|feb|mac|mar|apr|mei|may|jun|jul|ogo|aug|sep|okt|oct|nov|dis|dec)/);
    if (shortDateMatch) {
      const day   = parseInt(shortDateMatch[1]);
      const month = MALAY_MONTHS[shortDateMatch[2]];
      const d     = _safeDate(currentYear, month, day);
      if (d) {
        warnings.push(`Date assumed year ${currentYear} — please verify.`);
        return { date: d, confidence: 'medium' };
      }
    }
  }

  return { date: null, confidence: 'low' };
}

/** Format a date safely, return null if invalid */
function _safeDate(year, month, day) {
  try {
    const d = new Date(year, month, day);
    if (isNaN(d.getTime())) {
      return null;
    }
    // Verify no overflow (e.g. Feb 30)
    if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) {
      return null;
    }
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  } catch {
    return null;
  }
}

/** Return true if the line looks like it's mainly a date */
function _looksLikeDate(lo) {
  return (
    /^(isnin|selasa|rabu|khamis|jumaat|sabtu|ahad|minggu)/.test(lo) ||
    /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(lo) ||
    /^tarikh/.test(lo)
  );
}

/**
 * Try to extract a location/unit from message lines.
 * Looks for unit numbers, building names, or "unit" keyword.
 */
function _extractLocation(lines) {
  for (const line of lines) {
    const lo = line.toLowerCase();
    // Skip pure date lines
    if (_looksLikeDate(lo)) {
      continue;
    }

    // "Unit 12A ..." or "No 5, Jalan ..."
    if (/\b(unit|no\.?|lot|blok|block|rumah)\b/i.test(line)) {
      return line.replace(/^[-–•]\s*/, '').trim();
    }

    // Line contains a unit-like pattern: "12A Sri Damansara"
    if (/^\d+[a-zA-Z]?\s+[A-Z]/.test(line)) {
      return line.trim();
    }
  }

  // Fallback: return second non-date line if it looks like a place
  const nonDateLines = lines.filter(l => !_looksLikeDate(l.toLowerCase()));
  if (nonDateLines.length > 0) {
    return nonDateLines[0].trim();
  }

  return null;
}

/** Detect equipment type from the full message text */
function _extractEquipment(full) {
  for (const [keyword, type] of Object.entries(JOB_KEYWORDS)) {
    if (full.includes(keyword)) {
      return type;
    }
  }
  return null;
}

/** Extract all matching problem keywords */
function _extractProblems(full) {
  return PROBLEM_KEYWORDS.filter(kw => full.includes(kw));
}

export default parseWhatsAppMessage;
