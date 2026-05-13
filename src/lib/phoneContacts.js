import { cleanPhone, separatePhoneFromName } from './importCleaners';

function firstString(val) {
  if (val == null) return '';
  if (typeof val === 'string') return val.trim();
  if (Array.isArray(val)) {
    const first = val[0];
    if (typeof first === 'string') return first.trim();
    if (first && typeof first === 'object') {
      if (typeof first.number === 'string') return first.number.trim();
      if (typeof first.address === 'string') return first.address.trim();
      if (first.givenName || first.familyName) {
        return [first.givenName, first.familyName].filter(Boolean).join(' ').trim();
      }
      if (first.name) return String(first.name).trim();
    }
  }
  return '';
}

export function contactPickerEntryToDraft(c, index) {
  const nameFromParts = [c.givenName, c.familyName].filter(Boolean).join(' ').trim();
  const email = firstString(c.email);
  const telRaw = firstString(c.tel) || firstString(c.telephone);
  const nameRaw = firstString(c.name) || nameFromParts || firstString(c.nickname) || '';
  const sep = separatePhoneFromName(nameRaw, telRaw);
  let name = sep.name.trim();
  if (!name && email) name = email.split('@')[0] || '';
  if (!name) name = 'Contact';
  const tel = cleanPhone(telRaw || sep.phone);

  return {
    id: `device-${index}-${name}-${tel}-${email}`,
    selected: true,
    full_name: name,
    phone: tel,
    email,
    category: null,
    status: 'prospect',
    monthly_amount: 0,
    notes: '',
  };
}

export function contactPickerResultsToDrafts(results) {
  return (results || []).map((c, i) => contactPickerEntryToDraft(c, i));
}

export function isContactPickerSupported() {
  return (
    typeof navigator !== 'undefined' &&
    'contacts' in navigator &&
    navigator.contacts &&
    typeof navigator.contacts.select === 'function'
  );
}
