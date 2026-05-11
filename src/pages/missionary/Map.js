import { useCallback } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useMissionaryPosts } from '../../hooks/useMissionaryPosts';
import { useMissionaryMapPoints } from '../../hooks/useMissionaryMapPoints';
import { Card } from '../../components/ui';
import MapView from '../../components/MapView';

export default function MissionaryMap() {
  const { profile } = useAuth();
  const mid = profile?.id;
  const { posts } = useMissionaryPosts(mid);
  const readMoreHref = useCallback((p) => `/missionary/updates#post-${p.id}`, []);
  const points = useMissionaryMapPoints(profile, posts, { readMoreHref });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Map</h1>
        <p className="text-sm text-neutral-600">
          Your mission base and update locations (from plain-text places on posts). Pins connect in chronological order.
        </p>
      </header>

      <MapView points={points} route height={380} />

      <Card className="p-5">
        <p className="text-sm font-semibold">How pins work</p>
        <p className="mt-2 text-sm text-neutral-600">
          Set your home location as text in Settings. When you post an update with a location, we place a pin automatically — no coordinates needed.
        </p>
      </Card>
    </div>
  );
}
