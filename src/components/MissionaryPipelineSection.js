import { useNavigate } from 'react-router-dom';
import { CONTACT_STATUS_FORM_OPTIONS, statusLabel } from '../lib/contactStatuses';
import { Card } from './ui';

const PIPELINE_STATUS_BADGE = {
  asked: 'bg-violet-100 text-violet-900 ring-1 ring-violet-200/80',
  contacted: 'bg-sky-100 text-sky-900 ring-1 ring-sky-200/80',
  meeting_scheduled: 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80',
};

function pipelineStatusBadgeClass(status) {
  return PIPELINE_STATUS_BADGE[status] || 'bg-neutral-100 text-neutral-800 ring-1 ring-neutral-200/80';
}

export default function MissionaryPipelineSection({
  pipelineContacts,
  pipelineLoading,
  pipelineError,
  pipelineSavingId,
  onChangeStatus,
}) {
  const navigate = useNavigate();

  const goContacts = () => {
    navigate('/missionary/contacts');
  };

  const openContact = (id) => {
    navigate(`/missionary/contacts?edit=${encodeURIComponent(id)}`);
  };

  return (
    <Card className="overflow-hidden p-0 shadow-card">
      <button
        type="button"
        aria-label="Pipeline — open all contacts"
        onClick={goContacts}
        className="flex w-full cursor-pointer items-start justify-between gap-4 border-b border-neutral-100 bg-neutral-50/70 px-5 py-5 text-left transition hover:bg-neutral-100/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-blue/25 focus-visible:ring-inset md:px-6 md:py-6"
      >
        <div className="min-w-0 space-y-1.5">
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 md:text-2xl">Pipeline</h2>
          <p className="text-sm text-neutral-600">
            Asked, contacted, or meeting scheduled — newest first (up to 10).
          </p>
        </div>
        <span className="shrink-0 pt-1 text-sm font-semibold text-mission-blue">View all</span>
      </button>

      <div className="space-y-4 p-5 md:p-6">
        {pipelineError ? <p className="text-xs font-medium text-red-600">{pipelineError}</p> : null}
        {pipelineLoading ? (
          <p className="text-sm text-neutral-500">Loading pipeline…</p>
        ) : pipelineContacts.length === 0 ? (
          <p className="text-sm leading-relaxed text-neutral-600">
            No contacts in pipeline — add contacts and mark them as contacted or asked
          </p>
        ) : (
          <div className="space-y-4">
            {pipelineContacts.map((c) => (
              <Card
                key={c.id}
                role="button"
                tabIndex={0}
                aria-label={`Open ${c.fullName || 'contact'} in contacts`}
                onClick={() => openContact(c.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openContact(c.id);
                  }
                }}
                className="cursor-pointer border-neutral-200 p-5 transition hover:border-mission-blue/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-blue/25 md:p-6"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-base font-bold text-neutral-900">{c.fullName || 'Unnamed'}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${pipelineStatusBadgeClass(c.status)}`}
                      >
                        {statusLabel(c.status)}
                      </span>
                      {Number(c.monthlyAmount) > 0 ? (
                        <span className="text-xs font-medium text-neutral-600">
                          ${Number(c.monthlyAmount).toFixed(0)}/mo
                        </span>
                      ) : null}
                    </div>
                    {c.phone ? (
                      <p className="text-sm text-neutral-600">{c.phone}</p>
                    ) : (
                      <p className="text-xs text-neutral-400">No phone on file</p>
                    )}
                  </div>
                  <div
                    className="flex shrink-0 flex-col gap-1.5 lg:min-w-[200px] lg:items-end"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <span className="text-xs font-medium text-neutral-600">Update status</span>
                    <select
                      aria-label={`Update status for ${c.fullName || 'contact'}`}
                      className="w-full max-w-full rounded-btn border border-neutral-200 bg-white py-2.5 pl-3 pr-8 text-sm font-semibold text-neutral-800 lg:max-w-[240px]"
                      value={c.status}
                      disabled={pipelineSavingId === c.id}
                      onChange={(e) => void onChangeStatus(c, e.target.value)}
                    >
                      {CONTACT_STATUS_FORM_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
