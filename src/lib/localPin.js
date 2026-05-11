/** Device-local PIN shortcut (not sent to Supabase). */

export function pinStorageKey(userId) {
  return `sent_pin_${userId}`;
}

export function saveLocalPin(userId, pin) {
  if (!userId || typeof pin !== 'string') return;
  localStorage.setItem(pinStorageKey(userId), btoa(pin));
}

export function verifyLocalPin(userId, enteredPin) {
  const saved = localStorage.getItem(pinStorageKey(userId));
  return saved === btoa(enteredPin);
}

export function removeLocalPin(userId) {
  localStorage.removeItem(pinStorageKey(userId));
}

export function hasLocalPin(userId) {
  if (!userId) return false;
  return Boolean(localStorage.getItem(pinStorageKey(userId)));
}
