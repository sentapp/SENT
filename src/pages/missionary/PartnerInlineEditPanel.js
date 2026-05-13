import { CONTACT_CATEGORY_FORM_OPTIONS } from '../../lib/contactCategories';
import { Button, Input, Label, Textarea } from '../../components/ui';

/** Partners page — subset of `contact_status` (DB-aligned labels per product copy). */
export const PARTNER_INLINE_STATUS_OPTIONS = [
  { value: 'partner', label: 'Partner' },
  { value: 'committed', label: 'Committed' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'declined', label: 'Not Interested' },
];

export function partnerToDraft(p) {
  if (!p) {
    return {
      fullName: '',
      phone: '',
      email: '',
      monthlyAmount: '',
      category: 'supporter',
      status: 'partner',
      notes: '',
      address: '',
      isOneTimeDonor: false,
      oneTimeDonationAmount: '',
      oneTimeDonationDate: '',
    };
  }
  return {
    fullName: p.fullName ?? '',
    phone: p.phone ?? '',
    email: p.email ?? '',
    monthlyAmount:
      p.monthlyAmount != null && Number.isFinite(Number(p.monthlyAmount)) ? String(p.monthlyAmount) : '',
    // Uncategorized contacts surface as `null` from the DB; PartnerInlineEditPanel uses the literal
    // string 'none' so the <select> can show a stable option (saves coerce back to null).
    category: p.category ?? 'none',
    status: p.status ?? 'partner',
    notes: p.notes ?? '',
    address: p.address ?? '',
    isOneTimeDonor: Boolean(p.isOneTimeDonor),
    oneTimeDonationAmount:
      p.oneTimeDonationAmount != null && Number.isFinite(Number(p.oneTimeDonationAmount))
        ? String(p.oneTimeDonationAmount)
        : '',
    oneTimeDonationDate: p.oneTimeDonationDate ? String(p.oneTimeDonationDate).slice(0, 10) : '',
  };
}

export function serializeDraft(d) {
  return JSON.stringify({
    fullName: d.fullName,
    phone: d.phone,
    email: d.email,
    monthlyAmount: d.monthlyAmount,
    category: d.category,
    status: d.status,
    notes: d.notes,
    address: d.address,
    isOneTimeDonor: d.isOneTimeDonor,
    oneTimeDonationAmount: d.oneTimeDonationAmount,
    oneTimeDonationDate: d.oneTimeDonationDate,
  });
}

const selectClass =
  'w-full rounded-btn border border-mission-line bg-surface px-4 py-[14px] text-[14px] font-normal text-mission-ink outline-none ring-accent/25 transition-colors duration-200 focus:border-accent focus:ring';

/**
 * Inline edit fields for an expanded partner row (not a modal).
 */
export function PartnerInlineEditPanel({
  draft,
  onChange,
  saveError,
  saving,
  onSave,
  onCancel,
  schemaPartial,
}) {
  const set = (patch) => onChange({ ...draft, ...patch });

  return (
    <div className="space-y-4 p-4 sm:p-5">
      {saveError ? <p className="text-sm text-red-700">{saveError}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Label title="Full name">
          <Input value={draft.fullName} onChange={(e) => set({ fullName: e.target.value })} autoComplete="name" />
        </Label>
        <Label title="Phone">
          <Input value={draft.phone} onChange={(e) => set({ phone: e.target.value })} type="tel" autoComplete="tel" />
        </Label>
        <Label title="Email">
          <Input value={draft.email} onChange={(e) => set({ email: e.target.value })} type="email" autoComplete="email" />
        </Label>
        <Label title="Monthly amount">
          <div className="flex overflow-hidden rounded-btn border border-mission-line bg-surface ring-accent/25 transition-colors duration-200 focus-within:border-accent focus-within:ring">
            <span className="flex shrink-0 items-center border-r border-mission-line bg-[color:var(--color-bg)] px-3 text-sm text-mission-muted">
              $
            </span>
            <Input
              className="rounded-none border-0 ring-0 focus:ring-0"
              inputMode="decimal"
              value={draft.monthlyAmount}
              onChange={(e) => set({ monthlyAmount: e.target.value })}
              placeholder="0"
            />
          </div>
        </Label>
        <Label title="Category">
          <select
            className={selectClass}
            value={draft.category ?? 'none'}
            onChange={(e) => set({ category: e.target.value })}
          >
            {CONTACT_CATEGORY_FORM_OPTIONS.map(({ id, label }) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </Label>
        <Label title="Status">
          <select className={selectClass} value={draft.status} onChange={(e) => set({ status: e.target.value })}>
            {PARTNER_INLINE_STATUS_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Label>
      </div>

      <Label title="Address">
        <Input value={draft.address} onChange={(e) => set({ address: e.target.value })} disabled={schemaPartial} />
        {schemaPartial ? (
          <p className="sent-body mt-1 text-xs text-mission-muted">Address requires the latest database migration.</p>
        ) : null}
      </Label>

      <Label title="Notes">
        <Textarea rows={4} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
      </Label>

      <div className="rounded-btn border border-mission-line bg-surface p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-mission-line text-accent focus:ring-accent"
            checked={draft.isOneTimeDonor}
            onChange={(e) => set({ isOneTimeDonor: e.target.checked })}
            disabled={schemaPartial}
          />
          <span>
            <span className="sent-section-label block">One-time donor</span>
            <span className="sent-body text-xs text-mission-muted">Optional gift separate from monthly support.</span>
          </span>
        </label>
        {draft.isOneTimeDonor && !schemaPartial ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Label title="One-time amount">
              <div className="flex overflow-hidden rounded-btn border border-mission-line bg-surface focus-within:border-accent focus-within:ring focus-within:ring-accent/25">
                <span className="flex shrink-0 items-center border-r border-mission-line bg-[color:var(--color-bg)] px-3 text-sm text-mission-muted">
                  $
                </span>
                <Input
                  className="rounded-none border-0 ring-0 focus:ring-0"
                  inputMode="decimal"
                  value={draft.oneTimeDonationAmount}
                  onChange={(e) => set({ oneTimeDonationAmount: e.target.value })}
                />
              </div>
            </Label>
            <Label title="Gift date">
              <Input
                type="date"
                value={draft.oneTimeDonationDate}
                onChange={(e) => set({ oneTimeDonationDate: e.target.value })}
              />
            </Label>
          </div>
        ) : null}
        {schemaPartial && draft.isOneTimeDonor ? (
          <p className="sent-body mt-2 text-xs text-mission-muted">One-time donor fields require the latest migration.</p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={saving} onClick={onSave}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="secondary" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
