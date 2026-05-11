import { supabase } from './supabaseClient';

/**
 * Maps UI labels to values stored in Supabase `feedback.type`.
 */
export function feedbackTypeToDb(value) {
  const map = {
    'Bug report': 'bug_report',
    'Feature request': 'feature_request',
    'General feedback': 'general',
  };
  return map[value] || 'general';
}

export function isFeedbackConfigured() {
  return Boolean(supabase);
}

/**
 * Insert into `feedback`: user_id, type, message, created_at
 * Requires Supabase table + RLS policies for your app.
 */
export async function submitFeedback({ typeLabel, message }) {
  if (!supabase) {
    return { ok: false, error: 'Supabase is not configured. Add REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY.' };
  }

  const type = feedbackTypeToDb(typeLabel);
  const trimmed = (message || '').trim();
  if (!trimmed) {
    return { ok: false, error: 'Please enter a message.' };
  }

  let userId = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }

  const row = {
    user_id: userId,
    type,
    message: trimmed,
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('feedback').insert(row);
  if (error) {
    return { ok: false, error: error.message || 'Failed to submit feedback.' };
  }
  return { ok: true };
}
