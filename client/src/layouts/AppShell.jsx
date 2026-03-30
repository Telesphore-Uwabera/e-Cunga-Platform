import { NavLink, Navigate, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { allowedSegmentForRole, NAV_BY_ROLE, ROLE_LABELS } from '../constants/rbac.js';
import '../theme.css';
import styles from './AppShell.module.css';

function AppIcon({ kind }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true };
  if (kind === 'dashboard') {
    return (
      <svg {...common}>
        <path d="M4 13h7V4H4zm9 7h7V4h-7zm-9 0h7v-5H4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'inventory' || kind === 'documents') {
    return (
      <svg {...common}>
        <path d="M6 4h9l3 3v13H6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9 12h6M9 16h6M9 8h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'requests' || kind === 'approvals' || kind === 'rbac') {
    return (
      <svg {...common}>
        <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'reports' || kind === 'analytics') {
    return (
      <svg {...common}>
        <path d="M5 19V9M12 19V5M19 19v-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'users' || kind === 'messages') {
    return (
      <svg {...common}>
        <path d="M7 18h10a2 2 0 0 0 2-2V7H5v9a2 2 0 0 0 2 2Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="m6 8 6 5 6-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'settings') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M6 18 18 6M7 7h10v10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 9a5 5 0 1 1 10 0v4l1.5 2.5H5.5L7 13V9Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 6h14v9H9l-4 3V6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export default function AppShell() {
  const { role, segment } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;
  if (role !== user.role) {
    return <Navigate to={`/app/${user.role}/dashboard`} replace />;
  }
  if (!segment || !allowedSegmentForRole(role, segment)) {
    return <Navigate to={`/app/${user.role}/dashboard`} replace />;
  }

  const nav = NAV_BY_ROLE[role] || [];
  const title = ROLE_LABELS[role] || role;
  const notificationTarget =
    nav.find((item) => item.segment === 'alerts')?.segment ||
    nav.find((item) => item.segment === 'approvals')?.segment ||
    nav.find((item) => item.segment === 'inbox')?.segment ||
    nav.find((item) => item.segment === 'activity')?.segment ||
    'dashboard';
  const messageTarget =
    nav.find((item) => item.segment === 'messages')?.segment || nav.find((item) => item.segment === 'settings')?.segment || 'dashboard';
  const settingsTarget = nav.find((item) => item.segment === 'settings')?.segment || 'dashboard';
  const initials = (user.fullName || user.email || 'EC')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  function goTo(segmentName) {
    navigate(`/app/${role}/${segmentName}`);
  }

  return (
    <div className={styles.app}>
      <aside className={styles.sidebar} aria-label="Application">
        <div className={styles.sideHead}>
          <span className={styles.logoMark}>e</span>
          <div>
            <div className={styles.logoText}>e-CUNGA</div>
            <div className={styles.logoSub}>{title}</div>
          </div>
        </div>
        <div className={styles.workspaceMeta}>
          <span className={styles.metaLabel}>Workspace</span>
          <strong>{user.companyName || 'Your company'}</strong>
          <span className={styles.metaPill}>{ROLE_LABELS[user.role]}</span>
        </div>
        <nav className={styles.nav}>
          {nav.map((item) => (
            <NavLink
              key={item.segment}
              to={`/app/${role}/${item.segment}`}
              className={({ isActive }) => (isActive ? styles.navItemActive : styles.navItem)}
            >
              <span className={styles.navIcon} aria-hidden>
                <AppIcon kind={item.segment} />
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.sideFoot}>
          <button type="button" className={styles.ghostBtn} onClick={() => goTo(notificationTarget)}>
            Notifications
          </button>
          <button type="button" className={styles.ghostBtn} onClick={() => goTo(messageTarget)}>
            Messages
          </button>
          <button type="button" className={styles.ghostBtn} onClick={() => goTo(settingsTarget)}>
            EN / RW
          </button>
          <button
            type="button"
            className={styles.logout}
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Logout
          </button>
        </div>
      </aside>
      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.search} role="search">
            <span className={styles.searchIcon} aria-hidden>
              <SearchIcon />
            </span>
            <input type="search" placeholder="Search stock, requisitions, invoices, people…" className={styles.searchInput} />
          </div>
          <div className={styles.topRight}>
            <button type="button" className={styles.iconBtn} aria-label="Notifications" onClick={() => goTo(notificationTarget)}>
              <BellIcon />
            </button>
            <button type="button" className={styles.iconBtn} aria-label="Messages" onClick={() => goTo(messageTarget)}>
              <ChatIcon />
            </button>
            <div className={styles.profile}>
              <span className={styles.avatar} aria-hidden>
                {initials}
              </span>
              <div className={styles.profileText}>
                <span className={styles.profileName}>{user.fullName || user.email}</span>
                <span className={styles.profileRole}>{ROLE_LABELS[user.role]}</span>
              </div>
            </div>
          </div>
        </header>
        <div className={styles.content}>
          <Outlet context={{ role, segment, user }} />
        </div>
        <footer className={styles.appFooter}>
          e-CUNGA · {user.companyName || 'Your company'} · automated inventory visibility, requisitioning, and accountability
        </footer>
      </div>
    </div>
  );
}
