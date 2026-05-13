import { formatPhone } from '../../lib/phoneFormat';
import { Button, Label } from '../ui';

export function ImportPreviewPanel({
  headers = [],
  mapping,
  onMappingChange,
  showMapping,
  drafts,
  onToggleRow,
  onSelectAll,
  onDeselectAll,
  previewHeadline = 'Preview',
  previewLimit = 5,
}) {
  const selectedCount = drafts.filter((d) => d.selected).length;
  const shown = drafts.slice(0, previewLimit);
  const remaining = Math.max(0, drafts.length - previewLimit);
  const newCount = drafts.filter((d) => !d.duplicateOf).length;
  const dupCount = drafts.filter((d) => d.duplicateOf).length;

  const setIdx = (field, val) => {
    const v = val === '' ? -1 : Number(val);
    onMappingChange({ ...mapping, [field]: v });
  };

  return (
    <div className="space-y-4">
      {showMapping && headers.length > 0 ? (
        <div className="rounded-card border border-amber-200 bg-amber-50/80 p-4">
          <p className="mb-3 text-sm font-semibold text-[#854F0B]">Match columns</p>
          <p className="mb-3 text-sm text-neutral-700">
            We couldn&apos;t confidently detect name, phone, and email columns. Pick which column is which.
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <Label title="Which column is the full name?">
              <select
                className="w-full rounded-btn border border-neutral-200 px-3 py-2.5 text-sm"
                value={mapping.fullNameIdx ?? mapping.nameIdx ?? 0}
                onChange={(e) => setIdx('fullNameIdx', e.target.value)}
              >
                {headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h?.trim() || `Column ${i + 1}`}
                  </option>
                ))}
              </select>
            </Label>
            <Label title="Which column is the phone?">
              <select
                className="w-full rounded-btn border border-neutral-200 px-3 py-2.5 text-sm"
                value={mapping.phoneIdx < 0 ? '' : mapping.phoneIdx}
                onChange={(e) => setIdx('phoneIdx', e.target.value === '' ? '-1' : e.target.value)}
              >
                <option value="">— None —</option>
                {headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h?.trim() || `Column ${i + 1}`}
                  </option>
                ))}
              </select>
            </Label>
            <Label title="Which column is the email?">
              <select
                className="w-full rounded-btn border border-neutral-200 px-3 py-2.5 text-sm"
                value={mapping.emailIdx < 0 ? '' : mapping.emailIdx}
                onChange={(e) => setIdx('emailIdx', e.target.value === '' ? '-1' : e.target.value)}
              >
                <option value="">— None —</option>
                {headers.map((h, i) => (
                  <option key={i} value={i}>
                    {h?.trim() || `Column ${i + 1}`}
                  </option>
                ))}
              </select>
            </Label>
          </div>
        </div>
      ) : null}

      <div>
        <p className="mb-2 text-sm font-semibold text-ink">{previewHeadline}</p>
        <p className="mb-3 text-sm text-neutral-700">
          <span className="font-semibold text-ink">{newCount} new contacts</span>
          <span className="text-neutral-500">, </span>
          <span className="font-semibold text-amber-800">{dupCount} duplicates found</span>
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" className="!py-2 !text-sm" onClick={onSelectAll}>
            Select all
          </Button>
          <Button type="button" variant="secondary" className="!py-2 !text-sm" onClick={onDeselectAll}>
            Deselect all
          </Button>
        </div>

        <p className="mb-3 text-sm font-semibold text-neutral-800">
          {selectedCount} of {drafts.length} contacts selected
        </p>

        <div className="max-h-[min(320px,50vh)] overflow-auto rounded-card border border-neutral-200">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="sticky top-0 bg-neutral-50 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="w-10 px-3 py-2"> </th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Email</th>
                <th className="min-w-[120px] px-3 py-2"> </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((d) => (
                <tr key={d.id} className="border-t border-neutral-100 hover:bg-neutral-50/80">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#185FA5]"
                      checked={d.selected}
                      onChange={() => onToggleRow(d.id)}
                      aria-label={`Select ${d.full_name}`}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium text-ink">{d.full_name || '—'}</td>
                  <td className="px-3 py-2 text-neutral-700">{formatPhone(d.phone) || '—'}</td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-neutral-700">{d.email || '—'}</td>
                  <td className="px-3 py-2">
                    {d.duplicateOf ? (
                      <span className="inline-flex whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                        Already exists
                      </span>
                    ) : (
                      <span className="text-neutral-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {remaining > 0 ? (
          <p className="mt-2 text-sm text-neutral-600">
            Showing first {previewLimit} rows · <span className="font-medium">and {remaining} more contacts</span> in this import.
          </p>
        ) : null}
      </div>
    </div>
  );
}
