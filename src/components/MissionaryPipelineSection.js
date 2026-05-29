import { Card } from './ui';

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
    <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="min-w-0">
        <p className="text-lg font-bold tracking-tight text-ink">Pipeline</p>
        <p className="mt-1 text-sm text-neutral-600">
          {pipelineLoading ? 'Loading…' : countLine}
        </p>
      </div>
      <button
        type="button"
        onClick={onOpenPipeline}
        disabled={pipelineLoading}
        className="shrink-0 rounded-[20px] bg-[#111] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        Open pipeline →
      </button>
    </Card>
  );
}
