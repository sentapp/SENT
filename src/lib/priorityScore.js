import { normalizeStatusFromDb } from './contactStatuses';

const CARE_LETTERS = ['C', 'A', 'R', 'E'];
const ASKED_STATUSES = new Set(['meeting_scheduled', 'committed', 'partner']);

/**
 * @param {Record<string, unknown>} contact
 * @param {Array<{ created_at?: string }>} [logs]
 * @returns {{ C: boolean, A: boolean, R: boolean, E: boolean }}
 */
export function calcCareFlags(contact, logs = []) {
  const rel = contact?.relationship;
  const hasRelationship = rel != null && String(rel).trim() !== '';

  const status = normalizeStatusFromDb(contact?.status);
  const asked = ASKED_STATUSES.has(status);

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const responsive = logs.some((l) => new Date(l.created_at).getTime() > thirtyDaysAgo);

  const engaged = logs.length >= 2;

  return { C: hasRelationship, A: asked, R: responsive, E: engaged };
}

/**
 * @param {Record<string, unknown>} contact
 * @param {Array<{ created_at?: string }>} [logs]
 * @returns {number} 0–4
 */
export function calcPriorityScore(contact, logs = []) {
  const flags = calcCareFlags(contact, logs);
  return (flags.C ? 1 : 0) + (flags.A ? 1 : 0) + (flags.R ? 1 : 0) + (flags.E ? 1 : 0);
}

/**
 * @param {number} score
 */
export function getPriorityStyle(score) {
  if (score >= 3) return { bg: 'var(--accent-light)', color: 'var(--accent-dark)', dot: 'var(--accent)', label: 'Warm' };
  if (score >= 1) return { bg: '#FFF8E8', color: '#906010', dot: '#D4A017', label: 'Lukewarm' };
  return { bg: '#F5F5F5', color: '#888888', dot: '#CCCCCC', label: 'Cold' };
}

/** Inline style for the 7px priority dot on contact rows. */
export function getPriorityDot(score) {
  const { dot } = getPriorityStyle(score);
  return {
    width: 7,
    height: 7,
    borderRadius: '50%',
    backgroundColor: dot,
    flexShrink: 0,
  };
}

export { CARE_LETTERS };
