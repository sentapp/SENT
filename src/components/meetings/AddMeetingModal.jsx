import { useEffect, useMemo, useState } from 'react';
import { createMeeting } from '../../lib/meetingsRepository';
import { todayStr } from '../../lib/meetingDateUtils';
import { Button, Input, Modal } from '../ui';

export default function AddMeetingModal({
  open,
  onClose,
  supabase,
  missionaryId,
  contacts = [],
  initialContactId = '',
  initialContactName = '',
  initialDate = '',
  onSaved,
}) {
  const [addContactId, setAddContactId] = useState('');
  const [addContactQuery, setAddContactQuery] = useState('');
  const [addDate, setAddDate] = useState(todayStr());
  const [addTime, setAddTime] = useState('');
  const [addType, setAddType] = useState('initial');
  const [addNotes, setAddNotes] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => {
    if (!open) return;
    setAddContactId(initialContactId || '');
    setAddContactQuery(initialContactName || '');
    setAddDate(initialDate || todayStr());
    setAddTime('');
    setAddType('initial');
    setAddNotes('');
    setAddError('');
  }, [open, initialContactId, initialContactName, initialDate]);

  const contactPickList = useMemo(() => {
    const q = addContactQuery.trim().toLowerCase();
    const base = q
      ? contacts.filter(
          (c) =>
            (c.fullName || '').toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q) ||
            (c.phone || '').toLowerCase().includes(q),
        )
      : contacts;
    return base.slice(0, 12);
  }, [contacts, addContactQuery]);

  const resetForm = () => {
    setAddContactId('');
    setAddContactQuery('');
    setAddDate(todayStr());
    setAddTime('');
    setAddType('initial');
    setAddNotes('');
    setAddError('');
  };

  const handleClose = () => {
    if (addSaving) return;
    onClose?.();
    resetForm();
  };

  const handleSave = async () => {
    if (!missionaryId) return;
    setAddError('');
    if (!addDate) {
      setAddError('Date is required.');
      return;
    }
    const contact = addContactId ? contacts.find((c) => String(c.id) === String(addContactId)) : null;
    const contactName = contact?.fullName || addContactQuery.trim() || 'Meeting';

    setAddSaving(true);
    const res = await createMeeting(supabase, {
      missionaryId,
      contactId: addContactId || null,
      contactName,
      meetingDate: addDate,
      meetingTime: addTime || null,
      meetingType: addType,
      notes: addNotes,
    });
    setAddSaving(false);
    if (!res.ok) {
      setAddError(res.error || 'Could not save.');
      return;
    }
    onClose?.();
    resetForm();
    onSaved?.(res.meeting);
  };

  return (
    <Modal
      open={open}
      title="Add meeting"
      onClose={handleClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" disabled={addSaving} onClick={handleClose}>
            Cancel
          </Button>
          <Button type="button" disabled={addSaving} onClick={() => void handleSave()}>
            {addSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      }
    >
      {addError ? <p className="mb-3 text-sm text-red-600">{addError}</p> : null}
      <div className="space-y-4">
        <div>
          <span className="text-xs font-semibold text-neutral-600">Contact</span>
          <Input
            value={addContactQuery}
            onChange={(e) => {
              setAddContactQuery(e.target.value);
              setAddContactId('');
            }}
            placeholder="Search contacts…"
            className="mt-1"
          />
          {addContactId ? (
            <p className="mt-2 text-xs text-neutral-600">
              Selected:{' '}
              <span className="font-medium text-ink">
                {contacts.find((c) => String(c.id) === String(addContactId))?.fullName || addContactQuery || 'Contact'}
              </span>{' '}
              <button
                type="button"
                className="font-semibold text-mission-ink hover:underline"
                onClick={() => {
                  setAddContactId('');
                  setAddContactQuery('');
                }}
              >
                Clear
              </button>
            </p>
          ) : null}
          {!addContactId && addContactQuery.trim() ? (
            <ul className="mt-2 max-h-40 overflow-y-auto rounded-md border border-[#EEEEEE] bg-white text-sm">
              {contactPickList.length === 0 ? (
                <li className="px-3 py-2 text-neutral-500">No matches</li>
              ) : (
                contactPickList.map((c) => (
                  <li key={c.id} className="border-b border-[#F5F5F5] last:border-b-0">
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-surface"
                      onClick={() => {
                        setAddContactId(c.id);
                        setAddContactQuery(c.fullName || '');
                      }}
                    >
                      {c.fullName || 'Unnamed'}
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-600">Date</span>
          <Input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} className="mt-1" required />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-600">Time (optional)</span>
          <Input type="time" value={addTime} onChange={(e) => setAddTime(e.target.value)} className="mt-1" />
        </label>
        <div>
          <span className="text-xs font-semibold text-neutral-600">Type</span>
          <div className="mt-2 flex gap-2">
            {[
              { value: 'initial', label: 'Initial meeting' },
              { value: 'followup', label: 'Follow up' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAddType(opt.value)}
                className={`rounded-btn border px-3 py-1.5 text-xs font-medium ${
                  addType === opt.value
                    ? 'border-green bg-green-light text-green'
                    : 'border-[#EEEEEE] text-neutral-700 hover:bg-surface'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-600">Notes (optional)</span>
          <textarea
            value={addNotes}
            onChange={(e) => setAddNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-btn border border-[#EEEEEE] px-3 py-2 text-sm"
            placeholder="Anything to remember…"
          />
        </label>
      </div>
    </Modal>
  );
}
