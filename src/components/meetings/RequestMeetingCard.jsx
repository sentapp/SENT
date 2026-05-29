import { useState } from 'react';
import { Card } from '../ui';
import RequestMeetingModal from './RequestMeetingModal';
import { supabase } from '../../lib/supabaseClient';

export default function RequestMeetingCard({
  missionaryId,
  missionaryName,
  requesterId,
  requesterName,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  if (!missionaryId || !requesterId) return null;

  return (
    <>
      <Card className={`border border-[#EEEEEE] p-5 ${className}`}>
        <p className="text-sm font-medium text-ink">Meet in person?</p>
        <p className="mt-1 text-sm text-neutral-600">
          Request a meeting with {missionaryName}. They will follow up to confirm.
        </p>
        {sent ? (
          <p className="mt-4 text-sm font-medium text-accent">Request sent — they will be in touch.</p>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-4 w-full rounded-btn border border-[color:var(--feed-accent,var(--accent))] bg-white px-4 py-3 text-sm font-semibold text-[color:var(--feed-accent,var(--accent))] transition hover:bg-[color:color-mix(in_srgb,var(--feed-accent,var(--accent))_8%,white)]"
          >
            Request a meeting with {missionaryName}
          </button>
        )}
      </Card>
      <RequestMeetingModal
        open={open}
        onClose={() => setOpen(false)}
        supabase={supabase}
        missionaryId={missionaryId}
        missionaryName={missionaryName}
        requesterId={requesterId}
        requesterName={requesterName}
        onSubmitted={() => {
          setSent(true);
          setOpen(false);
        }}
      />
    </>
  );
}
