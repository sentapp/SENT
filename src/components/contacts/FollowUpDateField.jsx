import { addDaysFromNow, localDateStr } from '../../lib/dateHelpers';

const QUICK_DAYS = [
  { label: '1 mo', days: 30 },
  { label: '3 mo', days: 90 },
  { label: '6 mo', days: 180 },
];

/**
 * Follow-up date picker for `not_right_now` contacts (edit form + drawer).
 */
export default function FollowUpDateField({ value, onChange, className = '' }) {
  return (
    <div className={className}>
      <p className="mb-1.5 text-[11px] font-medium text-[#6040B0]">When should we circle back?</p>
      <input
        type="date"
        value={value || ''}
        min={localDateStr()}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[#C8BCF5] bg-[#FAFAFA] px-2.5 py-2 text-xs text-ink"
      />
      <div className="mt-1.5 flex gap-1.5">
        {QUICK_DAYS.map(({ label, days }) => (
          <button
            key={days}
            type="button"
            onClick={() => onChange(addDaysFromNow(days))}
            className="flex-1 rounded-md border border-[#EEEEEE] bg-transparent px-1 py-1.5 text-[10px] text-neutral-500 transition hover:border-[#C8BCF5] hover:text-[#6040B0]"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
