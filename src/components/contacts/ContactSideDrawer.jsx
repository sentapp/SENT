import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input } from '../../components/ui';
import { useAuth } from '../../auth/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { categoryLabel, normalizeCategory } from '../../lib/contactCategories';
import { formatPhone, phoneDigits } from '../../lib/phoneFormat';
import { initialsFromDisplayName } from '../../lib/profileAppearance';
import { relationshipLabel } from '../../lib/contactRelationships';
import { notesWithoutSocialBlock, splitSocialFromNotes } from '../../lib/contactSocialInNotes';
import { statusLabel } from '../../lib/contactStatuses';
import { completeTask as completeTaskRepo, createTask, mapTaskRow } from '../../lib/tasksRepository';
import { ContactThreeQuickTagRows } from './QuickTagPopover';
import { PARTNER_DRAWER_BACKDROP_Z, PARTNER_DRAWER_PANEL_Z } from './quickViewOverlayZIndex';
import { getContactAvatarStyle } from '../../lib/contactAvatarStyles';

const SECTION_STRIP =
  'rounded-md bg-surface px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted';

const COMM_DOT = {
  call: 'bg-[#C17A00]',
  text: 'bg-emerald-500',
  meeting: 'bg-purple-500',
  note: 'bg-neutral-500',
  prayer: 'bg-amber-500',
  update: 'bg-neutral-400',
  email: 'bg-slate-500',
};

function cleanDisplayNotesBody(rawNotes) {
  const body = notesWithoutSocialBlock(rawNotes);
  if (!body) return '';
  const trimmed = body.toString().trim();
  if (/^\d+$/.test(trimmed)) return '';
  return trimmed;
}

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

function useDrawerNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const fn = () => setNarrow(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return narrow;
}

function commDotClass(commType) {
  const k = String(commType || '').toLowerCase();
  return COMM_DOT[k] || COMM_DOT.note;
}

function commLabel(commType) {
  const k = String(commType || '').toLowerCase();
  const map = {
    call: 'Call',
    text: 'Text',
    meeting: 'Meeting',
    note: 'Note',
    prayer: 'Prayer',
    update: 'Update',
    email: 'Email',
  };
  return map[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1) : 'Log');
}

