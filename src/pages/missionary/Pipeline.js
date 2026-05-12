import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import {
  MISSIONARY_PIPELINE_BOARD_STATUSES,
  useMissionaryPipelineContacts,
} from '../../hooks/useMissionaryPipelineContacts';
import { useSupabaseContacts } from '../../hooks/useSupabaseContacts';
import { categoryLabel } from '../../lib/contactCategories';
import { statusLabel } from '../../lib/contactStatuses';
import { Button, Card, EmptyState, Input, Modal } from '../../components/ui';

const STAGE_COLUMNS = [
  { status: 'contacted', label: 'Contacted' },
  { status: 'asked', label: 'Asked' },
  { status: 'meeting_scheduled', label: 'Meeting scheduled' },
  { status: 'committed', label: 'Committed' },
  { status: 'partner', label: 'Partner' },
];

const BOARD_SET = new Set(MISSIONARY_PIPELINE_BOARD_STATUSES);

function nextPipelineStatus(current) {
  const idx = MISSIONARY_PIPELINE_BOARD_STATUSES.indexOf(current);
  if (idx < 0 || idx >= MISSIONARY_PIPELINE_BOARD_STATUSES.length - 1) return null;
  return MISSIONARY_PIPELINE_BOARD_STATUSES[idx + 1];
}

const STAGE_BADGE = {
  contacted: 'bg-sky-100 text-sky-900 ring-1 ring-sky-200/80',
  asked: 'bg-violet-100 text-violet-900 ring-1 ring-violet-200/80',
  meeting_scheduled: 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80',
  committed: 'bg-amber-100 text-amber-900 ring-1 ring-amber-200/80',
  partner: 'bg-mission-blue/15 text-mission-blue ring-1 ring-mission-blue/25',
};

function stageBadgeClass(status) {
  return STAGE_BADGE[status] || 'bg-neutral-100 text-neutral-800 ring-1 ring-neutral-200/80';
}

