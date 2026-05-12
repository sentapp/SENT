import { useMemo } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useMissionaryPosts } from '../../hooks/useMissionaryPosts';
import { useMissionaryPublicProfile } from '../../hooks/useMissionaryPublicProfile';
import { useMissionaryMapPoints } from '../../hooks/useMissionaryMapPoints';
import MapView from '../../components/MapView';
import { EmptyState } from '../../components/ui';

function mapProfileForPins(dbProfile) {
  if (!dbProfile) return null;
  const lat = dbProfile.latitude != null ? Number(dbProfile.latitude) : null;
  const lng = dbProfile.longitude != null ? Number(dbProfile.longitude) : null;
  return {
    ...dbProfile,
    location_name: dbProfile.location_name,
    latitude: dbProfile.latitude,
    longitude: dbProfile.longitude,
    locationCoords: lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng) ? { lat, lng } : null,
  };
}

export default function SupporterMap() {
  const { profile: supporterProfile } = useAuth();
  const missionaryId = supporterProfile?.connected_missionary_id;

  const { profile: missionaryDb } = useMissionaryPublicProfile(missionaryId);
  const { posts } = useMissionaryPosts(missionaryId || null);

  const mapProfile = useMemo(() => mapProfileForPins(missionaryDb), [missionaryDb]);
  const points = useMissionaryMapPoints(mapProfile, posts);

  if (!missionaryId) {
    return (
      <div className="space-y-4">
        <header className="space-y-1">
          <p className="text-sm font-medium text-mission-blue">Map</p>
          <h1 className="text-2xl font-semibold tracking-tight">Mission map</h1>
          <p className="text-sm text-neutral-600">Connect to your missionary with their SENT invite code to see pins.</p>
        </header>
        <EmptyState
          icon="link"
          title="No missionary connected"
          subtitle="Add your invite code when you sign up or contact support."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1 text-center md:text-left">
        <p className="text-sm font-medium text-mission-blue">Map</p>
        <h1 className="text-2xl font-semibold tracking-tight">Mission map</h1>
        <p className="text-sm text-neutral-600">Your missionary&apos;s home base and update locations.</p>
      </header>
      <div className="-mx-6 sm:mx-0">
        <MapView points={points} route height={420} rounded={false} className="border-x-0 sm:rounded-card sm:border" />
      </div>
    </div>
  );
}
