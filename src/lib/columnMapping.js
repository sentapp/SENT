/**
 * Score how well a header matches a field (higher = better).
 */
function norm(h) {
  return String(h ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const NAME_PATTERNS = [
  /^full\s*name$/,
  /^name$/,
  /^contact$/,
  /first\s*(and\s*)?last/i,
  /^first\s*name$/,
  /^last\s*name$/,
  /display\s*name/i,
];
const PHONE_PATTERNS = [
  /^phone$/,
  /^mobile$/,
  /^cell$/,
  /^tel$/,
  /^telephone$/,
  /phone\s*number/i,
  /^work\s*phone$/,
  /^home\s*phone$/,
];
const EMAIL_PATTERNS = [
  /^e-?mail$/,
  /^email$/,
  /^mail$/,
  /email\s*address/i,
];

function scoreAgainstPatterns(header, patterns) {
  const n = norm(header);
  let best = 0;
  for (const p of patterns) {
    if (p.test(n)) best = Math.max(best, 100);
    else if (n.includes(p.source.replace(/[$^]/g, '').replace(/\\/g, ''))) best = Math.max(best, 50);
  }
  // substring heuristics
  if (/name/.test(n) && !/company|church|user\s*name|username|file\s*name/i.test(n)) best = Math.max(best, 40);
  if (/phone|tel|mobile|cell/.test(n)) best = Math.max(best, 40);
  if (/email|e-mail|mail/.test(n) && !/gmail\.com/i.test(n)) best = Math.max(best, 40);
  return best;
}

export function scoreHeaderForField(header, field) {
  if (field === 'full_name' || field === 'name') return scoreAgainstPatterns(header, NAME_PATTERNS);
  if (field === 'phone') return scoreAgainstPatterns(header, PHONE_PATTERNS);
  if (field === 'email') return scoreAgainstPatterns(header, EMAIL_PATTERNS);
  return 0;
}

function indicesAtMax(scores) {
  const max = Math.max(-1, ...scores);
  if (max < 10) return { max, indices: [] };
  const indices = [];
  scores.forEach((s, i) => {
    if (s === max) indices.push(i);
  });
  return { max, indices };
}

/**
 * Pick best column index per field. Returns mapping + whether user should confirm columns.
 */
export function inferColumnMapping(headers) {
  const clean = headers.map((h) => String(h ?? '').trim());

  const scoresName = clean.map((h) => scoreHeaderForField(h, 'full_name'));
  const scoresPhone = clean.map((h) => scoreHeaderForField(h, 'phone'));
  const scoresEmail = clean.map((h) => scoreHeaderForField(h, 'email'));

  // Boost common export headers: name, tel, phone, email
  clean.forEach((h, i) => {
    const compact = norm(h).replace(/\s/g, '');
    if (compact === 'name') scoresName[i] = Math.max(scoresName[i], 95);
    if (compact === 'tel' || compact === 'phone') scoresPhone[i] = Math.max(scoresPhone[i], 95);
    if (compact === 'email') scoresEmail[i] = Math.max(scoresEmail[i], 95);
  });

  const nameStat = indicesAtMax(scoresName);
  const phoneStat = indicesAtMax(scoresPhone);
  const emailStat = indicesAtMax(scoresEmail);

  let fullNameIdx = nameStat.indices.length === 1 ? nameStat.indices[0] : nameStat.indices[0] ?? 0;
  let phoneIdx = phoneStat.indices.length === 1 ? phoneStat.indices[0] : phoneStat.indices[0] ?? -1;
  let emailIdx = emailStat.indices.length === 1 ? emailStat.indices[0] : emailStat.indices[0] ?? -1;

  if (clean.length && nameStat.max < 10) fullNameIdx = 0;
  if (phoneStat.max < 10) phoneIdx = -1;
  if (emailStat.max < 10) emailIdx = -1;

  const overlap =
    fullNameIdx >= 0 &&
    phoneIdx >= 0 &&
    fullNameIdx === phoneIdx &&
    scoresPhone[fullNameIdx] >= 25 &&
    scoresName[fullNameIdx] >= 25;

  const ambiguous =
    nameStat.indices.length > 1 ||
    phoneStat.indices.length > 1 ||
    emailStat.indices.length > 1 ||
    overlap ||
    (nameStat.max < 15 && phoneStat.max < 15 && emailStat.max < 15 && clean.length > 1);

  return {
    fullNameIdx,
    phoneIdx,
    emailIdx,
    ambiguous: Boolean(ambiguous),
    headers: clean,
  };
}

export function buildContactDrafts(rows, mapping) {
  const fullNameIdx = mapping.fullNameIdx ?? mapping.nameIdx ?? 0;
  const { phoneIdx, emailIdx } = mapping;
  const out = [];
  rows.forEach((row, i) => {
    const arr = Array.isArray(row) ? row : [];
    const name = String(arr[fullNameIdx] ?? '').trim();
    const phone = phoneIdx >= 0 ? String(arr[phoneIdx] ?? '').trim() : '';
    const email = emailIdx >= 0 ? String(arr[emailIdx] ?? '').trim() : '';
    if (!name && !phone && !email) return;
    out.push({
      id: `draft-${i}-${name}-${phone}-${email}`,
      selected: true,
      full_name: name || email || phone || 'Imported contact',
      phone,
      email,
      category: 'church',
      status: 'prospect',
      monthly_amount: 0,
      notes: '',
    });
  });
  return out;
}
