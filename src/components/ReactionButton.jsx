/**
 * Post reaction control (supporter feed + missionary updates preview).
 */
export default function ReactionButton({ active, label, emoji, disabled, onClick, className = '' }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-colors duration-200 ${
        active
          ? 'border-[color:var(--accent-bright)] bg-[color:color-mix(in_srgb,var(--accent-bright)_12%,#1A1A1A)] text-[color:var(--accent-bright)]'
          : 'border-[#333] bg-transparent text-white/70 hover:border-[#555] hover:text-white'
      } disabled:opacity-50 ${className}`}
      aria-label={label}
      aria-pressed={active}
    >
      <span aria-hidden className="text-[13px] leading-none">
        {emoji}
      </span>
      <span>{label}</span>
    </button>
  );
}
