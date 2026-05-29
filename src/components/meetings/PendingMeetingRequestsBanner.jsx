import { useNavigate } from 'react-router-dom';
import { formatMeetingDate } from '../../lib/meetingDateUtils';

/**
 * Amber alert when supporters have requested meetings.
 * @param {{ pending: { requesterName?: string, requestedDate?: string }[], className?: string }} props
 */
export default function PendingMeetingRequestsBanner({ pending, className = '' }) {
  const navigate = useNavigate();
  if (!pending?.length) return null;

  const names = pending
    .map((r) => (r.requesterName || 'Supporter').trim())
    .filter(Boolean)
    .slice(0, 4);
  const namesLine =
    names.length > 0
      ? names.join(', ') + (pending.length > names.length ? ` +${pending.length - names.length} more` : '')
      : '';

  return (
    <div
      className={`rounded-card border border-amber-300/80 bg-amber-50 px-4 py-3 text-amber-950 ${className}`}
      role="status"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {pending.length} meeting request{pending.length === 1 ? '' : 's'} waiting
          </p>
          {namesLine ? <p className="mt-0.5 truncate text-sm text-amber-900/90">{namesLine}</p> : null}
          {pending[0]?.requestedDate ? (
            <p className="mt-0.5 text-xs text-amber-800/80">
              Next preferred date: {formatMeetingDate(pending[0].requestedDate)}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => navigate('/missionary/meetings')}
          className="shrink-0 rounded-btn bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
        >
          Review
        </button>
      </div>
    </div>
  );
}
