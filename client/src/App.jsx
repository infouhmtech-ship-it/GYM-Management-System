import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { homeFor } from './constants.js';
import { FullScreen } from './components/ui.jsx';
import Shell from './components/Shell.jsx';
import LoginPage from './pages/LoginPage.jsx';
import JoinPage from './pages/JoinPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import CheckInPage from './pages/CheckInPage.jsx';
import LeadsPage from './pages/LeadsPage.jsx';
import MembersPage from './pages/MembersPage.jsx';
import MemberPage from './pages/MemberPage.jsx';
import SchedulePage from './pages/SchedulePage.jsx';
import BillingPage from './pages/BillingPage.jsx';
import PlansPage from './pages/PlansPage.jsx';
import TeamPage from './pages/TeamPage.jsx';
import PortalPage from './pages/PortalPage.jsx';

function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <FullScreen message="Opening the floor…" />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Guard({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return children;
}

const floor = ['owner', 'front_desk', 'trainer'];
const desk = ['owner', 'front_desk'];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/join" element={<JoinPage />} />
      <Route
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Guard roles={floor}><DashboardPage /></Guard>} />
        <Route path="/check-in" element={<Guard roles={desk}><CheckInPage /></Guard>} />
        <Route path="/leads" element={<Guard roles={floor}><LeadsPage /></Guard>} />
        <Route path="/members" element={<Guard roles={floor}><MembersPage /></Guard>} />
        <Route path="/members/:id" element={<Guard roles={floor}><MemberPage /></Guard>} />
        <Route path="/schedule" element={<Guard roles={[...floor, 'member']}><SchedulePage /></Guard>} />
        <Route path="/billing" element={<Guard roles={desk}><BillingPage /></Guard>} />
        <Route path="/plans" element={<Guard roles={floor}><PlansPage /></Guard>} />
        <Route path="/team" element={<Guard roles={floor}><TeamPage /></Guard>} />
        <Route path="/me" element={<Guard roles={['member']}><PortalPage /></Guard>} />
        <Route path="*" element={<Fallback />} />
      </Route>
    </Routes>
  );
}

function Fallback() {
  const { user } = useAuth();
  return <Navigate to={homeFor(user)} replace />;
}