function previewNotes(text, max = 140) {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return '—';
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * Contacts page hub drawer (slides in from the right), aligned with {@link PartnerSideDrawer}.
 *
 * @param {{
 *   contact: Record<string, unknown> | null,
 *   onClose: () => void,
 *   saveQuickTag?: (contact: Record<string, unknown>, field: string, value: string) => Promise<{ ok?: boolean }>,
 *   patchContactInList?: (id: string, partial: Record<string, unknown>) => void,
 *   onAfterQuickTagSave?: () => void,
 *   onPatchContact?: (next: Record<string, unknown>) => void,
 *   openEditForm: (c: Record<string, unknown>) => void,
 *   closeDrawerOnEdit?: boolean,
 *   onCall: () => void,
 *   onText: () => void,
 *   onLog: () => void,
 *   actionError?: string,
 *   activityLogsRefreshKey?: number,
 *   suppressEscape?: boolean,
 * }} props
 */
export function ContactSideDrawer({
  contact,
  onClose,
  saveQuickTag,
  patchContactInList,
  onAfterQuickTagSave,
  onPatchContact,
  openEditForm,
  closeDrawerOnEdit = true,
  onCall,
  onText,
  onLog,
  actionError = '',
  activityLogsRefreshKey = 0,
  suppressEscape = false,
}) {
  const { user } = useAuth();
  const narrow = useDrawerNarrow();
  const [entered, setEntered] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [newTaskSaving, setNewTaskSaving] = useState(false);
  const [newTaskError, setNewTaskError] = useState('');

  useLayoutEffect(() => {
    if (!contact) return undefined;
    setEntered(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact?.id]);

  useEffect(() => {
    setNewTaskTitle('');
    setNewTaskDue('');
    setNewTaskError('');
  }, [contact?.id]);

  const loadLogsAndTasks = useCallback(async () => {
    if (!supabase || !contact?.id || !user?.id) {
      setLogs([]);
      setTasks([]);
      return;
    }
    setLogsLoading(true);
    setTasksLoading(true);
    const [logsRes, tasksRes] = await Promise.all([
      supabase
        .from('communication_logs')
        .select('*')
        .eq('contact_id', contact.id)
        .eq('missionary_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('tasks')
        .select('*')
        .eq('contact_id', contact.id)
        .eq('missionary_id', user.id)
        .eq('is_complete', false)
        .order('due_date', { ascending: true }),
    ]);
    setLogsLoading(false);
    setTasksLoading(false);
    if (logsRes.error) {
      console.error('ContactSideDrawer communication_logs', logsRes.error);
      setLogs([]);
    } else {
      setLogs(logsRes.data || []);
    }
    if (tasksRes.error) {
      console.error('ContactSideDrawer tasks', tasksRes.error);
      setTasks([]);
    } else {
      setTasks((tasksRes.data || []).map(mapTaskRow));
    }
  }, [contact?.id, user?.id]);

  useEffect(() => {
    void loadLogsAndTasks();
  }, [loadLogsAndTasks, activityLogsRefreshKey]);

  useEffect(() => {
    if (!contact || suppressEscape) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [contact, suppressEscape, onClose]);

  const deleteLog = async (logId) => {
    if (!window.confirm('Delete this activity log?')) return;
    if (!supabase || !user?.id) return;
    const { error } = await supabase.from('communication_logs').delete().eq('id', logId).eq('missionary_id', user.id);
    if (error) {
      console.error(error);
      return;
    }
    void loadLogsAndTasks();
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
    setNewTaskTitle('');
    setNewTaskDue('');
    void loadLogsAndTasks();
  };

  const toggleContactTask = async (task) => {
    if (!supabase || !user?.id) return;
    if (!task.isComplete) {
      setTasks((prev) => prev.filter((x) => x.id !== task.id));
      await completeTaskRepo(supabase, task.id, user.id);
      void loadLogsAndTasks();
    }
  };

  if (!contact || typeof document === 'undefined') return null;

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
  const monthlyLine =
    Number.isFinite(monthly) && monthly > 0 ? (
      <p className="mt-0.5 text-sm font-semibold" style={{ color: '#2A9A58' }}>
        ${monthly.toFixed(0)}/mo
      </p>
    ) : null;

  const socialStr = social ? String(social).trim() : '';
  const socialHref =
    socialStr && /^https?:\/\//i.test(socialStr)
      ? socialStr
      : socialStr && /^www\./i.test(socialStr)
        ? `https://${socialStr}`
        : undefined;

  const handleEditContact = () => {
    if (closeDrawerOnEdit) onClose?.();
    openEditForm(contact);
  };

  const drawerWidth = narrow ? '100%' : 380;
  const transform = entered ? 'translateX(0)' : 'translateX(100%)';

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 cursor-default border-0 p-0 transition-opacity duration-200"
        style={{
          zIndex: PARTNER_DRAWER_BACKDROP_Z,
          backgroundColor: 'rgba(0,0,0,0.15)',
          opacity: entered ? 1 : 0,
          pointerEvents: entered ? 'auto' : 'none',
        }}
        aria-label="Close"
        onClick={onClose}
      />
      <aside
        className="fixed flex flex-col overflow-hidden bg-white"
        style={{
          top: 0,
          right: 0,
          bottom: 0,
          width: drawerWidth,
          zIndex: PARTNER_DRAWER_PANEL_Z,
          borderLeft: '1px solid #EEEEEE',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.08)',
          transform,
          transition: 'transform 0.25s ease-out',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-drawer-name"
      >
        <div className="sticky top-0 z-10 shrink-0 border-b border-[#EEEEEE] bg-white px-4 pb-3 pt-4">
          <div className="flex gap-3">
            <div
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              style={getContactAvatarStyle(contact.category)}
              aria-hidden
            >
              {initialsFromDisplayName(contact.fullName || '')}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{categoryDisp}</p>
              <p id="contact-drawer-name" className="truncate text-base font-semibold text-ink">
                {contact.fullName || 'Unnamed'}
              </p>
              {monthlyLine}
            </div>
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn text-lg leading-none text-neutral-500 hover:bg-neutral-100"
              aria-label="Close"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
          {saveQuickTag ? (
            <div className="mt-3 border-t border-[#EEEEEE]/80 pt-3" onClick={(e) => e.stopPropagation()}>
              <ContactThreeQuickTagRows
                contact={contact}
                saveQuickTag={saveQuickTag}
                patchContactInList={patchContactInList}
                onPatchContact={onPatchContact}
                onAfterSave={onAfterQuickTagSave}
                variant="compact"
                className="flex flex-col gap-1"
              />
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
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
              <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-800">{notesDisplay}</p>
            ) : (
              <p className="mt-2 text-sm italic text-neutral-500">No notes yet</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-px border-y border-[#EEEEEE] bg-[#EEEEEE] px-0">
            <button
              type="button"
              className="min-h-[44px] bg-white text-center text-sm font-semibold text-mission-ink hover:bg-mission-ink/5"
              onClick={onCall}
            >
              Call
            </button>
            <button
              type="button"
              className="min-h-[44px] bg-white text-center text-sm font-semibold text-mission-ink hover:bg-mission-ink/5"
              onClick={onText}
            >
              Text
            </button>
            <button
              type="button"
              className="min-h-[44px] bg-white text-center text-sm font-semibold text-mission-ink hover:bg-mission-ink/5"
              onClick={onLog}
            >
              Log
            </button>
          </div>

          {actionError ? <p className="px-4 py-2 text-sm text-red-600">{actionError}</p> : null}

          <div className="border-b border-[#EEEEEE] px-4 py-3">
            <div className={SECTION_STRIP}>Tasks</div>
            {tasksLoading ? (
              <p className="mt-2 text-sm text-neutral-500">Loading…</p>
            ) : tasks.length === 0 ? (
              <p className="mt-2 text-sm italic text-neutral-500">No open tasks for this contact</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-2 rounded-lg border border-[#EEEEEE] bg-[#FAFAFA] p-2.5">
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
            <div className="mt-3 space-y-2 border-t border-[#EEEEEE] pt-3">
              {newTaskError ? <p className="text-sm text-red-600">{newTaskError}</p> : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="min-w-0 flex-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">New task</span>
                  <Input
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="mt-1"
                    placeholder="Title"
                    disabled={newTaskSaving}
                  />
                </label>
                <label className="w-full shrink-0 sm:w-36">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Due</span>
                  <Input
                    type="date"
                    value={newTaskDue}
                    onChange={(e) => setNewTaskDue(e.target.value)}
                    className="mt-1"
                    disabled={newTaskSaving}
                  />
                </label>
                <Button type="button" className="w-full shrink-0 sm:w-auto" disabled={newTaskSaving} onClick={() => void saveNewContactTask()}>
                  {newTaskSaving ? 'Saving…' : 'Add'}
                </Button>
              </div>
            </div>
          </div>

          <div className="border-b border-[#EEEEEE] px-4 py-3">
            <div className={SECTION_STRIP}>Activity</div>
            {logsLoading ? (
              <p className="mt-2 text-sm text-neutral-500">Loading…</p>
            ) : logs.length === 0 ? (
              <p className="mt-2 text-sm italic text-neutral-500">No activity logged yet</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {logs.map((log) => {
                  const dt = log.created_at ? new Date(log.created_at) : null;
                  const dateStr =
                    dt && !Number.isNaN(dt.getTime())
                      ? `${dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
                      : '—';
                  const notePrev = previewNotes(log.notes);
                  return (
                    <li
                      key={log.id}
                      className="flex items-start gap-2 rounded-lg border border-[#EEEEEE] bg-[#FAFAFA] p-2.5"
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${commDotClass(log.comm_type)}`} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-semibold text-neutral-700">{commLabel(log.comm_type)}</span>
                          <span className="text-[11px] text-neutral-500">{dateStr}</span>
                        </div>
                        <p className="mt-0.5 text-sm text-neutral-800">{notePrev}</p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded-md px-2 py-1 text-lg leading-none text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                        aria-label="Delete log"
                        onClick={() => void deleteLog(log.id)}
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 z-10 shrink-0 border-t border-[#EEEEEE] bg-white p-3">
          <button
            type="button"
            className="w-full rounded-md border border-[#EEEEEE] bg-white py-2.5 text-center text-sm font-semibold text-mission-ink hover:bg-mission-ink/5"
            onClick={handleEditContact}
          >
            Edit contact
          </button>
        </div>
      </aside>
    </>,
    document.body,
  );
}
