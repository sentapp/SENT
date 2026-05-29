/**
 * Auth / landing split layout: dark hero (SENT + tagline) + white form area.
 */
export default function AuthSplitShell({ children, heroExtra = null }) {
  return (
    <div className="flex min-h-full flex-col bg-white">
      <div className="flex min-h-[42vh] shrink-0 flex-col items-center justify-center bg-[#111] px-6 py-10 text-center text-white">
        <h1 className="font-display text-[80px] leading-none tracking-wide">SENT</h1>
        <p className="mt-4 max-w-xs font-sans text-sm leading-relaxed text-white/75">
          For missionaries and the people who send them.
        </p>
        {heroExtra}
      </div>
      <div className="flex flex-1 flex-col px-6 py-8">{children}</div>
    </div>
  );
}
