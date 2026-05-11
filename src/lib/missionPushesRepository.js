import { supabase } from './supabaseClient';

export async function fetchMissionPushesForMissionary(missionaryId) {
  if (!supabase || !missionaryId) return { data: [], error: null };
  return supabase
    .from('mission_pushes')
    .select('*')
    .eq('missionary_id', missionaryId)
    .order('created_at', { ascending: false });
}

export async function fetchActiveMissionPushForMissionary(missionaryId) {
  if (!supabase || !missionaryId) return { data: null, error: null };
  return supabase
    .from('mission_pushes')
    .select('*')
    .eq('missionary_id', missionaryId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function insertMissionPush(row) {
  if (!supabase) return { data: null, error: new Error('No client') };
  return supabase.from('mission_pushes').insert(row).select().single();
}

export async function updateMissionPush(id, patch) {
  if (!supabase || !id) return { data: null, error: new Error('Missing id') };
  return supabase.from('mission_pushes').update(patch).eq('id', id).select().single();
}

/** Deactivate other pushes for this missionary so only one stays active (optional). */
export async function deactivateOtherMissionPushes(missionaryId, exceptId) {
  if (!supabase || !missionaryId) return { error: null };
  let q = supabase.from('mission_pushes').update({ is_active: false }).eq('missionary_id', missionaryId).eq('is_active', true);
  if (exceptId) q = q.neq('id', exceptId);
  return q;
}
