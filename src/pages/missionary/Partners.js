import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useSupabaseContacts } from '../../hooks/useSupabaseContacts';
import { supabase } from '../../lib/supabaseClient';
import { categoryLabel } from '../../lib/contactCategories';
import { Button, Card, EmptyState, Modal, Textarea } from '../../components/ui';

const COMM_TYPE_LABEL = {
  call: 'Call',
  text: 'Text',
  update: 'Update',
  prayer: 'Prayer',
  note: 'Note',
};

function Tabs({ tab, setTab }) {
  const tabs = ['Message', 'Prayer', 'Notes'];
  return (
    <div className="flex gap-2">
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setTab(t)}
          className={`rounded-btn px-3 py-2 text-sm font-medium ${
            tab === t ? 'bg-mission-blue/10 text-mission-blue ring-1 ring-mission-blue/20' : 'text-mission-muted hover:bg-neutral-100'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function logMatchesTab(log, tab) {
  if (tab === 'Prayer') return log.comm_type === 'prayer';
  if (tab === 'Notes') return log.comm_type === 'note';
  return log.comm_type === 'call' || log.comm_type === 'text' || log.comm_type === 'update';
}

export default function MissionaryPartners() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { contacts } = useSupabaseContacts(user?.id, { authLoading });
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('Message');
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [commModal, setCommModal] = useState(null);
  const [commNotes, setCommNotes] = useState('');
  const [commSaving, setCommSaving] = useState(false);
  const [commError, setCommError] = useState('');

  const partners = useMemo(() => {
    return contacts.filter(
      (c) =>
        c.category === 'supporter' ||
        c.status === 'partner' ||
        Number(c.monthlyAmount) > 0,
    );
  }, [contacts]);

  const selected = partners.find((p) => p.id === selectedId) || null;

  const loadLogs = useCallback(async () => {
    if (!supabase || !selected?.id) {
      setLogs([]);
      return;
    }
    setLogsLoading(true);
    const { data, error } = await supabase
      .from('communication_logs')
      .select('*')
      .eq('contact_id', selected.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setLogsLoading(false);
    if (error) {
      setLogs([]);
      return;
    }
    setLogs(data || []);
  }, [selected?.id]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const filteredLogs = useMemo(() => logs.filter((l) => logMatchesTab(l, tab)), [logs, tab]);

  const submitCommLog = async () => {
    if (!supabase || !user?.id || !selected?.id || !commModal) return;
    setCommError('');
    setCommSaving(true);
    const notes = commNotes.trim();
    const row = {
      missionary_id: user.id,
      contact_id: selected.id,
      comm_type: commModal,
      notes,
      created_at: new Date().toISOString(),
    };
    try {
      const { data, error } = await supabase.from('communication_logs').insert(row).select('*').single();
      if (error) {
        setCommError(error.message || 'Could not save log.');
        setCommSaving(false);
        return;
      }
      if (data) {
        setLogs((prev) => {
          const next = [data, ...prev.filter((x) => x.id !== data.id)];
          return next.slice(0, 20);
        });
      } else {
        await loadLogs();
      }
      setCommModal(null);
      setCommNotes('');
    } catch (e) {
      setCommError(e?.message || 'Could not save log.');
    } finally {
      setCommSaving(false);
    }
  };

  const openLogModal = (type) => {
    setCommError('');
    setCommNotes('');
    setCommModal(type);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="sent-page-title">Partners</h1>
        <p className="sent-body text-mission-muted">Monthly partners are derived from your contacts. Starts empty.</p>
      </header>

      {partners.length === 0 ? (
        <EmptyState
          icon="heart"
          title="No partners yet — start asking"
          subtitle="Add contacts on the Contacts tab and mark monthly amounts or partner status — they’ll roll up here."
          action={
            <Button type="button" onClick={() => navigate('/missionary/contacts')}>
              Open contacts
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-3 md:col-span-1">
            {partners.map((p) => (
              <Card key={p.id} className="p-4">
                <button type="button" className="w-full text-left" onClick={() => setSelectedId(p.id)}>
                  <p className="text-sm font-semibold text-neutral-900">{p.fullName || 'Unnamed partner'}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {Number(p.monthlyAmount) > 0 ? `$${Number(p.monthlyAmount).toFixed(0)}/mo` : '$0/mo'} ·{' '}
                    {categoryLabel(p.category)}
                  </p>
                </button>
              </Card>
            ))}
          </div>

          <div className="md:col-span-2">
            {selected ? (
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{selected.fullName || 'Unnamed partner'}</p>
                    <p className="mt-1 text-sm text-neutral-600">{categoryLabel(selected.category)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={() => openLogModal('call')}>
                      Log call
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => openLogModal('text')}>
                      Log text
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => openLogModal('update')}>
                      Log update
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => openLogModal('prayer')}>
                      Log prayer
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => openLogModal('note')}>
                      Log note
                    </Button>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <Tabs tab={tab} setTab={setTab} />
                  <button
                    type="button"
                    className="text-xs font-semibold text-mission-blue hover:underline"
                    onClick={() => navigate(`/missionary/contacts?contact=${encodeURIComponent(selected.id)}`)}
                  >
                    Edit contact
                  </button>
                </div>

                <div className="mt-4">
                  {logsLoading ? (
                    <p className="text-sm text-neutral-500">Loading activity…</p>
                  ) : filteredLogs.length === 0 ? (
                    <EmptyState
                      icon="clipboard"
                      title="No activity in this tab"
                      subtitle="Log calls, texts, updates, prayers, or notes — they’ll show up here."
                    />
                  ) : (
                    <ul className="space-y-3">
                      {filteredLogs.map((log) => (
                        <li key={log.id} className="rounded-btn border border-neutral-200 px-4 py-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-mission-blue">
                              {COMM_TYPE_LABEL[log.comm_type] || log.comm_type}
                            </span>
                            <span className="text-xs text-neutral-500">
                              {log.created_at
                                ? new Date(log.created_at).toLocaleString(undefined, {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                  })
                                : ''}
                            </span>
                          </div>
                          {log.notes ? <p className="mt-2 whitespace-pre-wrap text-neutral-800">{log.notes}</p> : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            ) : (
              <EmptyState icon="compass" title="Select a partner" subtitle="Choose someone from the list to see details and log touchpoints." />
            )}
          </div>
        </div>
      )}

      <Modal
        open={Boolean(commModal)}
        title={commModal ? `Log ${COMM_TYPE_LABEL[commModal] || commModal}` : ''}
        onClose={() => !commSaving && setCommModal(null)}
        backdropClose={!commSaving}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" disabled={commSaving} onClick={() => setCommModal(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={commSaving} onClick={() => void submitCommLog()}>
              {commSaving ? 'Saving…' : 'Save log'}
            </Button>
          </div>
        }
      >
        {commError ? <p className="mb-3 text-sm text-red-700">{commError}</p> : null}
        <Textarea
          value={commNotes}
          onChange={(e) => setCommNotes(e.target.value)}
          placeholder="Notes (optional)…"
          rows={5}
        />
      </Modal>
    </div>
  );
}
