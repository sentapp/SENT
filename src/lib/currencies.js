/** Supported contact / profile currencies (ISO 4217 codes). */
export const CURRENCIES = [
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'CAD', label: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { code: 'NZD', label: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'KES', label: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'ZAR', label: 'South African Rand', symbol: 'R' },
  { code: 'NGN', label: 'Nigerian Naira', symbol: '₦' },
  { code: 'BRL', label: 'Brazilian Real', symbol: 'R$' },
  { code: 'MXN', label: 'Mexican Peso', symbol: 'MX$' },
  { code: 'INR', label: 'Indian Rupee', symbol: '₹' },
];

const CODE_SET = new Set(CURRENCIES.map((c) => c.code));

/** Normalize null/empty/unknown to USD for comparisons and defaults. */
export function normalizeCurrencyCode(code) {
  const c = String(code ?? '')
    .trim()
    .toUpperCase();
  if (!c || !CODE_SET.has(c)) return 'USD';
  return c;
}

export function getCurrencySymbol(code) {
  const c = normalizeCurrencyCode(code);
  return CURRENCIES.find((x) => x.code === c)?.symbol ?? c;
}

export function getCurrencyMeta(code) {
  const c = normalizeCurrencyCode(code);
  return CURRENCIES.find((x) => x.code === c) ?? CURRENCIES[0];
}

/** Display amount with symbol; em dash when amount is empty/zero-ish per "no amount". */
export function formatAmount(amount, currencyCode) {
  const n = Number(amount);
  if (amount == null || amount === '' || !Number.isFinite(n) || n === 0) return '—';
  const sym = getCurrencySymbol(currencyCode);
  return `${sym}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function formatMonthlyAmount(amount, currencyCode) {
  const n = Number(amount);
  const code = normalizeCurrencyCode(currencyCode);
  if (!Number.isFinite(n) || n <= 0) {
    return `${getCurrencySymbol(code)}0/mo`;
  }
  return `${formatAmount(n, code)}/mo`;
}

/** Parse spreadsheet / import cell to a supported code, or null if not recognized. */
/** Sum monthly amounts in home currency; group other currencies for partners with monthly &gt; 0. */
export function computePartnerCurrencyTotals(partners, homeCurrency) {
  const home = normalizeCurrencyCode(homeCurrency);
  let homeCurrencyTotal = 0;
  const otherMap = new Map();
  for (const p of partners || []) {
    const amt = Number(p.monthlyAmount);
    if (!Number.isFinite(amt) || amt <= 0) continue;
    const cur = normalizeCurrencyCode(p.currency);
    if (cur === home) homeCurrencyTotal += amt;
    else otherMap.set(cur, (otherMap.get(cur) || 0) + amt);
  }
  const otherCurrencies = [...otherMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([code, total]) => ({ code, total }));
  return { homeCurrencyTotal, otherCurrencies };
}

/** Muted dashboard line, e.g. "+ £50 GBP · €100 EUR". */
export function formatOtherCurrenciesLine(otherCurrencies) {
  if (!otherCurrencies?.length) return '';
  return otherCurrencies
    .map(({ code, total }) => `+ ${formatAmount(total, code)} ${code}`)
    .join(' · ');
}

export function parseCurrencyFromCell(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const upper = s.toUpperCase().replace(/\s+/g, '');
  if (CODE_SET.has(upper)) return upper;
  const bySymbol = CURRENCIES.find((c) => c.symbol.toUpperCase() === upper || c.symbol === s);
  if (bySymbol) return bySymbol.code;
  const byLabel = CURRENCIES.find((c) => c.label.toLowerCase() === s.toLowerCase());
  if (byLabel) return byLabel.code;
  return null;
}
