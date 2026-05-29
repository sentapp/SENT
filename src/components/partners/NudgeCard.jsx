import { Button } from '../ui';
import { ContactThreeQuickTagRows } from '../contacts/QuickTagPopover';
import { getContactAvatarStyle } from '../../lib/contactAvatarStyles';
import { formatMonthlyAmount } from '../../lib/currencies';

/** Overdue monthly partner row with reach-out CTA. */
export default function NudgeCard({
  partner,
  initials,
  lastContactIso,
  daysSinceContactLabel,
  savedNoticeId,
  onOpen,
  onReachOut,
  saveQuickTag,
  patchContactInList,
  onAfterSave,
  onPatchContact,
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className="group cursor-pointer overflow-hidden rounded-[12px] border-[0.5px] border-border border-l-[3px] border-l-rose-600 bg-white text-left outline-none transition-colors duration-200 ease-out hover:bg-surface focus-visible:ring-2 focus-visible:ring-green/25"
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            style={getContactAvatarStyle(partner.category)}
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="block truncate font-semibold text-ink">{partner.fullName || 'Unnamed partner'}</span>
              {savedNoticeId === partner.id ? (
                <span className="text-xs font-semibold text-emerald-700">Saved</span>
              ) : null}
            </span>
            <span className="mt-0.5 block text-xs text-neutral-600">
              {formatMonthlyAmount(partner.monthlyAmount, partner.currency)}
            </span>
            <span className="mt-0.5 block text-xs font-medium text-[#A32D2D]">{daysSinceContactLabel(lastContactIso)}</span>
            <div className="mt-2">
              <ContactThreeQuickTagRows
                contact={partner}
                saveQuickTag={saveQuickTag}
                patchContactInList={patchContactInList}
                onAfterSave={onAfterSave}
                onPatchContact={onPatchContact}
                variant="compact"
                className="flex flex-col gap-1"
              />
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-start sm:items-center" onClick={(e) => e.stopPropagation()}>
          <Button
            type="button"
            variant="danger"
            className="w-full min-w-[7.5rem] sm:w-auto"
            onClick={(e) => {
              e.stopPropagation();
              onReachOut();
            }}
          >
            Reach out
          </Button>
        </div>
      </div>
    </div>
  );
}
