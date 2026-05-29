export default function MissionaryPipelineSection({
  pipelineInProgressCount = 0,
  pipelineLoading,
  onOpenPipeline,
}) {
  const countLine =
    pipelineInProgressCount === 1
      ? '1 contact in progress'
      : `${pipelineInProgressCount} contacts in progress`;

  return (
    <div
      className="flex items-center justify-between gap-3 bg-white"
      style={{ padding: '12px 16px', borderBottom: '0.5px solid #EEEEEE' }}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">Pipeline</p>
        <p className="mt-0.5 text-xs text-neutral-600">{pipelineLoading ? 'Loading…' : countLine}</p>
      </div>
      <button
        type="button"
        onClick={onOpenPipeline}
        disabled={pipelineLoading}
        className="shrink-0 rounded-[20px] bg-[#111] px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        Open pipeline →
      </button>
    </div>
  );
}
