import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { normalizeCategoryForSave, normalizeCategoryFromDb } from '../lib/contactCategories';
import { normalizeStatusForSave, normalizeStatusFromDb } from '../lib/contactStatuses';

const CONTACT_SELECT =
  'id, missionary_id, full_name, phone, email, address, category, status, monthly_amount, notes, created_at, updated_at';

/**
 * Privacy: contacts are **never** loaded without scoping to the signed-in missionary.
 * - Every read uses `.eq('missionary_id', resolveMissionaryId())` (never fetch all rows).
 * - Every insert/update row includes `missionary_id` from `auth.getUser().id`.
 * - Supabase RLS policy `Missionaries can only see own contacts` must match `missionary_id = auth.uid()`.
 */
async function resolveMissionaryId(client) {
  if (!client) return null;
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user?.id) return null;
  return user.id;
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name || '',
    phone: row.phone || '',
    email: row.email || '',
    address: row.address || '',
    category: normalizeCategoryFromDb(row.category),
    status: normalizeStatusFromDb(row.status),
    monthlyAmount: row.monthly_amount != null ? Number(row.monthly_amount) : 0,
    notes: row.notes || '',
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

/** Maps UI / mixed payloads to Supabase `contacts` row shape (snake_case DB columns only). */
function toRow(payload, missionaryId) {
  const fullName = String(payload.fullName ?? payload.full_name ?? payload.name ?? '').trim();
  const monthly =
    payload.monthlyAmount !== undefined
      ? payload.monthlyAmount
      : payload.monthly_amount !== undefined
        ? payload.monthly_amount
        : 0;

  const category = normalizeCategoryForSave(payload.category || 'supporter');
  const statusPick = payload.status ?? payload.contact_status;
  const status =
    statusPick !== undefined && statusPick !== null && String(statusPick).trim() !== ''
      ? normalizeStatusForSave(statusPick)
      : 'prospect';
  const monthlyNum = Number.isFinite(Number(monthly)) ? Number(monthly) : 0;
  const monthly_amount = status === 'partner' ? monthlyNum : 0;

  return {
    missionary_id: missionaryId,
    full_name: fullName,
    phone: String(payload.phone ?? '').trim(),
    email: String(payload.email ?? '').trim(),
    category,
    status,
    monthly_amount,
    notes: String(payload.notes ?? '').trim(),
    address: String(payload.address ?? '').trim(),
  };
}

/**
 * Loads contacts for the signed-in missionary. Uses `supabase.auth.getUser()` for reads/writes (missionary_id).
 * Pass `authUserId` (e.g. `user?.id` from `useAuth`) so the list refetches when the session appears or changes.
 */
export function useSupabaseContacts(authUserId) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    if (!supabase) {
      setContacts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const missionaryId = await resolveMissionaryId(supabase);
    if (!missionaryId) {
      setContacts([]);
      setLoading(false);
      return;
    }
    const { data, error: qErr } = await supabase
      .from('contacts')
      .select(CONTACT_SELECT)
      .eq('missionary_id', missionaryId)
      .order('created_at', { ascending: false });

    if (qErr) {
      setError(qErr.message);
      setContacts([]);
    } else {
      setContacts((data || []).map(mapRow));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch, authUserId]);

  const insertContact = useCallback(
    async (payload) => {
      if (!supabase) return { ok: false, error: 'Not signed in.' };
      const missionaryId = await resolveMissionaryId(supabase);
      if (!missionaryId) return { ok: false, error: 'Not signed in.' };
      const row = toRow(payload, missionaryId);
      const { error: insErr } = await supabase.from('contacts').insert(row);
      if (insErr) return { ok: false, error: insErr.message };
      await refetch();
      return { ok: true };
    },
    [refetch],
  );

  const updateContact = useCallback(
    async (id, payload) => {
      if (!supabase || !id) return { ok: false, error: 'Missing id.' };
      const missionaryId = await resolveMissionaryId(supabase);
      if (!missionaryId) return { ok: false, error: 'Not signed in.' };
      const row = toRow(payload, missionaryId);
      delete row.missionary_id;
      const { error: upErr } = await supabase.from('contacts').update(row).eq('id', id).eq('missionary_id', missionaryId);
      if (upErr) return { ok: false, error: upErr.message };
      await refetch();
      return { ok: true };
    },
    [refetch],
  );

  const deleteContact = useCallback(
    async (id) => {
      if (!supabase || !id) return { ok: false, error: 'Missing id.' };
      const missionaryId = await resolveMissionaryId(supabase);
      if (!missionaryId) return { ok: false, error: 'Not signed in.' };
      const { error: delErr } = await supabase.from('contacts').delete().eq('id', id).eq('missionary_id', missionaryId);
      if (delErr) return { ok: false, error: delErr.message };
      await refetch();
      return { ok: true };
    },
    [refetch],
  );

  const removeContactsByIds = useCallback((ids) => {
    if (!ids?.length) return;
    const idSet = new Set(ids);
    setContacts((prev) => prev.filter((c) => !idSet.has(c.id)));
  }, []);

  return {
    contacts,
    loading,
    error,
    refetch,
    insertContact,
    updateContact,
    deleteContact,
    removeContactsByIds,
  };
}
