import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import {
  MISSIONARY_KANBAN_STATUSES,
  PIPELINE_NEXT_STATUS,
  useMissionaryPipelineContacts,
} from '../../hooks/useMissionaryPipelineContacts';
import { useSupabaseContacts } from '../../hooks/useSupabaseContacts';
import { categoryLabel, shouldShowCategoryTag } from '../../lib/contactCategories';
import { normalizeStatusFromDb } from '../../lib/contactStatuses';
import { formatPhone } from '../../lib/phoneFormat';
import { Button, Card, Input, Modal } from '../../components/ui';

const KANBAN_SET = new Set(MISSIONARY_KANBAN_STATUSES);

/**
 * Kanban order + display labels (DB status → column).
 * Must match `MISSIONARY_KANBAN_STATUSES` and `PIPELINE_NEXT_STATUS` in `useMissionaryPipelineContacts`.
 */
const STAGE_COLUMNS = [
  { status: 'contacted', label: 'Contacted' },
  { status: 'meeting_scheduled', label: 'Meeting Scheduled' },
  { status: 'committed', label: 'Committed' },
  { status: 'partner', label: 'Partner' },
];

const CATEGORY_BADGE =
  'inline-flex max-w-full truncate rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-800 ring-1 ring-neutral-200/80';

function truncateNotes(text, max = 100) {
  const s = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export default function MissionaryPipeline() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { contacts, refetch: refetchContacts, updateContact, loading: contactsLoading } = useSupabaseContacts(
    user?.id,
    { authLoading },
  );
  const { pipelineContacts, pipelineLoading, moveForward, refetchPipeline } = useMissionaryPipelineContacts(
    user?.id,
    {
      authLoading,
      variant: 'board',
      onAfterMutation: () => void refetchContacts(),
    },
  );

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
    for (const col of STAGE_COLUMNS) {
      map[col.status].sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', undefined, { sensitivity: 'base' }));
    }
    return map;
  }, [pipelineContacts]);

  const addCandidates = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    return contacts
      .filter((c) => !KANBAN_SET.has(normalizeStatusFromDb(c.status)) && normalizeStatusFromDb(c.status) !== 'declined')
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

  const handleMoveForward = async (contact) => {
    if (!contact?.id) return;
    const st = normalizeStatusFromDb(contact.status);
    const next = PIPELINE_NEXT_STATUS[st];
    if (!next) return;
    setSaveError('');
    setSavingId(contact.id);
    const res = await moveForward(contact.id, contact.status);
    setSavingId(null);
    if (!res.ok) setSaveError(res.error || 'Could not update status.');
  };

  const openEditor = (id) => {
    navigate(`/missionary/contacts?contact=${encodeURIComponent(id)}`);
  };

  /** Places the contact at **Contacted** (not New Lead); new imports without a status use `prospect` / New Lead. */
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
      relationship: c.relationship ?? '',
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
    <div className="flex flex-col gap-4 md:gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="sent-page-title">Pipeline</h1>
          <p className="sent-body text-mission-muted">
            Drag-free board — advance stages or open a contact to edit details.
          </p>
        </div>
        <Button type="button" onClick={() => setAddOpen(true)}>
          Add to pipeline
        </Button>
      </header>

      {saveError ? <p className="text-sm font-medium text-red-600">{saveError}</p> : null}

      {loading && pipelineContacts.length === 0 ? (
        <p className="text-sm text-neutral-500">Loading pipeline…</p>
      ) : null}

      <div className="flex gap-4 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch] md:grid md:grid-cols-4 md:gap-4 md:overflow-visible">
        {STAGE_COLUMNS.map((col) => {
          const columnContacts = byColumn[col.status] || [];
          return (
            <div key={col.status} className="flex w-[min(100%,200px)] shrink-0 flex-col gap-4 md:w-auto">
              <div className="rounded-card border border-mission-line bg-[color:var(--color-bg)] px-3 py-2">
                <p className="text-xs font-bold uppercase tracking-wide text-mission-muted">{col.label}</p>
                <p className="text-sm font-semibold text-ink">{columnContacts.length}</p>
              </div>
              <div className="flex min-h-[100px] flex-col gap-4">
                {columnContacts.map((c) => {
                  const canAdvance = Boolean(PIPELINE_NEXT_STATUS[normalizeStatusFromDb(c.status)]);
                  return (
                    <Card
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => openEditor(c.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openEditor(c.id);
                        }
                      }}
                      className="cursor-pointer border-mission-line p-4 shadow-none transition hover:bg-[color:var(--color-bg)]"
                    >
                      <p className="text-sm font-bold text-ink">{c.fullName || 'Unnamed'}</p>
                      <p className="mt-1 text-xs text-neutral-600">{formatPhone(c.phone) || '—'}</p>
                      {shouldShowCategoryTag(c.category) ? (
                        <p className="mt-2">
                          <span className={CATEGORY_BADGE}>{categoryLabel(c.category)}</span>
                        </p>
                      ) : null}
                      <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-neutral-600">
                        {truncateNotes(c.notes) || <span className="text-neutral-400">No notes yet</span>}
                      </p>
                      <div
                        className="mt-3 flex flex-col gap-2 border-t border-mission-line pt-3"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {canAdvance ? (
                          <Button
                            type="button"
                            variant="accent"
                            className="w-full min-h-0 py-2 text-xs"
                            disabled={savingId === c.id}
                            onClick={() => void handleMoveForward(c)}
                          >
                            {savingId === c.id ? 'Saving…' : 'Move Forward'}
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
          );
        })}
      </div>

      {!loading && pipelineContacts.length === 0 ? (
        <p className="text-sm text-neutral-600">
          No contacts in these stages yet. Use <strong>Add to pipeline</strong> or set a contact to{' '}
          <strong>Contacted</strong> from the Contacts page.
        </p>
      ) : null}

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
                className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-mission-line bg-surface px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{c.fullName || 'Unnamed'}</p>
                  <p className="truncate text-xs text-neutral-500">{formatPhone(c.phone) || c.email || '—'}</p>
                </div>
                <Button
                  type="button"
                  variant="accent"
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
