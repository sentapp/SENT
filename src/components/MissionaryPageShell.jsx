/**
 * Fills the missionary layout outlet: outer column clips height; inner column scrolls
 * so sticky dark headers (header prop) share the same scroll parent as content.
 */
export default function MissionaryPageShell({ header, children, className = '' }) {
  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${className}`}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-webkit-overflow-scrolling:touch]">
        {header}
        <div className="flex min-h-0 flex-1 flex-col px-5 pb-[max(7rem,calc(4rem+env(safe-area-inset-bottom)))] md:px-8 md:pb-0 lg:px-10">
          {children}
        </div>
      </div>
    </div>
  );
}
