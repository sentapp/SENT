import { CONTACT_CATEGORY_FORM_OPTIONS, categoryLabel, getCategoryTagColors } from '../../lib/contactCategories';
import { CONTACT_STATUS_FORM_OPTIONS, STATUS_TAG_COLORS, normalizeStatusFromDb, statusLabel } from '../../lib/contactStatuses';
import { initialsFromDisplayName } from '../../lib/profileAppearance';
import { Input, Label, Textarea } from '../../components/ui';

function pillButtonClass(selected) {
  return [
    'min-h-[44px] rounded-full border px-3 py-2 text-center text-xs font-semibold leading-tight transition sm:text-sm',
    selected
      ? 'border-[#185FA5] bg-white text-[#185FA5] shadow-sm ring-2 ring-[#185FA5]/20'
      : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300',
  ].join(' ');
}

function ContactFormHeaderTags({ category, status }) {
  const st = normalizeStatusFromDb(status);
  if (st === 'partner') {
    const stSt = STATUS_TAG_COLORS.partner;
    return (
      <div className="flex flex-wrap gap-1.5">
        <span
          className="inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
          style={{
            backgroundColor: stSt.bg,
            color: stSt.text,
            borderColor: stSt.border,
          }}
        >
          {statusLabel('partner')}
        </span>
      </div>
    );
  }
  const catSt = getCategoryTagColors(category);
  return (
    <div className="flex flex-wrap gap-1.5">
      {catSt ? (
        <span
          className="inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
          style={{
            backgroundColor: catSt.bg,
            color: catSt.text,
            borderColor: catSt.border,
          }}
        >
          {categoryLabel(category)}
        </span>
      ) : null}
      {st !== 'prospect' ? (
        (() => {
          const stSt = STATUS_TAG_COLORS[st] || STATUS_TAG_COLORS.prospect;
          return (
            <span
              className="inline-flex max-w-full items-center truncate rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
              style={{
                backgroundColor: stSt.bg,
                color: stSt.text,
                borderColor: stSt.border,
              }}
            >
              {statusLabel(status)}
            </span>
          );
        })()
      ) : null}
    </div>
  );
}

/**
 * Layout A: avatar + tags header, sectioned fields (add + edit).
 * @param {{
 *   form: Record<string, unknown>,
 *   setForm: (fn: (f: any) => any) => void,
 *   phoneDupWarn: { id: string, fullName?: string } | null,
 *   emailDupWarn: { id: string, fullName?: string } | null,
 *   scrollToContact: (id: string) => void,
 * }} props
 */
export default function ContactEditFormLayout({ form, setForm, phoneDupWarn, emailDupWarn, scrollToContact }) {
  const name = String(form.fullName ?? '');
  const initials = initialsFromDisplayName(name);
  const oneTimeNum = Number.parseFloat(String(form.oneTimeDonationAmount ?? '').replace(/,/g, ''));
  const showOneTimeDate = Number.isFinite(oneTimeNum) && oneTimeNum > 0;

  return (
    <div className="space-y-6">
      <div className="flex gap-3 border-b border-mission-line pb-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#185FA5] text-[15px] font-medium leading-none text-white"
          aria-hidden
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium leading-tight text-[#1C1917]">
            {name.trim() || 'New contact'}
          </p>
          <div className="mt-2">
            <ContactFormHeaderTags category={form.category} status={form.status} />
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-mission-muted">Contact info</h3>
        <Label title="Full name">
          <Input
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            placeholder="Full name"
          />
        </Label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label title="Phone">
              <Input
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="(555) 555‑5555"
              />
            </Label>
            {phoneDupWarn ? (
              <p className="mt-2 text-xs leading-snug text-amber-800">
                A contact with this phone number already exists — {phoneDupWarn.fullName || 'Unnamed'}{' '}
                <button
                  type="button"
                  className="font-semibold text-mission-blue underline"
                  onClick={() => scrollToContact(phoneDupWarn.id)}
                >
                  View contact
                </button>
              </p>
            ) : null}
          </div>
          <div>
            <Label title="Email">
              <Input
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="name@example.com"
              />
            </Label>
            {emailDupWarn ? (
              <p className="mt-2 text-xs leading-snug text-amber-800">
                A contact with this email already exists — {emailDupWarn.fullName || 'Unnamed'}{' '}
                <button
                  type="button"
                  className="font-semibold text-mission-blue underline"
                  onClick={() => scrollToContact(emailDupWarn.id)}
                >
                  View contact
                </button>
              </p>
            ) : null}
          </div>
        </div>
        <Label title="Address">
          <Input
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="Street, city, state, ZIP"
          />
        </Label>
        <Label title="Social">
          <Input
            value={form.social}
            onChange={(e) => setForm((f) => ({ ...f, social: e.target.value }))}
            placeholder="Instagram, Facebook…"
          />
        </Label>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-mission-muted">Who are they?</h3>
        <div className="flex flex-wrap gap-2">
          {CONTACT_CATEGORY_FORM_OPTIONS.map(({ id, label }) => {
            // "None" pill (id === 'none') stands for `category: null`, so highlight it whenever the
            // form value is null/undefined or the literal 'none' placeholder.
            const selected =
              id === 'none' ? form.category == null || form.category === 'none' : form.category === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setForm((f) => ({
                    ...f,
                    category: id === 'none' ? null : id,
                    ...(id === 'supporter' ? { status: 'partner' } : {}),
                  }));
                }}
                className={pillButtonClass(selected)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-mission-muted">Where are they?</h3>
        <div className="flex flex-wrap gap-2">
          {CONTACT_STATUS_FORM_OPTIONS.map(({ value, label }) => {
            const selected = form.status === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setForm((f) => ({
                    ...f,
                    status: value,
                    ...(value === 'partner' ? { category: 'supporter' } : {}),
                  }));
                }}
                className={pillButtonClass(selected)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-mission-muted">Support</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Label title="Monthly amount ($)">
            <Input
              inputMode="decimal"
              value={form.monthlyAmount}
              onChange={(e) => setForm((f) => ({ ...f, monthlyAmount: e.target.value }))}
              placeholder="0"
            />
          </Label>
          <Label title="One-time amount ($)">
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-neutral-500">$</span>
              <Input
                inputMode="decimal"
                value={form.oneTimeDonationAmount}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => {
                    const n = Number.parseFloat(String(v).replace(/,/g, ''));
                    const next = { ...f, oneTimeDonationAmount: v };
                    if (Number.isFinite(n) && n > 0) next.isOneTimeDonor = true;
                    return next;
                  });
                }}
                placeholder="0"
                className="pl-8"
              />
            </div>
          </Label>
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-btn border border-neutral-200 bg-white px-3 py-2">
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0 accent-[#185FA5]"
            checked={form.isOneTimeDonor}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                isOneTimeDonor: e.target.checked,
                ...(!e.target.checked ? { oneTimeDonationAmount: '', oneTimeDonationDate: '' } : {}),
              }))
            }
          />
          <span className="text-sm font-semibold text-ink">One-time donor</span>
        </label>
        {showOneTimeDate ? (
          <Label title="One-time donation date">
            <Input
              type="date"
              value={form.oneTimeDonationDate}
              onChange={(e) => setForm((f) => ({ ...f, oneTimeDonationDate: e.target.value }))}
            />
          </Label>
        ) : null}
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-mission-muted">Notes</h3>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          placeholder="Notes…"
          rows={4}
          className="resize-none"
        />
      </section>
    </div>
  );
}
