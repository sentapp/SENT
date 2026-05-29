import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import SignUp from './pages/SignUp';
import JoinWithCode from './pages/JoinWithCode';
import SignIn from './pages/SignIn';
import ResetPassword from './pages/ResetPassword';
import MissionaryLayout from './layouts/MissionaryLayout';
import SupporterLayout from './layouts/SupporterLayout';
import AdminLayout from './layouts/AdminLayout';

import MissionaryOverview from './pages/missionary/Overview';
import MissionaryContacts from './pages/missionary/Contacts';
import MissionaryPipeline from './pages/missionary/Pipeline';
import MissionaryPartners from './pages/missionary/Partners';
import MissionaryUpdates from './pages/missionary/Updates';
import MissionaryMeetings from './pages/missionary/Meetings';
import MissionaryStats from './pages/missionary/Stats';
import MissionarySettings from './pages/missionary/Settings';
import MissionaryOnboarding from './pages/missionary/MissionaryOnboarding';

import SupporterFeed from './pages/supporter/Feed';
import SupporterPrayer from './pages/supporter/Prayer';
import SupporterRefer from './pages/supporter/Refer';
import SupporterGive from './pages/supporter/SupporterGive';
import SupporterProfile from './pages/supporter/Profile';

import AdminOverview from './pages/admin/Overview';
import AdminMissionaries from './pages/admin/Missionaries';
import AdminSupporters from './pages/admin/Supporters';
import AdminFeedback from './pages/admin/Feedback';
import AdminBlast from './pages/admin/Blast';

import RequireAuth from './components/RequireAuth';
import { ContactDrawerProvider } from './context/ContactDrawerContext';
import GlobalContactDrawer from './components/contacts/GlobalContactDrawer';

function App() {
  return (
    <ContactDrawerProvider>
    <div className="font-sans min-h-screen bg-[#F7F5F2]">
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/join" element={<JoinWithCode />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        path="/missionary"
        element={
          <RequireAuth role="missionary">
            <MissionaryLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/missionary/overview" replace />} />
        <Route path="overview" element={<MissionaryOverview />} />
        <Route path="onboarding" element={<MissionaryOnboarding />} />
        <Route path="contacts" element={<MissionaryContacts />} />
        <Route path="pipeline" element={<MissionaryPipeline />} />
        <Route path="meetings" element={<MissionaryMeetings />} />
        <Route path="partners" element={<MissionaryPartners />} />
        <Route path="stats" element={<MissionaryStats />} />
        <Route path="updates" element={<MissionaryUpdates />} />
        <Route path="map" element={<Navigate to="/missionary/updates" replace />} />
        <Route path="settings" element={<MissionarySettings />} />
      </Route>

      <Route
        path="/admin"
        element={
          <RequireAuth role="admin">
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/admin/overview" replace />} />
        <Route path="overview" element={<AdminOverview />} />
        <Route path="missionaries" element={<AdminMissionaries />} />
        <Route path="supporters" element={<AdminSupporters />} />
        <Route path="feedback" element={<AdminFeedback />} />
        <Route path="blast" element={<AdminBlast />} />
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
        <Route path="map" element={<Navigate to="/supporter" replace />} />
        <Route path="prayer" element={<SupporterPrayer />} />
        <Route path="give" element={<SupporterGive />} />
        <Route path="refer" element={<SupporterRefer />} />
        <Route path="profile" element={<SupporterProfile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <GlobalContactDrawer />
    </div>
    </ContactDrawerProvider>
  );
}

export default App;
