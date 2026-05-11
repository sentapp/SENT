import React from 'react';

export function Card({ className = '', children, ...props }) {
  return (
    <div className={`rounded-card border border-neutral-200 bg-white shadow-sm ${className}`} {...props}>
      {children}
    </div>
  );
}

export function Button({ className = '', variant = 'primary', ...props }) {
  const base =
    'inline-flex items-center justify-center rounded-btn px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60';
  const variants = {
    primary: 'bg-mission-blue text-white hover:opacity-95 active:opacity-90',
    secondary: 'border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50 active:bg-neutral-100',
    ghost: 'bg-transparent text-neutral-800 hover:bg-neutral-100 active:bg-neutral-200',
    outlineBlue: 'border-2 border-mission-blue bg-white text-mission-blue hover:bg-mission-blue/5 active:bg-mission-blue/10',
    danger: 'bg-red-600 text-white hover:opacity-95 active:opacity-90',
  };
  return <button className={`${base} ${variants[variant] ?? variants.primary} ${className}`} {...props} />;
}

export function Input({ className = '', ...props }) {
  return (
    <input
      className={`w-full rounded-btn border border-neutral-200 px-4 py-[14px] text-[17px] outline-none ring-mission-blue/30 focus:border-mission-blue focus:ring ${className}`}
      {...props}
    />
  );
}

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={`w-full rounded-btn border border-neutral-200 px-4 py-3 text-[16px] outline-none ring-mission-blue/30 focus:border-mission-blue focus:ring ${className}`}
      {...props}
    />
  );
}

export function Label({ title, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-neutral-700">{title}</span>
      {children}
    </label>
  );
}

export function LoadingSpinner({ className = '', label }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <svg
        className="h-9 w-9 animate-spin text-mission-blue"
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
      {label ? <p className="max-w-[260px] text-center text-sm font-medium text-neutral-700">{label}</p> : null}
    </div>
  );
}

export function EmptyState({ title, subtitle, action }) {
  return (
    <div className="rounded-card border border-dashed border-neutral-200 bg-white p-6 text-center">
      <p className="text-sm font-semibold text-neutral-900">{title}</p>
      {subtitle ? <p className="mt-2 text-sm text-neutral-600">{subtitle}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Modal({ open, title, children, onClose, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center">
      <div className="w-full max-w-lg rounded-card bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <p className="text-base font-semibold">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-btn px-3 py-1.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-100"
          >
            Close
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-neutral-200 px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

