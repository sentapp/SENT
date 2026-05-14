import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input, Modal } from '../../components/ui';
import { useAuth } from '../../auth/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { categoryLabel, normalizeCategory } from '../../lib/contactCategories';
import { formatPhone, phoneDigits } from '../../lib/phoneFormat';
import { initialsFromDisplayName } from '../../lib/profileAppearance';
import { relationshipLabel } from '../../lib/contactRelationships';
import { notesWithoutSocialBlock, splitSocialFromNotes } from '../../lib/contactSocialInNotes';
import { statusLabel } from '../../lib/contactStatuses';
import { createTask, fetchTasksForContact, completeTask, uncompleteTask } from '../../lib/tasksRepository';
import { ContactThreeQuickTagRows } from './QuickTagPopover';
import { lastContactBadgeFromIso } from './ContactQuickViewPopup';
import { getContactAvatarStyle } from '../../lib/contactAvatarStyles';

function cleanDisplayNotesBody(rawNotes) {
  const body = notesWithoutSocialBlock(rawNotes);
  if (!body) return '';
  const trimmed = body.toString().trim();
  if (/^\d+$/.test(trimmed)) return '';
  return trimmed;
}

const COMM_TYPE_META = {
  call: { label: 'Call', badge: 'bg-[color:var(--amber-light)] text-[color:var(--amber)] ring-1 ring-border/90' },
  text: { label: 'Text', badge: 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80' },
  meeting: { label: 'Meeting', badge: 'bg-purple-100 text-purple-900 ring-1 ring-purple-200/80' },
  note: { label: 'Note', badge: 'bg-neutral-100 text-neutral-800 ring-1 ring-neutral-200/80' },
  prayer: { label: 'Prayer', badge: 'bg-amber-100 text-amber-950 ring-1 ring-amber-200/80' },
  update: { label: 'Update', badge: 'bg-neutral-100 text-neutral-800 ring-1 ring-neutral-200/80' },
  email: { label: 'Email', badge: 'bg-slate-100 text-slate-800 ring-1 ring-slate-200/80' },
};

function commTypeDisplay(commType) {
  const key = String(commType || '').toLowerCase();
  const meta = COMM_TYPE_META[key] || { label: key ? key.charAt(0).toUpperCase() + key.slice(1) : 'Log', badge: COMM_TYPE_META.note.badge };
  return meta;
}

function previewNotes(text, max = 140) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return '—';
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function ActivityLogRowMenu({ onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-lg leading-none text-neutral-500 hover:bg-neutral-100"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Log options"
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[9rem] rounded-md border border-[#EEEEEE] bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm font-medium text-ink hover:bg-neutral-50"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-50"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * @param {{
 *   label: string,
 *   value?: string,
 *   href?: string,
 *   valueClassName?: string,
 *   children?: import('react').ReactNode,
 * }} props
 */
function InfoRow({ label, value, href, valueClassName = 'text-sm font-medium text-ink', children }) {
  const text = value ?? '';
  const body =
    children ??
    (href && text ? (
      <a href={href} className={`mt-0.5 inline-block ${valueClassName} text-mission-ink underline`}>
        {text}
      </a>
    ) : (
      <p className={`mt-0.5 ${valueClassName}`}>{text || '—'}</p>
    ));
  return (
    <div className="border-b border-[#EEEEEE] px-4 py-2.5 last:border-b-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      {body}
    </div>
  );
}

const SECTION_STRIP =
  'rounded-md bg-surface px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted';

const BTN_BORDERED =
  'flex min-h-[44px] items-center justify-center border border-[#EEEEEE] bg-white text-sm font-semibold text-mission-ink hover:bg-mission-ink/5';

/**
 * Full profile-style popup for the Contacts page (Layout A).
 *
 * @param {{
 *   contact: Record<string, unknown> | null,
 *   onClose: () => void,
 *   saveQuickTag?: (contact: Record<string, unknown>, field: string, value: string) => Promise<{ ok?: boolean }>,
 *   patchContactInList?: (id: string, partial: Record<string, unknown>) => void,
 *   onAfterQuickTagSave?: () => void,
 *   onPatchContact?: (next: Record<string, unknown>) => void,
 *   openEditForm: (c: Record<string, unknown>) => void,
 *   lastContactIso?: string | null,
 *   showLog: boolean,
 *   setShowLog?: (v: boolean) => void,
 *   onCall: () => void,
 *   onText: () => void,
 *   onLog: () => void,
 *   actionError?: string,
 *   activityLogsRefreshKey?: number,
 * }} props
 */
export function ContactProfilePopup1({
  contact,
  onClose,
  saveQuickTag,
  patchContactInList,
  onAfterQuickTagSave,
  onPatchContact,
  openEditForm,
  lastContactIso,
  showLog,
  setShowLog: _setShowLog,
  onCall,
  onText,
  onLog,
  actionError = '',
  activityLogsRefreshKey = 0,
}) {
  const { user } = useAuth();
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [editingLogId, setEditingLogId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [activityMutating, setActivityMutating] = useState(false);
  const [contactTasks, setContactTasks] = useState([]);
  const [contactTasksLoading, setContactTasksLoading] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [newTaskSaving, setNewTaskSaving] = useState(false);
  const [newTaskError, setNewTaskError] = useState('');

  const loadActivityLogs = useCallback(async () => {
    if (!supabase || !contact?.id || !user?.id) {
      setActivityLogs([]);
      return;
    }
    setActivityLoading(true);
    const { data, error } = await supabase
      .from('communication_logs')
      .select('id, comm_type, notes, created_at')
      .eq('contact_id', contact.id)
      .eq('missionary_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('communication_logs', error);
      setActivityLogs([]);
    } else {
      setActivityLogs(data || []);
    }
    setActivityLoading(false);
  }, [contact?.id, user?.id]);

  useEffect(() => {
    void loadActivityLogs();
  }, [loadActivityLogs, activityLogsRefreshKey]);

  const loadContactTasks = useCallback(async () => {
    if (!supabase || !contact?.id || !user?.id) {
      setContactTasks([]);
      return;
    }
    setContactTasksLoading(true);
    const list = await fetchTasksForContact(supabase, user.id, contact.id);
    setContactTasks(list);
    setContactTasksLoading(false);
  }, [contact?.id, user?.id]);

  useEffect(() => {
    void loadContactTasks();
  }, [loadContactTasks, activityLogsRefreshKey]);

  useEffect(() => {
    if (!contact || showLog || taskModalOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [contact, showLog, taskModalOpen, onClose]);

  const beginEditLog = (log) => {
    setEditingLogId(log.id);
    setEditDraft(String(log.notes ?? ''));
  };

  const cancelEditLog = () => {
    setEditingLogId(null);
    setEditDraft('');
  };

  const saveEditLog = async () => {
    if (!supabase || !user?.id || !editingLogId) return;
    setActivityMutating(true);
    const { error } = await supabase
      .from('communication_logs')
      .update({ notes: editDraft })
      .eq('id', editingLogId)
      .eq('missionary_id', user.id);
    setActivityMutating(false);
    if (error) {
      console.error(error);
      return;
    }
    cancelEditLog();
    void loadActivityLogs();
  };

  const deleteLog = async (id) => {
    if (!window.confirm('Delete this activity log?')) return;
    if (!supabase || !user?.id) return;
    setActivityMutating(true);
    const { error } = await supabase.from('communication_logs').delete().eq('id', id).eq('missionary_id', user.id);
    setActivityMutating(false);
    if (error) {
      console.error(error);
      return;
    }
    if (editingLogId === id) cancelEditLog();
    void loadActivityLogs();
  };

  const resetTaskModal = () => {
    setNewTaskTitle('');
    setNewTaskDue('');
    setNewTaskError('');
  };

  const saveNewContactTask = async () => {
    if (!user?.id || !contact?.id) return;
    setNewTaskError('');
    const title = newTaskTitle.trim();
    if (!title) {
      setNewTaskError('Title is required.');
      return;
    }
    setNewTaskSaving(true);
    const res = await createTask(supabase, {
      missionaryId: user.id,
      contactId: contact.id,
      title,
      notes: null,
      dueDate: newTaskDue || null,
    });
    setNewTaskSaving(false);
    if (!res.ok) {
      setNewTaskError(res.error || 'Could not save.');
      return;
    }
    setTaskModalOpen(false);
    resetTaskModal();
    void loadContactTasks();
  };

  const toggleContactTask = async (task) => {
    if (!supabase || !user?.id) return;
    if (!task.isComplete) {
      setContactTasks((prev) =>
        prev.map((x) =>
          x.id === task.id ? { ...x, isComplete: true, completedAt: new Date().toISOString() } : x,
        ),
      );
      await completeTask(supabase, task.id, user.id);
      void loadActivityLogs();
    } else {
      setContactTasks((prev) =>
        prev.map((x) => (x.id === task.id ? { ...x, isComplete: false, completedAt: null } : x)),
      );
      await uncompleteTask(supabase, task.id, user.id);
    }
    void loadContactTasks();
  };

  if (!contact || typeof document === 'undefined') return null;

  const badge = lastContactBadgeFromIso(lastContactIso ?? null);
  const { social } = splitSocialFromNotes(contact.notes);
  const notesDisplay = cleanDisplayNotesBody(contact.notes);
  const phoneDigitsRaw = contact.phone ? phoneDigits(contact.phone) : '';
  const phoneHref = phoneDigitsRaw ? `tel:${phoneDigitsRaw}` : undefined;
  const emailStr = contact.email ? String(contact.email).trim() : '';
  const emailHref = emailStr ? `mailto:${emailStr}` : undefined;

  const cat = normalizeCategory(contact.category);
  const categoryDisp = cat ? categoryLabel(contact.category) : '—';
  const statusDisp = statusLabel(contact.status);
  const rel = contact.relationship != null && String(contact.relationship).trim() !== '';
  const relationshipDisp = rel ? relationshipLabel(contact.relationship) : '—';

  const monthly = Number(contact.monthlyAmount);
  const monthlyDisp = Number.isFinite(monthly) && monthly > 0 ? `$${monthly.toFixed(0)}/mo` : '—';

  const socialStr = social ? String(social).trim() : '';
  const socialHref =
    socialStr && /^https?:\/\//i.test(socialStr)
      ? socialStr
      : socialStr && /^www\./i.test(socialStr)
        ? `https://${socialStr}`
        : undefined;

  const handleEdit = () => {
    onClose();
    openEditForm(contact);
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: 300, backgroundColor: 'rgba(0,0,0,0.25)' }}
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose?.();
        }}
      >
      <div
        className="w-full overflow-y-auto overflow-x-hidden bg-white shadow-lg"
        style={{
          maxWidth: 380,
          maxHeight: '85vh',
          borderRadius: 16,
          border: '1px solid #EEEEEE',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-profile-popup-1-name"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-border p-4">
          <div className="flex gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
              style={getContactAvatarStyle(contact.category)}
              aria-hidden
            >
              {initialsFromDisplayName(contact.fullName || '')}
            </div>
            <div className="min-w-0 flex-1">
              <p id="contact-profile-popup-1-name" className="text-base font-medium leading-tight text-ink">
                {contact.fullName || 'Unnamed'}
              </p>
              <p className="mt-1 text-sm">
                <span className="text-neutral-600">Last contacted: </span>
                <span className={badge.className}>{badge.label}</span>
              </p>
            </div>
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg leading-none text-neutral-500 hover:bg-neutral-100"
              aria-label="Close"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        {saveQuickTag ? (
          <div className="border-b border-[#EEEEEE] px-4 py-3">
            <ContactThreeQuickTagRows
              contact={contact}
              saveQuickTag={saveQuickTag}
              patchContactInList={patchContactInList}
              onPatchContact={onPatchContact}
              onAfterSave={onAfterQuickTagSave}
            />
          </div>
        ) : null}

        <div className="pt-3">
          <div className="px-4 pb-2">
            <div className={SECTION_STRIP}>Contact info</div>
          </div>
          <div className="pb-1">
            <InfoRow
              label="Phone"
              value={contact.phone ? formatPhone(contact.phone) : ''}
              href={phoneHref}
              valueClassName="text-sm font-medium text-ink"
            />
            <InfoRow label="Email" value={emailStr} href={emailHref} />
            <InfoRow label="Address" value={contact.address ? String(contact.address) : ''} />
            <InfoRow label="Category" value={categoryDisp} valueClassName="text-sm font-medium text-ink" />
            <InfoRow label="Status" value={statusDisp} valueClassName="text-sm font-medium text-ink" />
            <InfoRow label="Relationship" value={relationshipDisp} valueClassName="text-sm font-medium text-ink" />
            <InfoRow label="Monthly" value={monthlyDisp} valueClassName="text-sm font-medium text-ink" />
            <InfoRow
              label="Social"
              value={socialStr}
              href={socialHref}
              valueClassName="text-sm font-medium text-ink break-all"
            />
          </div>
        </div>

        <div className="border-t border-[#EEEEEE] px-4 py-3">
          <div className={SECTION_STRIP}>Notes</div>
          {notesDisplay ? (
            <p className="mt-2 whitespace-pre-wrap px-1 text-sm text-neutral-800">{notesDisplay}</p>
          ) : (
            <p className="mt-2 px-1 text-sm italic text-neutral-500">No notes yet</p>
          )}
        </div>

        <div className="border-t border-[#EEEEEE] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className={`${SECTION_STRIP} flex-1 min-w-[8rem]`}>Tasks</div>
            <button
              type="button"
              className="shrink-0 rounded-md border border-[#EEEEEE] bg-white px-3 py-1.5 text-xs font-semibold text-mission-ink hover:bg-mission-ink/5"
              onClick={() => {
                resetTaskModal();
                setTaskModalOpen(true);
              }}
            >
              + Add task
            </button>
          </div>
          {contactTasksLoading ? (
            <p className="mt-2 text-sm text-neutral-500">Loading…</p>
          ) : contactTasks.filter((t) => !t.isComplete).length === 0 ? (
            <p className="mt-2 text-sm italic text-neutral-500">No open tasks for this contact</p>
          ) : (
            <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
              {contactTasks
                .filter((t) => !t.isComplete)
                .map((t) => (
                  <li key={t.id} className="flex items-start gap-2 rounded-md border border-[#EEEEEE] bg-[#FAFAFA] px-2.5 py-2">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => void toggleContactTask(t)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--color-accent)]"
                      aria-label={`Complete ${t.title}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{t.title}</p>
                      <p className="text-xs text-neutral-500">{t.dueDate ? `Due ${t.dueDate}` : 'No due date'}</p>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div className="border-t border-[#EEEEEE] px-4 py-3">
          <div className={SECTION_STRIP}>Activity</div>
          {activityLoading ? (
            <p className="mt-2 px-1 text-sm text-neutral-500">Loading…</p>
          ) : activityLogs.length === 0 ? (
            <p className="mt-2 px-1 text-sm italic text-neutral-500">No activity logged yet</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {activityLogs.map((log) => {
                const { label, badge: typeBadge } = commTypeDisplay(log.comm_type);
                const dt = log.created_at ? new Date(log.created_at) : null;
                const dateStr =
                  dt && !Number.isNaN(dt.getTime())
                    ? `${dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
                    : '—';
                const isEditing = editingLogId === log.id;
                return (
                  <li key={log.id} className="rounded-lg border border-[#EEEEEE] bg-[#FAFAFA] p-2.5">
                    <div className="flex items-start gap-2">
                      <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${typeBadge}`}>
                        {label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-neutral-500">{dateStr}</p>
                        {isEditing ? (
                          <div className="mt-1.5 space-y-2">
                            <textarea
                              className="w-full rounded-md border border-[#EEEEEE] bg-white px-2 py-1.5 text-sm text-ink"
                              rows={3}
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              disabled={activityMutating}
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={activityMutating}
                                className="rounded-md bg-mission-ink px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                                onClick={() => void saveEditLog()}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                disabled={activityMutating}
                                className="rounded-md border border-[#EEEEEE] bg-white px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-50"
                                onClick={cancelEditLog}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-0.5 text-sm text-neutral-800">{previewNotes(log.notes)}</p>
                        )}
                      </div>
                      {!isEditing ? (
                        <ActivityLogRowMenu
                          onEdit={() => beginEditLog(log)}
                          onDelete={() => void deleteLog(log.id)}
                        />
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {actionError ? (
          <p className="border-t border-[#EEEEEE] px-4 py-2 text-sm text-red-600">{actionError}</p>
        ) : null}

        <div className="grid grid-cols-2 gap-px border-t border-[#EEEEEE] bg-[#EEEEEE]">
          <button type="button" className={`${BTN_BORDERED} rounded-none`} onClick={onCall}>
            Call
          </button>
          <button type="button" className={`${BTN_BORDERED} rounded-none`} onClick={onText}>
            Text
          </button>
          <button
            type="button"
            className="flex min-h-[44px] items-center justify-center bg-mission-ink text-sm font-semibold text-white hover:opacity-90"
            onClick={onLog}
          >
            Log
          </button>
          <button
            type="button"
            className="flex min-h-[44px] items-center justify-center bg-neutral-900 text-sm font-semibold text-white hover:opacity-90"
            onClick={handleEdit}
          >
            Edit
          </button>
        </div>
      </div>
    </div>

      <Modal
        stackZIndex={340}
        open={taskModalOpen}
        title="Add task"
        onClose={() => {
          if (!newTaskSaving) {
            setTaskModalOpen(false);
            resetTaskModal();
          }
        }}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              type="button"
              disabled={newTaskSaving}
              onClick={() => {
                setTaskModalOpen(false);
                resetTaskModal();
              }}
            >
              Cancel
            </Button>
            <Button type="button" disabled={newTaskSaving} onClick={() => void saveNewContactTask()}>
              {newTaskSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      >
        {newTaskError ? <p className="mb-2 text-sm text-red-600">{newTaskError}</p> : null}
        <label className="block">
          <span className="text-xs font-semibold text-neutral-600">Title</span>
          <Input
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            className="mt-1"
            placeholder="What needs to happen?"
          />
        </label>
        <label className="mt-3 block">
          <span className="text-xs font-semibold text-neutral-600">Due date (optional)</span>
          <Input type="date" value={newTaskDue} onChange={(e) => setNewTaskDue(e.target.value)} className="mt-1" />
        </label>
        <p className="mt-3 text-xs text-neutral-500">This task is linked to {contact.fullName || 'this contact'}.</p>
      </Modal>
    </>,
    document.body,
  );
}
