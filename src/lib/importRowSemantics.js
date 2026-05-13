import { normalizeCategoryForSave } from './contactCategories';
import { CONTACT_STATUS_VALUES, normalizeStatusForSave } from './contactStatuses';

const STATUS_SET = new Set(CONTACT_STATUS_VALUES);

function normHeader(h) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function compactHeader(h) {
  return normHeader(h).replace(/\s/g, '');
}

/** @returns {number} column index or -1 */
export function findBestMonthlyAmountColumnIndex(headerCells) {
  if (!headerCells?.length) return -1;
  let best = -1;
  let bestScore = 0;
  headerCells.forEach((raw, i) => {
    const c = compactHeader(raw);
    const n = normHeader(raw);
    let score = 0;
    if (c.includes('monthly') && (c.includes('amount') || c.includes('gift') || c.includes('pledge') || c.includes('support')))
      score = 100;
    else if (c === 'monthlyamount' || c.includes('monthly_amount')) score = 98;
    else if (c === 'monthly' || n === 'monthly') score = 90;
    else if (c.includes('pledge') && !c.includes('one')) score = 88;
    else if ((c === 'amount' || n === 'amount') && !c.includes('one')) score = 72;
    else if (n.includes('monthly') && n.includes('donation')) score = 85;
    else if (n.includes('support amount') || n.includes('giving amount')) score = 82;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return bestScore >= 60 ? best : -1;
}

/** @returns {number} column index or -1 */
export function findBestStatusColumnIndex(headerCells) {
  if (!headerCells?.length) return -1;
  let best = -1;
  let bestScore = 0;
  headerCells.forEach((raw, i) => {
    const c = compactHeader(raw);
    const n = normHeader(raw);
    let score = 0;
    if (c === 'status' || c === 'stage') score = 100;
    else if (c.includes('contactstatus') || c.includes('crmstatus')) score = 95;
    else if (n.includes('pipeline') && n.includes('stage')) score = 92;
    else if (n.includes('pipeline status')) score = 90;
    else if (n === 'state' || n.includes('lifecycle')) score = 70;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return bestScore >= 70 ? best : -1;
}

/** @returns {number} column index or -1 */
export function findBestCategoryColumnIndex(headerCells) {
  if (!headerCells?.length) return -1;
  let best = -1;
  let bestScore = 0;
  headerCells.forEach((raw, i) => {
    const c = compactHeader(raw);
    const n = normHeader(raw);
    let score = 0;
    if (c === 'category' || c === 'type' || c === 'segment' || c === 'role' || c === 'constituenttype') score = 100;
    else if (n.includes('contact type') || n.includes('constituent type')) score = 96;
    else if (c.includes('category') || c.includes('relationshiptype')) score = 92;
    else if (/^(tag|tags|group|cohort)$/i.test(n.trim())) score = 82;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return bestScore >= 80 ? best : -1;
}

export function parseMonthlyAmountCell(val) {
  const raw = String(val ?? '').trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/[$€£,\s]/g, '').replace(/[^\d.-]/g, '');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Interpret free-text status from spreadsheets (case-insensitive).
 * @returns {{ explicitEnum: string | null, partnerKeywords: boolean }}
 */
export function interpretImportStatusCell(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return { explicitEnum: null, partnerKeywords: false };

  const lower = s.toLowerCase();
  if (
    /\b(former|previous|past|ex-?\s?partner|ex-?\s?supporter|no\s+longer|lapsed|dropped)\b/i.test(lower)
  ) {
    return { explicitEnum: null, partnerKeywords: false };
  }
  if (/\b(supporter|monthly\s*supporter|monthly\s*partner|giving\s*partner|mission\s*partner)\b/i.test(lower)) {
    return { explicitEnum: 'partner', partnerKeywords: true };
  }
  if (/\bpartner\b/i.test(lower) && !/\bpotential\b/i.test(lower)) {
    return { explicitEnum: 'partner', partnerKeywords: true };
  }

  const compact = lower.replace(/[\s_-]+/g, '');

  if (/\bmeeting\s*(set|scheduled)\b/i.test(lower) || compact.includes('meetingscheduled') || compact === 'meetingset') {
    return { explicitEnum: 'meeting_scheduled', partnerKeywords: false };
  }
  if (/\bcommitted\b/i.test(lower) || /\bcommitment\b/i.test(lower)) {
    return { explicitEnum: 'committed', partnerKeywords: false };
  }
  if (/\bcontacted\b/i.test(lower) || /\bfollow[-\s]?up\b/i.test(lower) || compact === 'followup') {
    return { explicitEnum: 'contacted', partnerKeywords: false };
  }
  if (/\basked\b/i.test(lower)) {
    return { explicitEnum: 'contacted', partnerKeywords: false };
  }
  if (/\bdeclined\b/i.test(lower) || /\bnot\s+interested\b/i.test(lower)) {
    return { explicitEnum: 'declined', partnerKeywords: false };
  }
  if (/\bprospect\b/i.test(lower) || /\bpotential\b/i.test(lower) || /\bnew\s+lead\b/i.test(lower)) {
    return { explicitEnum: 'prospect', partnerKeywords: false };
  }

  const slug = lower.replace(/[\s/]+/g, '_');
  if (STATUS_SET.has(slug)) return { explicitEnum: slug, partnerKeywords: false };

  const direct = normalizeStatusForSave(lower);
  if (STATUS_SET.has(direct) && direct !== 'prospect') return { explicitEnum: direct, partnerKeywords: false };

  return { explicitEnum: null, partnerKeywords: false };
}

/**
 * Default **null** (uncategorized) unless monthly &gt; 0 → supporter; explicit supporter/partner/monthly
 * cues in **category** or **status** column → supporter; church/org from those columns → church;
 * previous/former/dropped → former. Does not read name/notes (avoids blanket mis-tags).
 * @param {{ statusText?: string, categoryText?: string }} row parsed fields
 * @param {number} monthlyAmount resolved monthly support amount for this row
 * @returns {'supporter'|'church'|'former'|null}
 */
export function determineCategory(row, monthlyAmount) {
  const signals = row && typeof row === 'object' && !Array.isArray(row) ? row : {};
  const statusText = String(signals.statusText ?? '').trim();
  const categoryText = String(signals.categoryText ?? '').trim();
  const statusLower = statusText.toLowerCase();
  const categoryLower = categoryText.toLowerCase();

  const monthly = Number(monthlyAmount);
  const amt = Number.isFinite(monthly) && monthly > 0 ? monthly : 0;
  if (amt > 0) return 'supporter';

  if (categoryText) {
    if (
      /\b(former|previous|past|dropped|lapsed|inactive|no\s+longer|ex-?\s?partner|ex-?\s?supporter)\b/i.test(categoryLower)
    ) {
      return 'former';
    }
    if (
      /\b(church|chapel|congregation|parish|cathedral|denomination|organization|organisation|org\b|ministry\s+team)\b/i.test(
        categoryLower,
      )
    ) {
      return 'church';
    }
    if (
      /\b(supporter|partner|monthly(\s+|$)|recurring|pledge|mission\s*partner|giving\s*partner)\b/i.test(categoryLower)
    ) {
      return 'supporter';
    }
  }

  if (statusText) {
    if (
      /\b(no\s+longer|previously|previous\s+partner|previous\s+supporter|formerly|past\s+supporter|ex-?\s?partner|lapsed|dropped)\b/i.test(
        statusLower,
      ) ||
      /\bformer\s+(partner|supporter|donor|giver|mission\s*partner)\b/i.test(statusLower)
    ) {
      return 'former';
    }

    if (/\b(church|chapel|congregation|parish|cathedral|denomination|presbytery|diocese)\b/i.test(statusLower)) {
      return 'church';
    }

    const interpreted = interpretImportStatusCell(statusText);
    if (interpreted.partnerKeywords || interpreted.explicitEnum === 'partner') return 'supporter';
  }

  return null;
}

/**
 * Merge parsed name/phone/email row with optional status + monthly + category columns.
 * @param {object} draft base draft (uncategorized + prospect defaults are fine)
 * @param {unknown[]} row
 * @param {{ statusIdx: number, monthlyIdx: number, categoryIdx: number, width: number }} ctx
 */
export function applyImportRowSemantics(draft, row, ctx) {
  const { statusIdx, monthlyIdx, categoryIdx = -1, width } = ctx;
  let status = normalizeStatusForSave(draft.status);
  let monthly_amount = Number.isFinite(Number(draft.monthly_amount)) ? Number(draft.monthly_amount) : 0;

  let statusCell = '';
  let categoryCell = '';

  if (categoryIdx >= 0 && categoryIdx < width) {
    categoryCell = String(row[categoryIdx] ?? '').trim();
  }

  if (statusIdx >= 0 && statusIdx < width) {
    const cell = String(row[statusIdx] ?? '').trim();
    statusCell = cell;
    if (cell) {
      const interpreted = interpretImportStatusCell(cell);
      if (interpreted.partnerKeywords || interpreted.explicitEnum === 'partner') {
        status = 'partner';
      } else if (interpreted.explicitEnum) {
        status = normalizeStatusForSave(interpreted.explicitEnum);
      }
    }
  }

  if (monthlyIdx >= 0 && monthlyIdx < width) {
    const amt = parseMonthlyAmountCell(row[monthlyIdx]);
    if (amt > 0) {
      monthly_amount = amt;
      status = 'partner';
    }
  }

  let finalStatus = normalizeStatusForSave(status);
  const inferredCategory = determineCategory(
    { statusText: statusCell, categoryText: categoryCell },
    monthly_amount,
  );
  let finalCategory = inferredCategory == null ? null : normalizeCategoryForSave(inferredCategory);

  if (finalStatus === 'partner') finalCategory = 'supporter';
  if (finalCategory === 'supporter' && finalStatus !== 'declined') finalStatus = 'partner';

  return {
    ...draft,
    category: finalCategory,
    status: finalStatus,
    monthly_amount,
  };
}
