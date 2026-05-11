import { useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useSupabaseContacts } from '../../hooks/useSupabaseContacts';
import { Button, Card, EmptyState } from '../../components/ui';

function Tabs({ tab, setTab }) {
  const tabs = ['Message', 'Prayer', 'Notes'];
  return (
    <div className="flex gap-2">
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setTab(t)}
          className={`rounded-btn px-3 py-2 text-sm font-semibold ${
            tab === t ? 'bg-mission-blue/10 text-mission-blue ring-1 ring-mission-blue/20' : 'text-neutral-600 hover:bg-neutral-100'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

export default function MissionaryPartners() {
  const { user } = useAuth();
  const { contacts } = useSupabaseContacts(user?.id);
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('Message');

  const partners = useMemo(() => {
    return contacts.filter(
      (c) =>
        c.category === 'supporter' ||
        c.status === 'partner' ||
        Number(c.monthlyAmount) > 0,
    );
  }, [contacts]);

  const selected = partners.find((p) => p.id === selectedId) || null;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Partners</h1>
        <p className="text-sm text-neutral-600">Monthly partners are derived from your contacts. Starts empty.</p>
      </header>

      {partners.length === 0 ? (
        <EmptyState title="No partners yet — add contacts and mark them as monthly partners" />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-3 md:col-span-1">
            {partners.map((p) => (
              <Card key={p.id} className="p-4">
                <button type="button" className="w-full text-left" onClick={() => setSelectedId(p.id)}>
                  <p className="text-sm font-semibold text-neutral-900">{p.fullName || 'Unnamed partner'}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {Number(p.monthlyAmount) > 0 ? `$${Number(p.monthlyAmount).toFixed(0)}/mo` : '$0/mo'} · Engagement: 0
                  </p>
                </button>
              </Card>
            ))}
          </div>

          <div className="md:col-span-2">
            {selected ? (
              <Card className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{selected.fullName || 'Unnamed partner'}</p>
                    <p className="mt-1 text-sm text-neutral-600">
                      Engagement score: <span className="font-semibold text-neutral-800">0</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="secondary">
                      Log call
                    </Button>
                    <Button type="button" variant="secondary">
                      Log text
                    </Button>
                    <Button type="button" variant="secondary">
                      Log update
                    </Button>
                    <Button type="button" variant="secondary">
                      Log prayer
                    </Button>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <Tabs tab={tab} setTab={setTab} />
                  <p className="text-xs text-neutral-500">Activity log is empty by default.</p>
                </div>

                <div className="mt-4">
                  <EmptyState title="No activity yet" subtitle="Once you log calls/texts/notes, they’ll appear here." />
                </div>
              </Card>
            ) : (
              <EmptyState title="Select a partner to view details" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

