import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useContactDrawer } from '../../context/ContactDrawerContext';
import { useSupabaseContacts } from '../../hooks/useSupabaseContacts';
import { supabase } from '../../lib/supabaseClient';
import { phoneDigits } from '../../lib/phoneFormat';
import { ContactSideDrawer } from './ContactSideDrawer';
import { ContactQuickLogPopup } from './ContactQuickViewPopup';
import {
  DRAWER_STACK_QUICK_LOG_BACKDROP_Z,
  DRAWER_STACK_QUICK_LOG_MODAL_Z,
} from './quickViewOverlayZIndex';

export default function GlobalContactDrawer() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const {
    openContact,
    closeDrawer,
    patchOpenContact,
    logs,
    tasks,
    logsLoading,
    tasksLoading,
    refreshLogsAndTasks,
    activityLogsRefreshKey,
    bumpContactListData,
  } = useContactDrawer();

  const { contacts, refetch, saveQuickTag, patchContactInList } = useSupabaseContacts(user?.id, {
    authLoading,
  });

  const [showLogModal, setShowLogModal] = useState(false);
  const [logType, setLogType] = useState('call');
  const [logText, setLogText] = useState('');
  const [logSaving, setLogSaving] = useState(false);
  const [logError, setLogError] = useState('');
  const [commActionError, setCommActionError] = useState('');

  useEffect(() => {
    if (!openContact?.id) return;
    const fresh = contacts.find((x) => String(x.id) === String(openContact.id));
    if (fresh) patchOpenContact(fresh);
  }, [contacts, openContact?.id, patchOpenContact]);

  const logCommunication = useCallback(
    async (type, notes = '') => {
      if (!supabase || !openContact?.id) {
        return { ok: false, error: 'No contact selected.' };
      }
      const {
        data: { user: authUser },
        error: userErr,
      } = await supabase.auth.getUser();
      const mid = !userErr && authUser?.id ? authUser.id : null;
      if (!mid) return { ok: false, error: 'Not signed in.' };
      const created_at = new Date().toISOString();
      const { error } = await supabase.from('communication_logs').insert({
        missionary_id: mid,
        contact_id: openContact.id,
        comm_type: type,
        notes: notes ?? '',
        created_at,
      });
      if (error) return { ok: false, error: error.message || 'Could not save log.' };
      refreshLogsAndTasks();
      bumpContactListData();
      await refetch();
      return { ok: true, created_at };
    },
    [openContact?.id, refetch, refreshLogsAndTasks, bumpContactListData],
  );

  const handleCall = useCallback(() => {
    const phone = openContact?.phone;
    if (!phone) {
      alert('No phone number on file');
      return;
    }
    const digits = phoneDigits(phone);
    if (!digits) {
      alert('No phone number on file');
      return;
    }
    setCommActionError('');
    window.open(`tel:${digits}`, '_self');
    void (async () => {
      const res = await logCommunication('call', '');
      if (!res.ok) setCommActionError(res.error || 'Could not log call.');
    })();
  }, [openContact?.phone, logCommunication]);

  const handleText = useCallback(() => {
    const phone = openContact?.phone;
    if (!phone) {
      alert('No phone number on file');
      return;
    }
    const digits = phoneDigits(phone);
    if (!digits) {
      alert('No phone number on file');
      return;
    }
    setCommActionError('');
    window.open(`sms:${digits}`, '_self');
    void (async () => {
      const res = await logCommunication('text', '');
      if (!res.ok) setCommActionError(res.error || 'Could not log text.');
    })();
  }, [openContact?.phone, logCommunication]);

  const openQuickLog = useCallback(() => {
    setLogType('call');
    setLogText('');
    setLogError('');
    setShowLogModal(true);
  }, []);

  const submitQuickLog = useCallback(async () => {
    if (!logType) return;
    setLogError('');
    setLogSaving(true);
    try {
      const res = await logCommunication(logType, logText.trim());
      if (!res.ok) {
        setLogError(res.error || 'Could not save log.');
        return;
      }
      setShowLogModal(false);
      setLogText('');
      refreshLogsAndTasks();
    } catch (e) {
      setLogError(e?.message || 'Could not save log.');
    } finally {
      setLogSaving(false);
    }
  }, [logCommunication, logType, logText, refreshLogsAndTasks]);

  const handleClose = useCallback(() => {
    closeDrawer();
    setShowLogModal(false);
    setLogText('');
    setLogError('');
    setCommActionError('');
  }, [closeDrawer]);

  const openEditForm = useCallback(
    (c) => {
      closeDrawer();
      navigate(`/missionary/contacts?edit=${encodeURIComponent(c.id)}`);
    },
    [closeDrawer, navigate],
  );

  const handleViewInPartners = useCallback(() => {
    closeDrawer();
    navigate('/missionary/partners');
  }, [closeDrawer, navigate]);

  return (
    <>
      <ContactSideDrawer
        contact={openContact}
        onClose={handleClose}
        logs={logs}
        tasks={tasks}
        logsLoading={logsLoading}
        tasksLoading={tasksLoading}
        onRefreshLogsAndTasks={refreshLogsAndTasks}
        saveQuickTag={saveQuickTag}
        patchContactInList={patchContactInList}
        onAfterQuickTagSave={() => void refetch()}
        onPatchContact={patchOpenContact}
        openEditForm={openEditForm}
        onViewInPartners={handleViewInPartners}
        onCall={handleCall}
        onText={handleText}
        onLog={openQuickLog}
        onScheduleMeeting={(c) =>
          navigate(`/missionary/meetings?add=1&contact=${encodeURIComponent(c.id)}`)
        }
        actionError={commActionError}
        activityLogsRefreshKey={activityLogsRefreshKey}
        suppressEscape={showLogModal}
      />

      <ContactQuickLogPopup
        open={showLogModal}
        backdropZIndex={DRAWER_STACK_QUICK_LOG_BACKDROP_Z}
        panelZIndex={DRAWER_STACK_QUICK_LOG_MODAL_Z}
        title={openContact ? `Quick log — ${openContact.fullName || 'Contact'}` : 'Quick log'}
        selectedType={logType}
        onSelectType={setLogType}
        notes={logText}
        onNotesChange={setLogText}
        error={logError}
        saving={logSaving}
        onSave={() => void submitQuickLog()}
        onClose={() => {
          if (logSaving) return;
          setShowLogModal(false);
          setLogText('');
          setLogError('');
        }}
      />
    </>
  );
}
