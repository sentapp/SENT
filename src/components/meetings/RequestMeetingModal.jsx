import { useEffect, useState } from 'react';
import { submitMeetingRequest } from '../../lib/meetingRequestsRepository';
import { todayStr } from '../../lib/meetingDateUtils';
import { Button, Input, Modal } from '../ui';

export default function RequestMeetingModal({
  open,
  onClose,
  supabase,
  missionaryId,
  missionaryName = 'your missionary',
  requesterId,
  requesterName = '',
  onSubmitted,
}) {
  const [date, setDate] = useState(todayStr());
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDate(todayStr());
    setMessage('');
    setError('');
  }, [open]);

  const handleClose = () => {
    if (saving) return;
    onClose?.();
  };

  const handleSubmit = async () => {
    if (!requesterId || !missionaryId) return;
    setError('');
    if (!date) {
      setError('Please pick a date.');
      return;
    }
    setSaving(true);
    const res = await submitMeetingRequest(supabase, {
      missionaryId,
      requesterId,
      requesterName,
      requestedDate: date,
      message,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error || 'Could not send request.');
      return;
    }
    onClose?.();
    onSubmitted?.(res.request);
  };

  return (
    <Modal
      open={open}
      title={`Request a meeting with ${missionaryName}`}
      onClose={handleClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" disabled={saving} onClick={handleClose}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={() => void handleSubmit()}>
            {saving ? 'Sending…' : 'Send request'}
          </Button>
        </div>
      }
    >
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      <p className="mb-4 text-sm text-neutral-600">
        Choose a date that works for you. {missionaryName} will confirm or suggest another time.
      </p>
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-semibold text-neutral-600">Preferred date</span>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" required />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-600">Message (optional)</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-btn border border-[#EEEEEE] px-3 py-2 text-sm"
            placeholder="Anything they should know…"
          />
        </label>
      </div>
    </Modal>
  );
}
