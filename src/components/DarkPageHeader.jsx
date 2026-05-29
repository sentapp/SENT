/**
 * Sticky dark page header for missionary screens (Circuit Riders movement design).
 */
export default function DarkPageHeader({ title, subtitle, children, className = '' }) {
  return (
    <header
      className={`sticky top-0 z-10 -mx-5 -mt-5 border-b border-[#222] bg-[#111] px-5 py-4 text-white md:-mx-8 md:-mt-8 md:px-8 ${className}`}
    >
      <h1 className="font-display text-[26px] leading-none tracking-wide">{title}</h1>
      {subtitle ? (
        <p className="mt-1 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-[#666]">{subtitle}</p>
      ) : null}
      {children}
    </header>
  );
}
