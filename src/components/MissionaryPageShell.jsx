/**
 * Fills the missionary layout outlet: outer column clips height; inner div scrolls
 * so sticky dark headers (inside children) share the same scroll parent as content.
 */
export default function MissionaryPageShell({ children, className = '' }) {
  return (
    <div className={`flex h-full min-h-0 flex-col overflow-hidden ${className}`}>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 pb-[max(7rem,calc(4rem+env(safe-area-inset-bottom)))] [-webkit-overflow-scrolling:touch] md:px-8 md:pb-0 lg:px-10">
        {children}
      </div>
    </div>
  );
}
