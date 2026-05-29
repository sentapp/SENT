import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/** Read-only profile for a missionary (supporter feed header / giving links). */
export function useMissionaryPublicProfile(missionaryId) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!supabase || !missionaryId) {
      setProfile(null);
      setLoading(false);
      return undefined;
    }
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select(
          'full_name, organization, photo_url, accent_color, location_name, latitude, longitude, tax_deductible_url, non_tax_deductible_url, supporter_code',
        )
        .eq('id', missionaryId)
        .maybeSingle();
      if (!cancelled) {
        setProfile(data || null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [missionaryId]);

  return { profile, loading };
}
