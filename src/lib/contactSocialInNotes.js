/**
 * The `contacts` table has no dedicated social column (see `supabase/migrations/20260520100000_core_schema.sql`).
 * Social handles/URLs are stored as a leading block in `notes`:
 *   Social: <text>
 *   <optional blank line>
 *   <rest of notes>
 */
export function splitSocialFromNotes(raw) {
  const notes = String(raw ?? '');
  const trimmed = notes.trim();
  if (!trimmed) return { social: '', bodyNotes: '' };
  const m = trimmed.match(/^Social:\s*([^\n]*)(?:\n\n([\s\S]*))?$/i);
  if (m) {
    return { social: (m[1] || '').trim(), bodyNotes: (m[2] || '').trim() };
  }
  const firstNl = trimmed.indexOf('\n');
  if (firstNl === -1) {
    if (/^Social:\s*/i.test(trimmed)) {
      return { social: trimmed.replace(/^Social:\s*/i, '').trim(), bodyNotes: '' };
    }
    return { social: '', bodyNotes: trimmed };
  }
  const firstLine = trimmed.slice(0, firstNl);
  const rest = trimmed.slice(firstNl + 1).replace(/^\n+/, '');
  if (/^Social:\s*/i.test(firstLine)) {
    return {
      social: firstLine.replace(/^Social:\s*/i, '').trim(),
      bodyNotes: rest.trim(),
    };
  }
  return { social: '', bodyNotes: trimmed };
}

export function mergeNotesWithSocial(bodyNotes, social) {
  const body = String(bodyNotes ?? '').trim();
  const s = String(social ?? '').trim();
  if (!s) return body;
  return `Social: ${s}${body ? `\n\n${body}` : ''}`;
}

/** Strip persisted social block for read-only UI (list cards, detail). */
export function notesWithoutSocialBlock(raw) {
  return splitSocialFromNotes(raw).bodyNotes;
}
