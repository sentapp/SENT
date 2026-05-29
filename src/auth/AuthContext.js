import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { repairSupporterMissionaryLink } from '../lib/supporterConnection';
import { applyAccentColor, clearAccentColor } from '../lib/applyAccentTheme';
import { isAdminRole } from '../lib/roles';

const AuthContext = createContext(null);

async function fetchProfileRow(userId) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) {
    console.error('fetchProfileRow', error);
    return null;
  }
  return data;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  /**
   * @param {string} userId
   * @param {{ silent?: boolean }} [options] - When true, do not toggle global `loading` (avoids full-layout flashes on refresh).
   */
  const loadProfile = useCallback(async (userId, options = {}) => {
    const silent = Boolean(options.silent);
    if (!userId) {
      setProfile(null);
      clearAccentColor();
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      let row = await fetchProfileRow(userId);
      if (row?.role === 'supporter') {
        const repair = await repairSupporterMissionaryLink(userId);
        if (repair.ok && repair.missionary) {
          row = (await fetchProfileRow(userId)) ?? row;
        }
      }
      setProfile(row);
      if (row?.role === 'missionary') {
        applyAccentColor(row.accent_color);
      } else {
        clearAccentColor();
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(data.session ?? null);
      if (data.session?.user?.id) {
        await loadProfile(data.session.user.id);
      } else {
        setProfile(null);
        clearAccentColor();
        setLoading(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession ?? null);
      if (nextSession?.user?.id) {
        // Avoid re-showing full-page loading on token refresh / duplicate init (prevents layout blink).
        const silent = event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION';
        void loadProfile(nextSession.user.id, { silent });
      } else {
        setProfile(null);
        clearAccentColor();
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    clearAccentColor();
  }, []);

  const refreshProfile = useCallback(async () => {
    const uid = session?.user?.id;
    if (uid) await loadProfile(uid, { silent: true });
  }, [session?.user?.id, loadProfile]);

  const role = profile?.role ?? null;

  const value = useMemo(
    () => ({
      supabaseReady: Boolean(supabase),
      session,
      user: session?.user ?? null,
      profile,
      role,
      isAdmin: isAdminRole(role),
      loading,
      signOut,
      refreshProfile,
    }),
    [session, profile, role, loading, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
