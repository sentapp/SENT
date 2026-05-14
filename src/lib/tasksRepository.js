/**
 * @param {Record<string, unknown>} row
 */
export function mapTaskRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    missionaryId: row.missionary_id,
    contactId: row.contact_id ?? null,
    title: row.title ?? '',
    notes: row.notes ?? '',
    dueDate: row.due_date ?? null,
    isComplete: Boolean(row.is_complete),
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

export async function fetchTasksForMissionary(supabaseClient, missionaryId) {
  if (!supabaseClient || !missionaryId) return [];
  const { data, error } = await supabaseClient
    .from('tasks')
    .select('id, missionary_id, contact_id, title, notes, due_date, is_complete, completed_at, created_at')
    .eq('missionary_id', missionaryId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchTasksForMissionary', error);
    return [];
  }
  return (data || []).map(mapTaskRow);
}

export async function fetchTasksForContact(supabaseClient, missionaryId, contactId) {
  if (!supabaseClient || !missionaryId || !contactId) return [];
  const { data, error } = await supabaseClient
    .from('tasks')
    .select('id, missionary_id, contact_id, title, notes, due_date, is_complete, completed_at, created_at')
    .eq('missionary_id', missionaryId)
    .eq('contact_id', contactId)
    .order('is_complete', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchTasksForContact', error);
    return [];
  }
  return (data || []).map(mapTaskRow);
}

export async function createTask(supabaseClient, { missionaryId, contactId, title, notes, dueDate }) {
  const t = String(title ?? '').trim();
  if (!supabaseClient || !missionaryId || !t) return { ok: false, error: 'Title is required.' };

  const payload = {
    missionary_id: missionaryId,
    contact_id: contactId || null,
    title: t,
    notes: notes != null && String(notes).trim() ? String(notes).trim() : null,
    due_date: dueDate && String(dueDate).trim() ? String(dueDate).trim().slice(0, 10) : null,
  };

  const { data, error } = await supabaseClient.from('tasks').insert(payload).select('*').single();
  if (error) return { ok: false, error: error.message || 'Could not create task.' };
  return { ok: true, task: mapTaskRow(data) };
}

export async function updateTask(supabaseClient, taskId, missionaryId, partial) {
  if (!supabaseClient || !taskId || !missionaryId) return { ok: false, error: 'Missing task.' };
  const patch = {};
  if (partial.title !== undefined) patch.title = String(partial.title ?? '').trim();
  if (partial.notes !== undefined) patch.notes = partial.notes != null ? String(partial.notes) : null;
  if (partial.dueDate !== undefined) patch.due_date = partial.dueDate ? String(partial.dueDate).slice(0, 10) : null;
  if (partial.isComplete !== undefined) {
    patch.is_complete = Boolean(partial.isComplete);
    patch.completed_at = partial.isComplete ? new Date().toISOString() : null;
  }
  if (Object.keys(patch).length === 0) return { ok: true };

  const { data, error } = await supabaseClient
    .from('tasks')
    .update(patch)
    .eq('id', taskId)
    .eq('missionary_id', missionaryId)
    .select('*')
    .single();

  if (error) return { ok: false, error: error.message || 'Could not update task.' };
  return { ok: true, task: mapTaskRow(data) };
}

/**
 * Marks complete and, when `contact_id` is set, appends a communication log (comm_type `note`).
 */
export async function completeTask(supabaseClient, taskId, missionaryId) {
  if (!supabaseClient || !taskId || !missionaryId) return { ok: false, error: 'Missing task.' };

  const { data: task, error: selErr } = await supabaseClient
    .from('tasks')
    .select('id, contact_id, is_complete')
    .eq('id', taskId)
    .eq('missionary_id', missionaryId)
    .maybeSingle();

  if (selErr || !task) return { ok: false, error: selErr?.message || 'Task not found.' };
  if (task.is_complete) return { ok: true };

  const completed_at = new Date().toISOString();
  const { error: upErr } = await supabaseClient
    .from('tasks')
    .update({ is_complete: true, completed_at })
    .eq('id', taskId)
    .eq('missionary_id', missionaryId);

  if (upErr) return { ok: false, error: upErr.message || 'Could not complete task.' };

  if (task.contact_id) {
    const { error: logErr } = await supabaseClient.from('communication_logs').insert({
      missionary_id: missionaryId,
      contact_id: task.contact_id,
      comm_type: 'note',
      notes: 'Task completed',
    });
    if (logErr) console.error('completeTask communication_logs', logErr);
  }

  return { ok: true };
}

export async function uncompleteTask(supabaseClient, taskId, missionaryId) {
  return updateTask(supabaseClient, taskId, missionaryId, { isComplete: false });
}

export async function deleteTask(supabaseClient, taskId, missionaryId) {
  if (!supabaseClient || !taskId || !missionaryId) return { ok: false, error: 'Missing task.' };
  const { error } = await supabaseClient.from('tasks').delete().eq('id', taskId).eq('missionary_id', missionaryId);
  if (error) return { ok: false, error: error.message || 'Could not delete task.' };
  return { ok: true };
}
