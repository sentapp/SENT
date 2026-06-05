import { createTask } from './tasksRepository';

/**
 * @param {Record<string, unknown>} row
 */
export function mapMeetingRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    missionaryId: row.missionary_id,
    contactId: row.contact_id ?? null,
    contactName: row.contact_name ?? '',
    meetingDate: row.meeting_date ?? null,
    meetingTime: row.meeting_time ?? null,
    meetingType: row.meeting_type ?? 'initial',
    outcome: row.outcome ?? null,
    notes: row.notes ?? '',
    isComplete: Boolean(row.is_complete),
    createdAt: row.created_at ?? null,
  };
}

export async function fetchMeetingsForMissionary(supabaseClient, missionaryId) {
  if (!supabaseClient || !missionaryId) return [];
  const { data, error } = await supabaseClient
    .from('meetings')
    .select('*')
    .eq('missionary_id', missionaryId)
    .order('meeting_date', { ascending: false })
    .order('meeting_time', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('fetchMeetingsForMissionary', error);
    return [];
  }
  return (data || []).map(mapMeetingRow);
}

export async function createMeeting(supabaseClient, payload) {
  const {
    missionaryId,
    contactId,
    contactName,
    meetingDate,
    meetingTime,
    meetingType,
    notes,
  } = payload;

  if (!supabaseClient || !missionaryId || !meetingDate) {
    return { ok: false, error: 'Date is required.' };
  }

  const row = {
    missionary_id: missionaryId,
    contact_id: contactId || null,
    contact_name: String(contactName ?? '').trim() || 'Meeting',
    meeting_date: String(meetingDate).slice(0, 10),
    meeting_time: meetingTime && String(meetingTime).trim() ? String(meetingTime).trim() : null,
    meeting_type: meetingType === 'followup' ? 'followup' : 'initial',
    notes: notes != null && String(notes).trim() ? String(notes).trim() : null,
    is_complete: false,
  };

  const { data, error } = await supabaseClient.from('meetings').insert(row).select('*').single();
  if (error) return { ok: false, error: error.message || 'Could not create meeting.' };
  return { ok: true, meeting: mapMeetingRow(data) };
}

export async function updateMeeting(supabaseClient, id, payload) {
  const {
    contactId,
    contactName,
    meetingDate,
    meetingTime,
    meetingType,
    notes,
  } = payload;

  const row = {};
  if (contactId !== undefined) row.contact_id = contactId || null;
  if (contactName !== undefined) row.contact_name = String(contactName ?? '').trim() || 'Meeting';
  if (meetingDate !== undefined) row.meeting_date = String(meetingDate).slice(0, 10);
  if (meetingTime !== undefined) {
    row.meeting_time = meetingTime && String(meetingTime).trim() ? String(meetingTime).trim() : null;
  }
  if (meetingType !== undefined) row.meeting_type = meetingType === 'followup' ? 'followup' : 'initial';
  if (notes !== undefined) row.notes = notes != null && String(notes).trim() ? String(notes).trim() : null;

  const { error } = await supabaseClient.from('meetings').update(row).eq('id', id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 * @param {{
 *   meetingId: string,
 *   missionaryId: string,
 *   contactId: string | null,
 *   contactName: string,
 *   outcome: 'yes' | 'no' | 'followup' | 'not_right_now',
 *   notes?: string,
 * }} params
 */
export async function saveMeetingOutcome(supabaseClient, params) {
  const { meetingId, missionaryId, contactId, contactName, outcome, notes = '' } = params;
  if (!supabaseClient || !meetingId || !missionaryId) {
    return { ok: false, error: 'Missing meeting.' };
  }
  if (!outcome) return { ok: false, error: 'Select an outcome.' };

  const notesStr = String(notes ?? '').trim();
  const { error: meetErr } = await supabaseClient
    .from('meetings')
    .update({ outcome, notes: notesStr || null, is_complete: true })
    .eq('id', meetingId)
    .eq('missionary_id', missionaryId);

  if (meetErr) return { ok: false, error: meetErr.message || 'Could not save meeting.' };

  if (contactId) {
    if (outcome === 'yes') {
      const { error: contactErr } = await supabaseClient
        .from('contacts')
        .update({ status: 'partner', category: 'supporter' })
        .eq('id', contactId)
        .eq('missionary_id', missionaryId);
      if (contactErr) console.error('saveMeetingOutcome contact yes', contactErr);
    } else if (outcome === 'no') {
      const { error: contactErr } = await supabaseClient
        .from('contacts')
        .update({ status: 'declined' })
        .eq('id', contactId)
        .eq('missionary_id', missionaryId);
      if (contactErr) console.error('saveMeetingOutcome contact no', contactErr);
    } else if (outcome === 'not_right_now') {
      const followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + 90);
      const dueDate = followUpDate.toISOString().split('T')[0];
      const { error: contactErr } = await supabaseClient
        .from('contacts')
        .update({ status: 'not_right_now', follow_up_date: dueDate })
        .eq('id', contactId)
        .eq('missionary_id', missionaryId);
      if (contactErr) console.error('saveMeetingOutcome contact not_right_now', contactErr);
    }

    const logNotes =
      outcome === 'yes'
        ? `Said yes to partnering!${notesStr ? ` ${notesStr}` : ''}`
        : notesStr ||
          (outcome === 'followup'
            ? 'Follow-up meeting'
            : outcome === 'not_right_now'
              ? 'Not right now — follow up later'
              : 'Meeting — not yet');

    const { error: logErr } = await supabaseClient.from('communication_logs').insert({
      missionary_id: missionaryId,
      contact_id: contactId,
      comm_type: 'meeting',
      notes: logNotes,
    });
    if (logErr) console.error('saveMeetingOutcome communication_logs', logErr);

    if (outcome === 'followup') {
      const followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + 7);
      const dueDate = followUpDate.toISOString().split('T')[0];
      const title = `Follow up with ${contactName || 'contact'}`;
      const taskRes = await createTask(supabaseClient, {
        missionaryId,
        contactId,
        title,
        notes: notesStr || null,
        dueDate,
      });
      if (!taskRes.ok) console.error('saveMeetingOutcome followup task', taskRes.error);
    }
  }

  return { ok: true };
}

export async function deleteMeeting(supabaseClient, { meetingId, missionaryId }) {
  if (!supabaseClient || !meetingId || !missionaryId) {
    return { ok: false, error: 'Missing meeting.' };
  }
  const { error } = await supabaseClient
    .from('meetings')
    .delete()
    .eq('id', meetingId)
    .eq('missionary_id', missionaryId);
  if (error) return { ok: false, error: error.message || 'Could not delete meeting.' };
  return { ok: true };
}
