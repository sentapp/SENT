import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import SignUp from './pages/SignUp';
import SignIn from './pages/SignIn';
import MissionaryLayout from './layouts/MissionaryLayout';
import SupporterLayout from './layouts/SupporterLayout';

import MissionaryOverview from './pages/missionary/Overview';
import MissionaryContacts from './pages/missionary/Contacts';
import MissionaryPartners from './pages/missionary/Partners';
import MissionaryUpdates from './pages/missionary/Updates';
import MissionarySettings from './pages/missionary/Settings';
import MissionaryOnboarding from './pages/missionary/MissionaryOnboarding';

import SupporterFeed from './pages/supporter/Feed';
import SupporterPrayer from './pages/supporter/Prayer';
import SupporterRefer from './pages/supporter/Refer';
import SupporterGive from './pages/supporter/SupporterGive';
import SupporterProfile from './pages/supporter/Profile';
import SupporterMap from './pages/supporter/SupporterMap';
import RequireAuth from './components/RequireAuth';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/signin" element={<SignIn />} />

      <Route
        path="/missionary"
        element={
          <RequireAuth role="missionary">
            <MissionaryLayout />
          </RequireAuth>
        }
      >
        <Route index element={<MissionaryOverview />} />
        <Route path="onboarding" element={<MissionaryOnboarding />} />
        <Route path="contacts" element={<MissionaryContacts />} />
        <Route path="partners" element={<MissionaryPartners />} />
        <Route path="updates" element={<MissionaryUpdates />} />
        <Route path="map" element={<Navigate to="/missionary/updates" replace />} />
        <Route path="settings" element={<MissionarySettings />} />
      </Route>

      <Route
        path="/supporter"
        element={
          <RequireAuth role="supporter">
            <SupporterLayout />
          </RequireAuth>
        }
      >
        <Route index element={<SupporterFeed />} />
        <Route path="map" element={<SupporterMap />} />
        <Route path="prayer" element={<SupporterPrayer />} />
        <Route path="give" element={<SupporterGive />} />
        <Route path="refer" element={<SupporterRefer />} />
        <Route path="profile" element={<SupporterProfile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
