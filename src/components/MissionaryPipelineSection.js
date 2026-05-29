import { useNavigate } from 'react-router-dom';
import { useContactDrawer } from '../context/ContactDrawerContext';
import { statusLabel } from '../lib/contactStatuses';
import { Card } from './ui';

const PIPELINE_STATUS_BADGE = {
  contacted: 'bg-sky-100 text-sky-900 ring-1 ring-sky-200/80',
  meeting_scheduled: 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80',
  committed: 'bg-violet-100 text-violet-900 ring-1 ring-violet-200/80',
};

function pipelineStatusBadgeClass(status) {
  return PIPELINE_STATUS_BADGE[status] || 'bg-neutral-100 text-neutral-800 ring-1 ring-neutral-200/80';
}

export default function MissionaryPipelineSection({
  pipelineContacts,
  pipelineInProgressCount = 0,
  pipelineLoading,
}) {
  const navigate = useNavigate();

  const goPipeline = () => {
    navigate('/missionary/pipeline');
  };

  const countLine =
    pipelineInProgressCount === 1
      ? '1 contact in progress'
      : `${pipelineInProgressCount} contacts in progress`;

  const showSeeAll = pipelineInProgressCount > 5;

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-baseline justify-between gap-3 border-b border-neutral-100 bg-neutral-50/70 px-5 py-4 md:px-6">
        <h2 className="text-lg font-bold tracking-tight text-ink md:text-xl">Pipeline</h2>
        <button
          type="button"
          onClick={goPipeline}
          className="shrink-0 text-sm font-semibold text-mission-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-ink/25 focus-visible:ring-offset-2"
        >
          Open pipeline →
        </button>
      </div>

      <div className="space-y-4 p-5 md:p-6">
        {pipelineLoading ? (
          <p className="text-sm text-neutral-500">Loading pipeline…</p>
        ) : pipelineInProgressCount === 0 ? (
          <p className="text-sm leading-relaxed text-neutral-600">
            No contacts in progress yet — move people through stages on the Pipeline page.
          </p>
        ) : (
          <>
            <p className="text-sm text-neutral-600">{countLine}</p>
            <ul className="list-disc space-y-2 pl-5 text-sm marker:text-neutral-400">
              {pipelineContacts.map((c) => (
                <li key={c.id} className="pl-0.5">
                  <span className="inline-flex flex-wrap items-baseline gap-2">
                    <span className="font-medium text-ink">{c.fullName || 'Unnamed'}</span>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${pipelineStatusBadgeClass(c.status)}`}
                    >
                      {statusLabel(c.status)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {showSeeAll ? (
              <button
                type="button"
                onClick={goPipeline}
                className="text-sm font-semibold text-mission-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-ink/25 focus-visible:ring-offset-2"
              >
                See all →
              </button>
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
}
