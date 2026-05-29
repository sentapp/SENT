export default function MissionaryPageShell({ header, children, className = '' }) {
  return (
    <div className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-webkit-overflow-scrolling:touch] ${className}`}>
      {header}
      <div className="px-5 pb-[max(7rem,calc(4rem+env(safe-area-inset-bottom)))] md:px-8 md:pb-0 lg:px-10">
        {children}
      </div>
    </div>
  );
}
