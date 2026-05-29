import { useCallback, useEffect, useState } from 'react';
import { fetchMeetingRequestsForMissionary } from '../lib/meetingRequestsRepository';
import { supabase } from '../lib/supabaseClient';

/** Pending meeting_requests count for missionary nav badge + banners. */
export function usePendingMeetingRequestsCount(missionaryId) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!supabase || !missionaryId) {
      setPending([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const rows = await fetchMeetingRequestsForMissionary(supabase, missionaryId, { status: 'pending' });
    setPending(rows);
    setLoading(false);
  }, [missionaryId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { pending, count: pending.length, loading, refetch };
}
