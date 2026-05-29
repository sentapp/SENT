/**
 * Full-screen white overlay with dark header (Overview pipeline / stats).
 */
export default function MissionaryFullscreenOverlay({ open, title, subtitle, onClose, children }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="shrink-0 border-b border-[#222] bg-[#111] px-4 py-4 text-white safe-area-top">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onClose}
            className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0 flex-1 pr-2">
            <h2 className="font-display text-[26px] leading-none tracking-wide">{title}</h2>
            {subtitle ? (
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#666]">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-xs font-medium text-white/70 hover:text-white"
          >
            Close
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:px-8 md:py-6">
        {children}
      </div>
    </div>
  );
}
