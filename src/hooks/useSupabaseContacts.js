import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { normalizeCategoryForSave, normalizeCategoryFromDb } from '../lib/contactCategories';
import { normalizeStatusForSave, normalizeStatusFromDb } from '../lib/contactStatuses';

/** Columns present in the original schema — safe before optional migrations. */
const CONTACT_SELECT_MINIMAL =
  'id, missionary_id, full_name, phone, email, category, status, monthly_amount, notes, created_at, updated_at';

/** Optional CRM columns — only used when they exist in the database. */
const CONTACT_SELECT_OPTIONAL_SUFFIX =
  'address, is_one_time_donor, one_time_donation_amount, one_time_donation_date';

const CONTACT_SELECT_FULL = `${CONTACT_SELECT_MINIMAL}, ${CONTACT_SELECT_OPTIONAL_SUFFIX}`;

function isMissingColumnError(err) {
  if (!err) return false;
  const code = String(err.code ?? '');
  const msg = String(err.message ?? '').toLowerCase();
  if (code === '42703') return true;
  if (msg.includes('column') && msg.includes('does not exist')) return true;
  if (msg.includes('undefined column')) return true;
  return false;
}

function friendlyContactsFetchError(err) {
  const raw = String(err?.message ?? err ?? 'Unknown error');
  if (isMissingColumnError(err)) {
    return `${raw} If you recently added columns, run the latest Supabase migrations for the contacts table.`;
  }
  return raw;
}

/** Omit optional CRM columns when the database has not been migrated yet (avoids insert/update errors). */
export function stripOptionalContactColumnsFromRow(row, schemaPartial) {
  if (!schemaPartial || !row || typeof row !== 'object') return row;
  const out = { ...row };
  delete out.address;
  delete out.is_one_time_donor;
  delete out.one_time_donation_amount;
  delete out.one_time_donation_date;
  return out;
}

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
    address: row.address != null ? String(row.address) : '',
    category: normalizeCategoryFromDb(row.category),
    status: normalizeStatusFromDb(row.status),
    monthlyAmount: row.monthly_amount != null ? Number(row.monthly_amount) : 0,
    isOneTimeDonor: Boolean(row.is_one_time_donor),
    oneTimeDonationAmount:
      row.one_time_donation_amount != null ? Number(row.one_time_donation_amount) : 0,
    oneTimeDonationDate: row.one_time_donation_date
      ? String(row.one_time_donation_date).slice(0, 10)
      : '',
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
    ...(() => {
      const isDonor = Boolean(payload.isOneTimeDonor ?? payload.is_one_time_donor);
      const amtRaw = payload.oneTimeDonationAmount ?? payload.one_time_donation_amount;
      const amtNum = Number.isFinite(Number(amtRaw)) ? Number(amtRaw) : 0;
      const dateRaw = payload.oneTimeDonationDate ?? payload.one_time_donation_date;
      const dateStr =
        isDonor && dateRaw != null && String(dateRaw).trim() !== ''
          ? String(dateRaw).slice(0, 10)
          : null;
      return {
        is_one_time_donor: isDonor,
        one_time_donation_amount: isDonor ? amtNum : 0,
        one_time_donation_date: isDonor ? dateStr : null,
      };
    })(),
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
  /** True when optional columns were omitted because they are not in the DB yet. */
  const [schemaPartial, setSchemaPartial] = useState(false);

  const refetch = useCallback(async () => {
    if (!supabase) {
      setContacts([]);
      setLoading(false);
      setSchemaPartial(false);
      return;
    }
    setLoading(true);
    setError(null);
    setSchemaPartial(false);

    try {
      const missionaryId = await resolveMissionaryId(supabase);
      if (!missionaryId) {
        setContacts([]);
        setLoading(false);
        return;
      }

      let q = await supabase
        .from('contacts')
        .select(CONTACT_SELECT_FULL)
        .eq('missionary_id', missionaryId)
        .order('created_at', { ascending: false });

      if (q.error && isMissingColumnError(q.error)) {
        setSchemaPartial(true);
        q = await supabase
          .from('contacts')
          .select(CONTACT_SELECT_MINIMAL)
          .eq('missionary_id', missionaryId)
          .order('created_at', { ascending: false });
      }

      if (q.error) {
        setError(friendlyContactsFetchError(q.error));
        setContacts([]);
      } else {
        setContacts((q.data || []).map(mapRow));
      }
    } catch (e) {
      setError(friendlyContactsFetchError(e));
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch, authUserId]);

  const insertContact = useCallback(
    async (payload) => {
      if (!supabase) return { ok: false, error: 'Not signed in.' };
      const missionaryId = await resolveMissionaryId(supabase);
      if (!missionaryId) return { ok: false, error: 'Not signed in.' };
      const row = stripOptionalContactColumnsFromRow(toRow(payload, missionaryId), schemaPartial);
      const { error: insErr } = await supabase.from('contacts').insert(row);
      if (insErr) return { ok: false, error: insErr.message };
      await refetch();
      return { ok: true };
    },
    [refetch, schemaPartial],
  );

  const updateContact = useCallback(
    async (id, payload) => {
      if (!supabase || !id) return { ok: false, error: 'Missing id.' };
      const missionaryId = await resolveMissionaryId(supabase);
      if (!missionaryId) return { ok: false, error: 'Not signed in.' };
      const row = toRow(payload, missionaryId);
      delete row.missionary_id;
      const safeRow = stripOptionalContactColumnsFromRow(row, schemaPartial);
      const { error: upErr } = await supabase
        .from('contacts')
        .update(safeRow)
        .eq('id', id)
        .eq('missionary_id', missionaryId);
      if (upErr) return { ok: false, error: upErr.message };
      await refetch();
      return { ok: true };
    },
    [refetch, schemaPartial],
  );

  const deleteContact = useCallback(
    async (id) => {
      if (!supabase || !id) return { ok: false, error: 'Missing id.' };
      const missionaryId = await resolveMissionaryId(supabase);
      if (!missionaryId) return { ok: false, error: 'Not signed in.' };
      // Safety: never delete without scoping to the signed-in missionary's CRM rows.
      const { error: delErr } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id)
        .eq('missionary_id', missionaryId);
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
    schemaPartial,
    refetch,
    insertContact,
    updateContact,
    deleteContact,
    removeContactsByIds,
  };
}
