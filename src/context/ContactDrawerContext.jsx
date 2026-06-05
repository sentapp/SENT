import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { mapTaskRow } from '../lib/tasksRepository';

const ContactDrawerContext = createContext(null);

export function ContactDrawerProvider({ children }) {
  const { user } = useAuth();
  const [openContact, setOpenContact] = useState(null);
  const [logs, setLogs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [activityLogsRefreshKey, setActivityLogsRefreshKey] = useState(0);
  const [contactListDataKey, setContactListDataKey] = useState(0);
  const contactPatchListenersRef = useRef(new Set());

  const subscribeContactPatch = useCallback((listener) => {
    contactPatchListenersRef.current.add(listener);
    return () => {
      contactPatchListenersRef.current.delete(listener);
    };
  }, []);

  const broadcastContactPatch = useCallback((id, partial) => {
    if (id == null || partial == null) return;
    for (const listener of contactPatchListenersRef.current) {
      listener(id, partial);
    }
  }, []);

  const openDrawer = useCallback((contact) => {
    if (!contact) return;
    setOpenContact(contact);
  }, []);

  const closeDrawer = useCallback(() => {
    setOpenContact(null);
  }, []);

  const patchOpenContact = useCallback((next) => {
    setOpenContact((prev) =>
      prev && next && String(prev.id) === String(next.id) ? { ...prev, ...next } : prev,
    );
  }, []);

  const refreshLogsAndTasks = useCallback(() => {
    setActivityLogsRefreshKey((k) => k + 1);
  }, []);

  const bumpContactListData = useCallback(() => {
    setContactListDataKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!supabase || !openContact?.id || !user?.id) {
      setLogs([]);
      setTasks([]);
      setLogsLoading(false);
      setTasksLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLogsLoading(true);
    setTasksLoading(true);

    void (async () => {
      const [logsRes, tasksRes] = await Promise.all([
        supabase
          .from('communication_logs')
          .select('*')
          .eq('contact_id', openContact.id)
          .eq('missionary_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('tasks')
          .select('*')
          .eq('contact_id', openContact.id)
          .eq('missionary_id', user.id)
          .eq('is_complete', false)
          .order('due_date', { ascending: true }),
      ]);

      if (cancelled) return;

      setLogsLoading(false);
      setTasksLoading(false);

      if (logsRes.error) {
        console.error('ContactDrawerContext communication_logs', logsRes.error);
        setLogs([]);
      } else {
        setLogs(logsRes.data || []);
      }

      if (tasksRes.error) {
        console.error('ContactDrawerContext tasks', tasksRes.error);
        setTasks([]);
      } else {
        setTasks((tasksRes.data || []).map(mapTaskRow));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [openContact?.id, user?.id, activityLogsRefreshKey]);

  const value = useMemo(
    () => ({
      openContact,
      openDrawer,
      closeDrawer,
      patchOpenContact,
      logs,
      setLogs,
      tasks,
      setTasks,
      logsLoading,
      tasksLoading,
      activityLogsRefreshKey,
      refreshLogsAndTasks,
      contactListDataKey,
      bumpContactListData,
      subscribeContactPatch,
      broadcastContactPatch,
    }),
    [
      openContact,
      openDrawer,
      closeDrawer,
      patchOpenContact,
      logs,
      tasks,
      logsLoading,
      tasksLoading,
      activityLogsRefreshKey,
      refreshLogsAndTasks,
      contactListDataKey,
      bumpContactListData,
      subscribeContactPatch,
      broadcastContactPatch,
    ],
  );

  return <ContactDrawerContext.Provider value={value}>{children}</ContactDrawerContext.Provider>;
}

export function useContactDrawer() {
  const ctx = useContext(ContactDrawerContext);
  if (!ctx) {
    throw new Error('useContactDrawer must be used within ContactDrawerProvider');
  }
  return ctx;
}
