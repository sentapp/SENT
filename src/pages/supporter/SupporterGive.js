import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useMissionaryPublicProfile } from '../../hooks/useMissionaryPublicProfile';
import { fetchActiveMissionPushForMissionary } from '../../lib/missionPushesRepository';
import { fetchConnectedMissionaryPublic } from '../../lib/connectedMissionary';
import { initialsFromDisplayName, normalizeProfileAccent } from '../../lib/profileAppearance';
import { Card, EmptyState } from '../../components/ui';

function normalizeUrl(url) {
  const u = (url || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u}`;
}

function daysUntilDeadline(deadlineStr) {
  if (!deadlineStr) return null;
  const d = new Date(`${deadlineStr}T23:59:59`);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
}

export default function SupporterGive() {
  const { profile } = useAuth();
  const missionaryId = profile?.connected_missionary_id;
  const { profile: missionary } = useMissionaryPublicProfile(missionaryId);

  const [givingFromRpc, setGivingFromRpc] = useState(null);
  const [missionPush, setMissionPush] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!missionaryId) {
      setGivingFromRpc(null);
      return undefined;
    }
    (async () => {
      const rpc = await fetchConnectedMissionaryPublic();
      if (cancelled) return;
      if (rpc?.id === missionaryId) {
        setGivingFromRpc({
          tax_deductible_url: rpc.tax_deductible_url,
          non_tax_deductible_url: rpc.non_tax_deductible_url,
        });
      } else {
        setGivingFromRpc(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [missionaryId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!missionaryId) {
        setMissionPush(null);
        return;
      }
      const { data } = await fetchActiveMissionPushForMissionary(missionaryId);
      if (!cancelled) setMissionPush(data || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [missionaryId]);

  if (!missionaryId) {
    return (
      <div className="space-y-6">
        <header className="space-y-1 text-center sm:text-left">
          <p className="text-sm font-medium text-mission-blue">Give</p>
          <h1 className="text-2xl font-semibold tracking-tight">Support the mission</h1>
        </header>
        <EmptyState title="Connect to a missionary" subtitle="Use your invite code so you can give toward their work." />
      </div>
    );
  }

  const name = missionary?.full_name?.trim() || 'Missionary';
  const photoUrl = missionary?.photo_url || '';
  const location = missionary?.location_name?.trim() || 'the field';
  const feedAccent = missionaryId ? normalizeProfileAccent(missionary?.accent_color) : '#185FA5';
  const avatarInitials = initialsFromDisplayName(name);

  const taxUrl = normalizeUrl(missionary?.tax_deductible_url || givingFromRpc?.tax_deductible_url || '');
  const nonTaxUrl = normalizeUrl(missionary?.non_tax_deductible_url || givingFromRpc?.non_tax_deductible_url || '');

  const pushGoal = missionPush ? Number(missionPush.goal_amount || 0) : 0;
  const pushRaised = missionPush ? Number(missionPush.raised_amount || 0) : 0;
  const pushPct = pushGoal > 0 ? Math.min(100, Math.round((pushRaised / pushGoal) * 100)) : 0;
  const pushGiveUrl = normalizeUrl(missionPush?.giving_link || taxUrl || nonTaxUrl || '');
  const daysLeft = missionPush?.deadline ? daysUntilDeadline(missionPush.deadline) : null;

  return (
    <div className="space-y-6" style={{ '--feed-accent': feedAccent }}>
      <header className="space-y-1 text-center sm:text-left">
        <p className="feed-accent-text text-sm font-medium">Give</p>
        <h1 className="text-2xl font-semibold tracking-tight">Partner financially</h1>
        <p className="text-sm text-neutral-600">Your gifts help send the Gospel where it is needed most.</p>
      </header>

      <Card className="overflow-hidden border border-neutral-200/80 bg-gradient-to-b from-white to-neutral-50/80 p-6 shadow-sm">
        <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:gap-5 sm:text-left">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-white shadow-md ring-2 ring-[color:color-mix(in_srgb,var(--feed-accent,#185FA5)_18%,transparent)]">
            {photoUrl ? (
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="feed-accent-bg flex h-full w-full items-center justify-center text-3xl font-semibold text-white">
                {avatarInitials}
              </div>
            )}
          </div>
          <div className="mt-4 min-w-0 sm:mt-0">
            <p className="text-lg font-semibold text-neutral-900">{name}</p>
            {missionary?.organization ? (
              <p className="mt-1 text-sm text-neutral-600">{missionary.organization}</p>
            ) : null}
            <p className="mt-4 text-base leading-relaxed text-neutral-700">
              Your giving directly fuels the Gospel in <span className="font-semibold text-neutral-900">{location}</span>.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {taxUrl ? (
            <a
              href={taxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="feed-accent-bg inline-flex flex-1 items-center justify-center rounded-btn px-5 py-3.5 text-center text-[17px] font-semibold text-white shadow-sm transition hover:opacity-95 sm:max-w-xs sm:flex-none sm:min-w-[200px]"
            >
              Give monthly
            </a>
          ) : (
            <span className="inline-flex flex-1 cursor-not-allowed items-center justify-center rounded-btn border border-neutral-200 bg-neutral-100 px-5 py-3.5 text-center text-[17px] font-semibold text-neutral-400 sm:max-w-xs sm:flex-none sm:min-w-[200px]">
              Give monthly
              <span className="sr-only"> (not available)</span>
            </span>
          )}
          {nonTaxUrl ? (
            <a
              href={nonTaxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center rounded-btn border-2 border-[color:var(--feed-accent,#185FA5)] bg-white px-5 py-3.5 text-center text-[17px] font-semibold text-[color:var(--feed-accent,#185FA5)] shadow-sm transition hover:bg-[color:color-mix(in_srgb,var(--feed-accent,#185FA5)_8%,white)] sm:max-w-xs sm:flex-none sm:min-w-[200px]"
            >
              One-time gift
            </a>
          ) : (
            <span className="inline-flex flex-1 cursor-not-allowed items-center justify-center rounded-btn border border-neutral-200 bg-neutral-100 px-5 py-3.5 text-center text-[17px] font-semibold text-neutral-400 sm:max-w-xs sm:flex-none sm:min-w-[200px]">
              One-time gift
              <span className="sr-only"> (not available)</span>
            </span>
          )}
        </div>
      </Card>

      {missionPush && missionPush.is_active ? (
        <Card className="feed-accent-card border p-6 shadow-sm">
          <p className="feed-accent-text text-xs font-semibold uppercase tracking-wide">Mission push</p>
          <h2 className="mt-2 text-xl font-semibold text-neutral-900">{missionPush.title}</h2>
          {missionPush.description ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{missionPush.description}</p>
          ) : null}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="text-neutral-700">
                ${pushRaised.toLocaleString()} raised of ${pushGoal.toLocaleString()}
              </span>
              <span className="feed-accent-text">{pushPct}%</span>
            </div>
            <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-neutral-200">
              <div className="feed-accent-bg h-3 rounded-full transition-all" style={{ width: `${pushPct}%` }} />
            </div>
          </div>
          {daysLeft != null ? (
            <p className="mt-3 text-sm text-neutral-600">
              {daysLeft < 0 ? 'Deadline passed' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining`}
            </p>
          ) : null}
          {pushGiveUrl ? (
            <a
              href={pushGiveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="feed-accent-bg mt-5 block w-full rounded-btn py-3.5 text-center text-[17px] font-semibold text-white shadow-sm transition hover:opacity-95"
            >
              Give toward this
            </a>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
