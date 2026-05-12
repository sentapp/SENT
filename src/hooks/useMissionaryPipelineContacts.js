import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { normalizeStatusForSave, normalizeStatusFromDb } from '../lib/contactStatuses';
import { normalizeCategoryFromDb } from '../lib/contactCategories';

async function resolveMissionaryId(client, preferredIdFromReact = null) {
  if (!client) return null;
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  let uid = !error && user?.id ? user.id : null;
  if (!uid) {
    const {
      data: { session },
    } = await client.auth.getSession();
    uid = session?.user?.id ?? null;
  }
  if (preferredIdFromReact && uid && preferredIdFromReact !== uid) {
    return null;
  }
  return uid ?? preferredIdFromReact ?? null;
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name || '',
    phone: row.phone || '',
    email: row.email || '',
    category: normalizeCategoryFromDb(row.category),
    status: normalizeStatusFromDb(row.status),
    monthlyAmount: row.monthly_amount != null ? Number(row.monthly_amount) : 0,
    notes: row.notes != null ? String(row.notes) : '',
  };
}

/** Statuses shown on Pipeline board + Overview pipeline (Supabase `.in()` filter). */
export const MISSIONARY_PIPELINE_TRACKED_STATUSES = ['contacted', 'asked', 'meeting_scheduled', 'committed'];

/** Advance pipeline stage; final step from the board moves a contact to Partner. */
export const PIPELINE_NEXT_STATUS = {
  contacted: 'asked',
  asked: 'meeting_scheduled',
  meeting_scheduled: 'committed',
  committed: 'partner',
};

/**
 * Pipeline contacts for Overview (`variant: 'overview'`) or full Pipeline page (`variant: 'board'`).
 * Uses the same missionary scope as the main contacts hook.
 */
export function useMissionaryPipelineContacts(authUserId, options = {}) {
  const { authLoading = false, onAfterMutation, variant = 'overview' } = options;
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPipeline = useCallback(async () => {
    if (!supabase) {
      setContacts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const missionaryId = await resolveMissionaryId(supabase, authUserId);
      if (!missionaryId) {
        setContacts([]);
        return;
      }
      let q = supabase
        .from('contacts')
        .select('id, full_name, phone, email, status, category, monthly_amount, notes, created_at')
        .eq('missionary_id', missionaryId)
        .in('status', MISSIONARY_PIPELINE_TRACKED_STATUSES);
      if (variant === 'board') {
        q = q.order('full_name', { ascending: true });
      } else {
        q = q.order('created_at', { ascending: false }).limit(10);
      }
      const { data, error } = await q;
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[pipeline] Fetch failed:', error);
        setContacts([]);
        return;
      }
      setContacts((data || []).map(mapRow));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[pipeline] Fetch exception:', e);
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [authUserId, variant]);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }
    if (!authUserId) {
      setContacts([]);
      setLoading(false);
      return;
    }
    void fetchPipeline();
  }, [authUserId, authLoading, fetchPipeline]);

  const updatePipelineContactStatus = useCallback(
    async (id, status) => {
      if (!supabase || !id) return { ok: false, error: 'Not available.' };
      const missionaryId = await resolveMissionaryId(supabase, authUserId);
      if (!missionaryId) return { ok: false, error: 'Not signed in.' };
      const { error } = await supabase
        .from('contacts')
        .update({ status: normalizeStatusForSave(status) })
        .eq('id', id)
        .eq('missionary_id', missionaryId);
      if (error) return { ok: false, error: error.message };
      await fetchPipeline();
      onAfterMutation?.();
      return { ok: true };
    },
    [authUserId, fetchPipeline, onAfterMutation],
  );

  const moveForward = useCallback(
    async (contactId, currentStatus) => {
      const normalized = normalizeStatusFromDb(currentStatus);
      const next = PIPELINE_NEXT_STATUS[normalized];
      if (!next || !contactId) return { ok: false, error: 'Nothing to advance.' };
      return updatePipelineContactStatus(contactId, next);
    },
    [updatePipelineContactStatus],
  );

  return {
    pipelineContacts: contacts,
    pipelineLoading: loading,
    refetchPipeline: fetchPipeline,
    updatePipelineContactStatus,
    moveForward,
  };
}
