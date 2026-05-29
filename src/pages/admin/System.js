export default function AdminSystem() {
  return (
    <div>
      <header className="border-b border-[#222] bg-[#111] px-8 py-5 text-white">
        <h1 className="font-display text-2xl tracking-wide">System</h1>
        <p className="mt-1 text-sm text-[#888]">Settings and platform health</p>
      </header>
      <div className="p-8">
        <div className="rounded-xl border border-[#EEEEEE] bg-white p-6">
          <p className="text-sm text-[#666]">
            System settings and health monitoring will appear here. Check Supabase dashboard and deployment logs for
            now.
          </p>
        </div>
      </div>
    </div>
  );
}
