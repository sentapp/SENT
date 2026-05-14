import React from 'react';

export function Card({ className = '', children, ...props }) {
  return (
    <div
      className={`rounded-[12px] border-[0.5px] border-[#EEEEEE] bg-white p-5 shadow-none transition-colors duration-200 ease-out md:p-5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function Button({ className = '', variant = 'primary', ...props }) {
  const base =
    'inline-flex min-h-[44px] items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-60';
  const variants = {
    primary:
      'border border-transparent bg-[#2A9A58] text-white hover:bg-[#2A9A58]/90 active:bg-[#2A9A58]/85',
    accent:
      'border border-transparent bg-[#2A9A58] text-white hover:bg-[#2A9A58]/90 active:bg-[#2A9A58]/85',
    secondary:
      'border-[0.5px] border-[#111111] bg-white text-[#111111] hover:bg-[#FAFAFA] active:bg-[#EEEEEE]/80',
    ghost:
      'min-h-0 border-transparent bg-transparent px-3 py-2 text-ink hover:bg-surface active:bg-border/40',
    outlineBlue:
      'border-[0.5px] border-[#111111] bg-white text-[#111111] hover:bg-surface active:bg-border/60',
    danger:
      'border border-transparent bg-[#E05050] text-white hover:bg-[#E05050]/90 active:bg-[#E05050]/85',
  };
  return <button className={`${base} ${variants[variant] ?? variants.primary} ${className}`} {...props} />;
}

export const Input = React.forwardRef(function Input({ className = '', ...props }, ref) {
  return (
    <input
      ref={ref}
      className={`w-full rounded-lg border-[0.5px] border-[#EEEEEE] bg-[#FAFAFA] px-4 py-[14px] text-[14px] font-normal text-ink placeholder:text-[#AAAAAA] outline-none ring-[#2A9A58]/25 transition-colors duration-200 focus:border-[#2A9A58] focus:ring ${className}`}
      {...props}
    />
  );
});

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full rounded-lg border-[0.5px] border-[#EEEEEE] bg-[#FAFAFA] px-4 py-3 text-[14px] font-normal text-ink placeholder:text-[#AAAAAA] outline-none ring-[#2A9A58]/25 transition-colors duration-200 focus:border-[#2A9A58] focus:ring ${className}`}
      {...props}
    />
  );
}

export function Label({ title, children }) {
  return (
    <label className="block">
      <span className="sent-section-label mb-2 block">{title}</span>
      {children}
    </label>
  );
}

export function LoadingSpinner({ className = '', label }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <svg
        className="h-9 w-9 animate-spin text-green"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {label ? <p className="sent-body max-w-[260px] text-center font-medium text-muted">{label}</p> : null}
    </div>
  );
}

const EMPTY_ICON_MAP = {
  compass: (
    <svg className="h-11 w-11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="12" cy="12" r="9" strokeLinecap="round" />
      <path strokeLinecap="round" d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8l2 4-2 4-2-4 2-4z" />
    </svg>
  ),
  heart: (
    <svg className="h-11 w-11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
      />
    </svg>
  ),
  globe: (
    <svg className="h-11 w-11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M3 12h18M12 3a14 14 0 000 18M12 3a14 14 0 010 18" />
    </svg>
  ),
  link: (
    <svg className="h-11 w-11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.649a4.5 4.5 0 00-9.193 9.193L5.5 19.5 5.25 18.75l1.757-1.757a4.5 4.5 0 009.193-9.193z" />
    </svg>
  ),
  sparkles: (
    <svg className="h-11 w-11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.847a4.5 4.5 0 003.09 3.09L15.75 12l-2.847.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"
      />
    </svg>
  ),
  clipboard: (
    <svg className="h-11 w-11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
};

/**
 * @param {{ title: string, subtitle?: string, action?: React.ReactNode, icon?: keyof typeof EMPTY_ICON_MAP }} props
 */
export function EmptyState({ title, subtitle, action, icon }) {
  const graphic = icon ? EMPTY_ICON_MAP[icon] : null;
  return (
    <div className="rounded-card border border-dashed border-mission-line bg-surface p-8 text-center">
      {graphic ? <div className="mb-4 flex justify-center text-ink/70">{graphic}</div> : null}
      <p className="sent-card-title">{title}</p>
      {subtitle ? <p className="sent-body mt-2 text-muted">{subtitle}</p> : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
  backdropClose = true,
  closeButtonLabel = 'Close',
  panelClassName = '',
  stackZIndex,
}) {
  if (!open) return null;
  const closeBtnIsIcon = closeButtonLabel === '×' || closeButtonLabel === '✕';
  return (
    <div
      className={`fixed inset-0 flex items-end justify-center bg-black/40 p-4 transition-opacity duration-200 md:items-center ${
        stackZIndex != null ? '' : 'z-50'
      }`}
      style={stackZIndex != null ? { zIndex: stackZIndex } : undefined}
      role="presentation"
      onClick={() => {
        if (backdropClose) onClose?.();
      }}
    >
      <div
        className={`w-full max-w-lg rounded-card border border-mission-line bg-surface shadow-lg ${panelClassName}`}
        role="presentation"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-mission-line px-5 py-4">
          <p className="sent-section-title">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeBtnIsIcon ? 'Close' : undefined}
            className={`rounded-lg text-muted transition hover:bg-surface ${
              closeBtnIsIcon ? 'px-3 py-2 text-xl font-light leading-none' : 'px-3 py-2 text-sm font-medium'
            }`}
          >
            {closeButtonLabel}
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-mission-line px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}
