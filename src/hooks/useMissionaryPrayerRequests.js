import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { fetchPrayerRequestsForMissionary } from '../lib/prayerRequestsRepository';

export function useMissionaryPrayerRequests(missionaryId) {
  const [prayerRequests, setPrayerRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!supabase || !missionaryId) {
      setPrayerRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const list = await fetchPrayerRequestsForMissionary(supabase, missionaryId);
    setPrayerRequests(list);
    setLoading(false);
  }, [missionaryId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { prayerRequests, loading, refetch };
}
