import { supabase } from './supabaseClient';

/** SECURITY DEFINER RPC — works even if direct SELECT on missionary row is blocked. */
export async function fetchConnectedMissionaryPublic() {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_connected_missionary_for_supporter');
  if (error) {
    console.warn('get_connected_missionary_for_supporter', error);
    return null;
  }
  const row = typeof data === 'string' ? (() => { try { return JSON.parse(data); } catch { return null; } })() : data;
  if (!row?.id) return null;
  return {
    id: row.id,
    full_name: String(row.full_name ?? ''),
    organization: String(row.organization ?? ''),
    photo_url: String(row.photo_url ?? ''),
    tax_deductible_url: String(row.tax_deductible_url ?? ''),
    non_tax_deductible_url: String(row.non_tax_deductible_url ?? ''),
    accent_color: String(row.accent_color ?? '').trim() || '#2A9A58',
  };
}
