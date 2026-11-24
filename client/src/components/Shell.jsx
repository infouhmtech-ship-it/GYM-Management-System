import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { ROLE_LABELS } from '../constants.js';

const GROUPS = [
  {
    label: 'Floor',
    items: [
      { to: '/', label: 'Overview', roles: ['owner', 'front_desk', 'trainer'], end: true },
      { to: '/check-in', label: 'Check-in', roles: ['owner', 'front_desk'] },
      { to: '/schedule', label: 'Schedule', roles: ['owner', 'front_desk', 'trainer', 'member'] },
    ],
  },
  {
    label: 'People',
    items: [
      { to: '/leads', label: 'Pipeline', roles: ['owner', 'front_desk', 'trainer'] },
      { to: '/members', label: 'Members', roles: ['owner', 'front_desk', 'trainer'] },
      { to: '/me', label: 'My membership', roles: ['member'], end: true },
      { to: '/team', label: 'Team', roles: ['owner', 'front_desk', 'trainer'] },
    ],
  },
  {
    label: 'Club',
    items: [
      { to: '/billing', label: 'Billing', roles: ['owner', 'front_desk'] },
      { to: '/plans', label: 'Plans', roles: ['owner', 'front_desk', 'trainer'] },
    ],
  },
];

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);
  return (
    <time dateTime={now.toISOString()}>
      {now.toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })}
    </time>
  );
}

export default function Shell() {
  const { user, logout } = useAuth();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">A</div>
          <div>
            <strong>APEX</strong>
            <p>Athletic Club</p>
          </div>
        </div>
        <nav className="nav">
          {GROUPS.map((group) => {
            const items = group.items.filter((item) => item.roles.includes(user.role));
            if (!items.length) return null;
            return (
              <div key={group.label} className="nav-group">
                <p className="nav-label">{group.label}</p>
                {items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
                    {item.label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          {user.role !== 'member' && (
            <a className="quiet-link" href="/join">
              Public enquiry form
            </a>
          )}
          <div className="who">
            <strong>{user.name}</strong>
            <span>{user.title || ROLE_LABELS[user.role]}</span>
          </div>
          <button type="button" className="btn btn-ghost btn-small" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <p>14-C MM Alam Road · Gulberg III, Lahore</p>
          <Clock />
        </header>
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
