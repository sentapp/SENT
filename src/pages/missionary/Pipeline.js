import { useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useContactDrawer } from '../../context/ContactDrawerContext';
import {
  MISSIONARY_KANBAN_STATUSES,
  PIPELINE_NEXT_STATUS,
  useMissionaryPipelineContacts,
} from '../../hooks/useMissionaryPipelineContacts';
import { useSupabaseContacts } from '../../hooks/useSupabaseContacts';
import { categoryLabel, shouldShowCategoryTag } from '../../lib/contactCategories';
import { normalizeStatusFromDb, statusLabel } from '../../lib/contactStatuses';
import { getDateFromNow, localDateStr } from '../../lib/dateHelpers';
import { formatPhone } from '../../lib/phoneFormat';
import { Button, Card, Input, Modal } from '../../components/ui';
import DarkPageHeader from '../../components/DarkPageHeader';

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

const NEXT_STAGE_LABEL = {
  contacted: 'Meeting Scheduled',
  meeting_scheduled: 'Committed',
  committed: 'Partner',
};

const FOLLOW_UP_QUICK_OPTS = ['1 month', '3 months', '6 months'];

function truncateNotes(text, max = 100) {
  const s = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export default function MissionaryPipeline({ embedded = false }) {
  const { openDrawer } = useContactDrawer();
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
  const [moveTarget, setMoveTarget] = useState(null);
  const [moveOutcome, setMoveOutcome] = useState('advance');
  const [followUpDate, setFollowUpDate] = useState('');
  const [moveModalError, setMoveModalError] = useState('');

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
      .filter((c) => {
        const st = normalizeStatusFromDb(c.status);
        return !KANBAN_SET.has(st) && st !== 'declined' && st !== 'not_right_now';
      })
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

  const openMoveForward = (contact) => {
    if (!contact?.id) return;
    const st = normalizeStatusFromDb(contact.status);
    if (!PIPELINE_NEXT_STATUS[st]) return;
    setMoveModalError('');
    setMoveOutcome('advance');
    setFollowUpDate(localDateStr());
    setMoveTarget(contact);
  };

  const closeMoveForward = () => {
    if (savingId) return;
    setMoveTarget(null);
    setMoveModalError('');
  };

  const confirmMoveForward = async () => {
    if (!moveTarget?.id) return;
    const st = normalizeStatusFromDb(moveTarget.status);
    const next = PIPELINE_NEXT_STATUS[st];
    setSaveError('');
    setMoveModalError('');
    setSavingId(moveTarget.id);

    let res;
    if (moveOutcome === 'not_right_now') {
      if (!followUpDate) {
        setMoveModalError('Choose a follow-up date.');
        setSavingId(null);
        return;
      }
      res = await updatePipelineContactStatus(moveTarget.id, 'not_right_now', {
        follow_up_date: followUpDate,
      });
    } else {
      if (!next) {
        setMoveModalError('Nothing to advance.');
        setSavingId(null);
        return;
      }
      res = await updatePipelineContactStatus(moveTarget.id, next);
    }

    setSavingId(null);
    if (!res.ok) {
      setSaveError(res.error || 'Could not update status.');
      setMoveModalError(res.error || 'Could not update status.');
      return;
    }
    setMoveTarget(null);
  };

  const openEditor = (contactOrId) => {
    const id = typeof contactOrId === 'object' ? contactOrId?.id : contactOrId;
    if (!id) return;
    const c = contacts.find((x) => String(x.id) === String(id));
    if (c) openDrawer(c);
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
      {!embedded ? (
        <DarkPageHeader title="Pipeline" subtitle="Advance stages & grow partners" />
      ) : null}
      <header className={`flex flex-wrap items-end justify-end gap-3 ${embedded ? '' : '-mt-2'}`}>
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
                      onClick={() => openEditor(c)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openEditor(c);
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
                            onClick={() => openMoveForward(c)}
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

      <Modal
        open={Boolean(moveTarget)}
        title={moveTarget ? `Move forward — ${moveTarget.fullName || 'Contact'}` : 'Move forward'}
        onClose={closeMoveForward}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" disabled={Boolean(savingId)} onClick={closeMoveForward}>
              Cancel
            </Button>
            <Button type="button" disabled={Boolean(savingId)} onClick={() => void confirmMoveForward()}>
              {savingId ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      >
        {moveTarget ? (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">
              Current stage: <strong>{statusLabel(moveTarget.status)}</strong>
            </p>
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-mission-line px-3 py-2.5 text-sm">
                <input
                  type="radio"
                  name="move-outcome"
                  checked={moveOutcome === 'advance'}
                  onChange={() => setMoveOutcome('advance')}
                />
                <span>
                  Advance to{' '}
                  <strong>{NEXT_STAGE_LABEL[normalizeStatusFromDb(moveTarget.status)] || 'next stage'}</strong>
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#C8BCF5] bg-[#F5F0FF] px-3 py-2.5 text-sm text-[#6040B0]">
                <input
                  type="radio"
                  name="move-outcome"
                  checked={moveOutcome === 'not_right_now'}
                  onChange={() => setMoveOutcome('not_right_now')}
                />
                <span>
                  <strong>Not right now</strong> — pause and set a follow-up date
                </span>
              </label>
            </div>
            {moveOutcome === 'not_right_now' ? (
              <div className="mt-2.5">
                <p className="mb-1.5 text-[11px] text-neutral-500">When should we circle back?</p>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full rounded-lg border border-[#EEEEEE] bg-[#FAFAFA] px-2.5 py-2 text-xs"
                />
                <div className="mt-1.5 flex gap-1.5">
                  {FOLLOW_UP_QUICK_OPTS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFollowUpDate(getDateFromNow(opt))}
                      className="flex-1 rounded-md border border-[#EEEEEE] bg-transparent px-1 py-1.5 text-[10px] text-neutral-500 transition hover:border-[#C8BCF5] hover:text-[#6040B0]"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {moveModalError ? <p className="text-sm text-red-600">{moveModalError}</p> : null}
          </div>
        ) : null}
      </Modal>

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
