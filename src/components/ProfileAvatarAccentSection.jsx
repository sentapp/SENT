import { useRef, useState } from 'react';
import { isAvatarStorageUnavailableError, uploadAvatar } from '../lib/uploadAvatar';
import { ACCENT_PRESETS, initialsFromDisplayName } from '../lib/profileAppearance';

/**
 * Circular avatar (tap to pick image) + preset accent swatches.
 */
export function ProfileAvatarAccentSection({
  userId,
  fullName,
  photoUrl,
  accentColor,
  onPhotoUrlChange,
  onAccentChange,
  disabled,
}) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const initials = initialsFromDisplayName(fullName);

  const openPicker = () => {
    if (disabled || busy) return;
    fileRef.current?.click();
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !userId) return;
    setErr('');
    setBusy(true);
    try {
      const url = await uploadAvatar(file, userId);
      onPhotoUrlChange(url);
    } catch (er) {
      if (isAvatarStorageUnavailableError(er)) {
        setErr('Photo upload coming soon');
      } else {
        setErr(er?.message || 'Could not upload photo.');
      }
    } finally {
      setBusy(false);
    }
  };

  const avatarSurfaceStyle = photoUrl
    ? { backgroundColor: '#fff' }
    : { backgroundColor: '#FAFAFA', color: '#111111' };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled || busy}
          className="group relative shrink-0 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-[color:var(--profile-accent,var(--accent))] disabled:opacity-50"
          aria-label="Change profile photo"
        >
          <span
            className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-white text-3xl font-semibold shadow-md ring-2 ring-border/90 transition group-hover:ring-[color:var(--profile-accent,var(--accent))]"
            style={avatarSurfaceStyle}
          >
            {photoUrl ? (
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </span>
          <span className="absolute inset-0 flex items-end justify-center rounded-full bg-black/0 pb-2 text-xs font-semibold text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
            {busy ? '…' : 'Change'}
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,.jpg,.jpeg,.png,.gif"
          className="sr-only"
          onChange={onFile}
        />
        <div className="max-w-md text-center sm:text-left">
          <p className="text-sm font-semibold text-ink">Profile photo</p>
          <p className="mt-1 text-sm text-muted">Tap the circle to upload JPG, PNG, or GIF (shown on your profile and for supporters).</p>
          {busy ? <p className="mt-2 text-xs font-medium text-muted">Uploading…</p> : null}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink">Your color</p>
        <p className="mt-1 text-xs text-muted">Used on your profile and, for missionaries, on your supporters&apos; feed.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {ACCENT_PRESETS.map(({ hex, label }) => {
            const selected = (accentColor || '').toUpperCase() === hex.toUpperCase();
            return (
              <button
                key={hex}
                type="button"
                disabled={disabled || busy}
                title={label}
                aria-label={`${label} ${selected ? '(selected)' : ''}`}
                aria-pressed={selected}
                onClick={() => onAccentChange(hex)}
                className={`h-10 w-10 rounded-full border-2 shadow-sm transition hover:scale-105 disabled:opacity-50 ${
                  selected ? 'border-neutral-900 ring-2 ring-offset-2 ring-neutral-900' : 'border-white ring-1 ring-border'
                }`}
                style={{ backgroundColor: hex }}
              />
            );
          })}
        </div>
      </div>

      {err ? (
        <p className={`text-sm ${err === 'Photo upload coming soon' ? 'text-muted' : 'text-red-600'}`}>{err}</p>
      ) : null}
    </div>
  );
}
