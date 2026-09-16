import { useEffect, useState } from 'react';
import { submitMeetingRequest } from '../../lib/meetingRequestsRepository';
import { todayStr } from '../../lib/meetingDateUtils';
import { Button, Input } from '../ui';

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '20px',
};

const contentStyle = {
  background: 'white',
  borderRadius: 20,
  padding: '24px',
  width: '100%',
  maxWidth: 480,
  maxHeight: '90vh',
  overflowY: 'auto',
  position: 'relative',
};

const closeButtonStyle = {
  position: 'absolute',
  top: 16,
  right: 16,
  background: 'none',
  border: 'none',
  fontSize: 20,
  color: '#888',
  cursor: 'pointer',
};

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

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
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

  if (!open) return null;

  return (
    <div
      style={overlayStyle}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div style={contentStyle} role="dialog" aria-modal="true" aria-labelledby="request-meeting-title">
        <button type="button" onClick={handleClose} aria-label="Close" style={closeButtonStyle}>
          ×
        </button>
        <p id="request-meeting-title" className="sent-section-title pr-8">
          Request a meeting with {missionaryName}
        </p>
        {error ? <p className="mb-3 mt-4 text-sm text-red-600">{error}</p> : null}
        <p className={`text-sm text-neutral-600 ${error ? '' : 'mt-4'}`}>
          Choose a date that works for you. {missionaryName} will confirm or suggest another time.
        </p>
        <div className="mt-4 space-y-4">
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
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" type="button" disabled={saving} onClick={handleClose}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} onClick={() => void handleSubmit()}>
            {saving ? 'Sending…' : 'Send request'}
          </Button>
        </div>
      </div>
    </div>
  );
}
