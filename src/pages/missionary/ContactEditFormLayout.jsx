import { useMemo } from 'react';
import { initialsFromDisplayName } from '../../lib/profileAppearance';
import { Input, Label, Textarea } from '../../components/ui';
import { ContactThreeQuickTagRows } from '../../components/contacts/QuickTagPopover';

/**
 * Layout A: avatar + name header, sectioned fields (add + edit).
 * @param {{
 *   form: Record<string, unknown>,
 *   setForm: (fn: (f: any) => any) => void,
 *   phoneDupWarn: { id: string, fullName?: string } | null,
 *   emailDupWarn: { id: string, fullName?: string } | null,
 *   scrollToContact: (id: string) => void,
 *   deferQuickTags?: boolean,
 *   editingContactId?: string | null,
 * }} props
 */
export default function ContactEditFormLayout({
  form,
  setForm,
  phoneDupWarn,
  emailDupWarn,
  scrollToContact,
  deferQuickTags = false,
  editingContactId = null,
}) {
  const name = String(form.fullName ?? '');
  const initials = initialsFromDisplayName(name);
  const oneTimeNum = Number.parseFloat(String(form.oneTimeDonationAmount ?? '').replace(/,/g, ''));
  const showOneTimeDate = Number.isFinite(oneTimeNum) && oneTimeNum > 0;

  const quickTagContact = useMemo(
    () => ({
      id: editingContactId ?? '',
      fullName: form.fullName ?? '',
      phone: form.phone ?? '',
      email: form.email ?? '',
      address: form.address ?? '',
      monthlyAmount: form.monthlyAmount ?? '',
      notes: form.notes ?? '',
      category: form.category,
      status: form.status,
      relationship: form.relationship ?? '',
      isOneTimeDonor: form.isOneTimeDonor,
      oneTimeDonationAmount: form.oneTimeDonationAmount,
      oneTimeDonationDate: form.oneTimeDonationDate,
    }),
    [
      editingContactId,
      form.fullName,
      form.phone,
      form.email,
      form.address,
      form.monthlyAmount,
      form.notes,
      form.category,
      form.status,
      form.relationship,
      form.isOneTimeDonor,
      form.oneTimeDonationAmount,
      form.oneTimeDonationDate,
    ],
  );

  return (
    <div className="space-y-6">
      {deferQuickTags ? (
        <div className="space-y-2 border-b border-mission-line pb-4" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-mission-muted">Tags</h3>
          <ContactThreeQuickTagRows contact={quickTagContact} deferSave setForm={setForm} />
        </div>
      ) : null}
      <div className="flex gap-3 border-b border-mission-line pb-4">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EAE3D8] text-[15px] font-medium leading-none text-[#181208]"
          aria-hidden
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium leading-tight text-[#1C1917]">
            {name.trim() || 'New contact'}
          </p>
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
                  className="font-semibold text-mission-ink underline"
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
                  className="font-semibold text-mission-ink underline"
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
            className="h-5 w-5 shrink-0 accent-[#181208]"
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
