import { useState } from 'react';
import { Button, Card, Label, Textarea } from './ui';
import { isFeedbackConfigured, submitFeedback } from '../lib/feedback';

const FEEDBACK_OPTIONS = ['Bug report', 'Feature request', 'General feedback'];

export default function FeedbackSection() {
  const [type, setType] = useState(FEEDBACK_OPTIONS[0]);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | success | error
  const [error, setError] = useState('');

  const configured = isFeedbackConfigured();

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setStatus('sending');
    const result = await submitFeedback({ typeLabel: type, message });
    if (result.ok) {
      setStatus('success');
      setMessage('');
    } else {
      setStatus('error');
      setError(result.error || 'Something went wrong.');
    }
  };

  return (
    <Card className="p-5">
      <p className="text-sm font-semibold">Feedback</p>
      <p className="mt-1 text-sm text-neutral-600">Help us improve SENT.</p>

      {!configured ? (
        <p className="mt-4 rounded-btn border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-[#854F0B]">
          Connect Supabase in <code className="text-xs">.env.local</code> to submit feedback to the database.
        </p>
      ) : null}

      {status === 'success' ? (
        <p className="mt-4 rounded-btn border border-mission-green/30 bg-mission-green/10 px-4 py-3 text-sm font-medium text-mission-green">
          Thank you — we&apos;ll review this soon
        </p>
      ) : null}

      {status === 'error' && error ? (
        <p className="mt-4 rounded-btn border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <Label title="What type of feedback?">
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              if (status === 'success') setStatus('idle');
            }}
            disabled={!configured || status === 'sending'}
            className="w-full rounded-btn border border-neutral-200 px-4 py-[14px] text-[16px] outline-none focus:border-mission-blue disabled:bg-neutral-100"
          >
            {FEEDBACK_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Label>
        <Label title="Tell us what's on your mind...">
          <Textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (status === 'success') setStatus('idle');
            }}
            disabled={!configured || status === 'sending'}
            placeholder="Tell us what's on your mind..."
            rows={4}
          />
        </Label>
        <div className="flex justify-end">
          <Button type="submit" disabled={!configured || status === 'sending' || !message.trim()}>
            {status === 'sending' ? 'Sending…' : 'Submit feedback'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