export default function MissionaryPipeline() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { contacts, refetch: refetchContacts, updateContact, loading: contactsLoading } = useSupabaseContacts(
    user?.id,
    { authLoading },
  );
  const { pipelineContacts, pipelineLoading, updatePipelineContactStatus, refetchPipeline } =
    useMissionaryPipelineContacts(user?.id, {
      authLoading,
      variant: 'board',
      onAfterMutation: () => void refetchContacts(),
    });

  const [savingId, setSavingId] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [addBusyId, setAddBusyId] = useState(null);

  const byColumn = useMemo(() => {
    const map = Object.fromEntries(STAGE_COLUMNS.map(({ status }) => [status, []]));
    for (const c of pipelineContacts) {
      if (map[c.status]) map[c.status].push(c);
    }
    return map;
  }, [pipelineContacts]);

  const addCandidates = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    return contacts
      .filter((c) => !BOARD_SET.has(c.status))
      .filter((c) => {
        if (!q) return true;
        return (
          (c.fullName || '').toLowerCase().includes(q) ||
          (c.phone || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 80);
  }, [contacts, addQuery]);

  const moveToNext = async (contact) => {
    const next = nextPipelineStatus(contact.status);
    if (!next || !contact?.id) return;
    setSaveError('');
    setSavingId(contact.id);
    const res = await updatePipelineContactStatus(contact.id, next);
    setSavingId(null);
    if (!res.ok) setSaveError(res.error || 'Could not update status.');
  };

  const openEditor = (id) => {
    navigate(`/missionary/contacts?contact=${encodeURIComponent(id)}`);
  };

  const addContactToPipeline = async (c) => {
    if (!c?.id) return;
    setSaveError('');
    setAddBusyId(c.id);
    const res = await updateContact(c.id, {
      fullName: c.fullName,
      phone: c.phone,
      email: c.email,
      address: c.address,
      category: c.category,
      status: 'contacted',
      monthlyAmount: c.monthlyAmount,
      isOneTimeDonor: c.isOneTimeDonor,
      oneTimeDonationAmount: c.oneTimeDonationAmount,
      oneTimeDonationDate: c.oneTimeDonationDate,
      notes: c.notes,
    });
    setAddBusyId(null);
    if (!res.ok) {
      setSaveError(res.error || 'Could not add to pipeline.');
      return;
    }
    await refetchPipeline();
    setAddOpen(false);
    setAddQuery('');
  };

  const loading = pipelineLoading || contactsLoading;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="sent-page-title">Pipeline</h1>
          <p className="sent-body text-mission-muted">
            Contacts in active support conversations — open a card to edit details or advance stages.
          </p>
        </div>
        <Button type="button" onClick={() => setAddOpen(true)}>
          Add to pipeline
        </Button>
      </header>

      {saveError ? <p className="text-sm font-medium text-red-600">{saveError}</p> : null}

      {loading && pipelineContacts.length === 0 ? (
        <p className="text-sm text-neutral-500">Loading pipeline…</p>
      ) : pipelineContacts.length === 0 ? (
        <EmptyState
          icon="compass"
          title="Pipeline is empty"
          subtitle="Add contacts from your list or move someone to “Contacted” to get started."
          action={
            <Button type="button" onClick={() => setAddOpen(true)}>
              Add to pipeline
            </Button>
          }
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-5 md:gap-4 md:overflow-visible">
          {STAGE_COLUMNS.map((col) => (
            <div key={col.status} className="flex w-[min(100%,280px)] shrink-0 flex-col gap-3 md:w-auto">
              <div className="rounded-btn border border-neutral-200 bg-neutral-50 px-3 py-2">
                <p className="text-xs font-bold uppercase tracking-wide text-neutral-600">{col.label}</p>
                <p className="text-xs text-neutral-500">{(byColumn[col.status] || []).length}</p>
              </div>
              <div className="flex min-h-[120px] flex-col gap-3">
                {(byColumn[col.status] || []).map((c) => {
                  const next = nextPipelineStatus(c.status);
                  return (
                    <Card key={c.id} className="border-neutral-200 p-4 shadow-sm">
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => openEditor(c.id)}
                      >
                        <p className="text-sm font-bold text-neutral-900">{c.fullName || 'Unnamed'}</p>
                        <p className="mt-1 text-xs text-neutral-600">{c.phone || '—'}</p>
                        <p className="mt-1 text-xs text-neutral-500">{categoryLabel(c.category)}</p>
                        {Number(c.monthlyAmount) > 0 ? (
                          <p className="mt-1 text-xs font-semibold text-mission-blue">
                            ${Number(c.monthlyAmount).toFixed(0)}/mo
                          </p>
                        ) : null}
                        <span
                          className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${stageBadgeClass(c.status)}`}
                        >
                          {statusLabel(c.status)}
                        </span>
                      </button>
                      <div className="mt-3 border-t border-neutral-100 pt-3" onClick={(e) => e.stopPropagation()}>
                        {next ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="w-full text-xs"
                            disabled={savingId === c.id}
                            onClick={() => void moveToNext(c)}
                          >
                            {savingId === c.id ? 'Saving…' : `Move to ${STAGE_COLUMNS.find((s) => s.status === next)?.label || next}`}
                          </Button>
                        ) : (
                          <p className="text-center text-[11px] text-neutral-400">Final stage</p>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={addOpen} title="Add to pipeline" onClose={() => !addBusyId && setAddOpen(false)}>
        <p className="text-sm text-neutral-600">
          Search your contacts and set their status to <strong>Contacted</strong> to place them in the pipeline.
        </p>
        <div className="mt-4">
          <Input
            value={addQuery}
            onChange={(e) => setAddQuery(e.target.value)}
            placeholder="Search by name, phone, or email…"
            className="py-2.5 text-sm"
          />
        </div>
        <ul className="mt-4 max-h-[min(60vh,360px)] space-y-2 overflow-y-auto">
          {addCandidates.length === 0 ? (
            <li className="text-sm text-neutral-500">No matching contacts outside the pipeline.</li>
          ) : (
            addCandidates.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-btn border border-neutral-200 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-900">{c.fullName || 'Unnamed'}</p>
                  <p className="truncate text-xs text-neutral-500">{c.phone || c.email || '—'}</p>
                </div>
                <Button
                  type="button"
                  className="min-h-0 shrink-0 px-3 py-2 text-xs"
                  disabled={addBusyId === c.id}
                  onClick={() => void addContactToPipeline(c)}
                >
                  {addBusyId === c.id ? 'Adding…' : 'Add'}
                </Button>
              </li>
            ))
          )}
        </ul>
      </Modal>
    </div>
  );
}
