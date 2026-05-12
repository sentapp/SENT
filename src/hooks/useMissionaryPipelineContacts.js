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
    category: normalizeCategoryFromDb(row.category),
    status: normalizeStatusFromDb(row.status),
    monthlyAmount: row.monthly_amount != null ? Number(row.monthly_amount) : 0,
  };
}

/**
 * Pipeline slice: contacts in asked / contacted / meeting_scheduled (newest first, max 10).
 * Uses the same missionary scope as the main contacts hook.
 */
export function useMissionaryPipelineContacts(authUserId, options = {}) {
  const { authLoading = false, onAfterMutation } = options;
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
      const { data, error } = await supabase
        .from('contacts')
        .select('id, full_name, phone, status, category, monthly_amount, created_at')
        .eq('missionary_id', missionaryId)
        .in('status', ['asked', 'contacted', 'meeting_scheduled'])
        .order('created_at', { ascending: false })
        .limit(10);
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
  }, [authUserId]);

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

  return {
    pipelineContacts: contacts,
    pipelineLoading: loading,
    refetchPipeline: fetchPipeline,
    updatePipelineContactStatus,
  };
}
