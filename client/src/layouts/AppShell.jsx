import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Navigate, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { allowedSegmentForRole, NAV_BY_ROLE, ROLE_LABELS } from '../constants/rbac.js';
import { getMessagesForRole, getNotificationsForRole, usePortalState } from '../data/mockPortal.js';
import '../theme.css';
import styles from './AppShell.module.css';
import { getWorkspaceRail } from './workspaceRail.js';

function AppIcon({ kind }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true };
  if (kind === 'dashboard') {
    return (
      <svg {...common}>
        <path d="M4 13h7V4H4zm9 7h7V4h-7zm-9 0h7v-5H4z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'inventory' || kind === 'visibility') {
    return (
      <svg {...common}>
        <path d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5v-9Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 4v16M4 7.5l8 3.5 8-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'documents') {
    return (
      <svg {...common}>
        <path d="M6 4h9l3 3v13H6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9 12h6M9 16h6M9 8h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'requests' || kind === 'materials') {
    return (
      <svg {...common}>
        <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'approvals' || kind === 'rbac') {
    return (
      <svg {...common}>
        <path d="M7 5h7l3 3v11H7z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="m9 13 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'monitoring' || kind === 'activity') {
    return (
      <svg {...common}>
        <path d="M5 19V9M12 19V5M19 19v-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="5" r="1.3" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'reports' || kind === 'analytics' || kind === 'alerts') {
    return (
      <svg {...common}>
        <path d="M5 19V9M12 19V5M19 19v-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M4 19h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'users') {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4.5 18a4.5 4.5 0 0 1 9 0M17 11a2.5 2.5 0 1 0 0-5M18.8 18a3.3 3.3 0 0 0-2.8-3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'messages') {
    return (
      <svg {...common}>
        <path d="M5 6h14v9H9l-4 3V6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'payments') {
    return (
      <svg {...common}>
        <rect x="4" y="6" width="16" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4 10h16M8 15h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'invoices') {
    return (
      <svg {...common}>
        <path d="M7 4h10v16l-2-1.4L13 20l-2-1.4L9 20l-2-1.4L5 20V6a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9 9h6M9 13h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'inbox') {
    return (
      <svg {...common}>
        <path d="M4 13V6h16v7" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M5 13h4l2 3h2l2-3h4v4H5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'history') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'help') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9.8 9.6a2.4 2.4 0 1 1 4 1.9c-.7.52-1.3.98-1.3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="16.7" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'approved-proforma') {
    return (
      <svg {...common}>
        <path
          d="M7 4h10v16l-2-1.4L13 20l-2-1.4L9 20l-2-1.4L5 20V6a2 2 0 0 1 2-2Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'rejected-proforma') {
    return (
      <svg {...common}>
        <path
          d="M7 4h10v16l-2-1.4L13 20l-2-1.4L9 20l-2-1.4L5 20V6a2 2 0 0 1 2-2Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'settings') {
    return (
      <svg {...common}>
        <path
          d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M19 12a7 7 0 0 0-.08-1l2.04-1.6-2-3.46-2.48 1a7.2 7.2 0 0 0-1.72-1L14.5 3h-5l-.26 2.94a7.2 7.2 0 0 0-1.72 1l-2.48-1-2 3.46L5.08 11a7 7 0 0 0 0 2l-2.04 1.6 2 3.46 2.48-1a7.2 7.2 0 0 0 1.72 1L9.5 21h5l.26-2.94a7.2 7.2 0 0 0 1.72-1l2.48 1 2-3.46L18.92 13c.05-.33.08-.66.08-1Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
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

function ChevronDownIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9.6 9.2a2.5 2.5 0 1 1 4.2 2c-.7.58-1.3 1-1.3 2.05" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.8" r="1" fill="currentColor" />
    </svg>
  );
}

const SHELL_COPY = {
  eng: {
    workspace: 'Workspace',
    companyMark: 'Company mark',
    addNewItem: '+ Add new item',
    settings: 'Settings',
    logout: 'Logout',
    notifications: 'Notifications',
    messages: 'Messages',
    search: 'Search stock, requisitions, invoices, people…',
    accountSettings: 'Account settings',
    signOut: 'Sign out',
    helpCenter: 'HELP CENTER',
    portalLog: 'Portal log active',
    footerDetails: 'Automated inventory visibility, requisitioning, bilingual workflow support, and accountability',
    supportWindow: 'Support window: Mon - Fri, 8am - 6pm',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    theme: 'Theme',
  },
  kiny: {
    workspace: 'Ahakorerwa',
    companyMark: 'Ikirango cy\'ikigo',
    addNewItem: '+ Ongeramo igikoresho',
    settings: 'Amagenamiterere',
    logout: 'Sohoka',
    notifications: 'Amatangazo',
    messages: 'Ubutumwa',
    search: 'Shakisha ibikoresho, ibisabwa, inyemezabuguzi, abantu…',
    accountSettings: 'Igenamiterere rya konti',
    signOut: 'Sohoka',
    helpCenter: 'UBUFASHA',
    portalLog: 'Inyandiko za porotali zikora',
    footerDetails: 'Igenzura ry\'ibikoresho, ibisabwa, indimi ebyiri, n\'ubunyamwuga mu kubazwa',
    supportWindow: 'Ubufasha: Ku wa mbere - Ku wa gatanu, 8am - 6pm',
    light: 'Urumuri',
    dark: 'Umwijima',
    system: 'Sisitemu',
    theme: 'Insanganyamatsiko',
  },
};

const CLERK_NAV_TRANSLATIONS = {
  dashboard: 'Imbonerahamwe',
  inventory: 'Urutonde rw\'ibikoresho',
  expiry: 'Igenzura ry\'itariki',
  materials: 'Gusaba ibikoresho',
  requests: 'Ibikorwa by\'ububiko',
  alerts: 'Isesengura',
  documents: 'Kwishyuza ibikoresho',
  messages: 'Ubutumwa n\'amatangazo',
};

const SUPPLIER_NAV_TRANSLATIONS = {
  dashboard: 'Imbonerahamwe',
  inbox: 'Ibyateguriwe & proforma',
  'approved-proforma': 'Proforma zemejwe',
  'rejected-proforma': 'Proforma zakinzwe',
  documents: 'Kohereza & inyemezabuguzi',
  history: 'Amateka yo kohereza',
  messages: 'Ubutumwa n\'amatangazo',
};

export default function AppShell() {
  const { role, segment } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const portalState = usePortalState();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [language, setLanguage] = useState(() => {
    if (typeof window === 'undefined') return 'eng';
    return window.localStorage.getItem('ecunga-language') || 'eng';
  });
  const [themeMode, setThemeMode] = useState(() => {
    if (typeof window === 'undefined') return 'system';
    return window.localStorage.getItem('ecunga-theme-mode') || 'system';
  });
  const [resolvedTheme, setResolvedTheme] = useState('light');
  const accountMenuRef = useRef(null);

  if (!user) return null;
  if (role !== user.role) {
    return <Navigate to={`/app/${user.role}/dashboard`} replace />;
  }
  if (!segment || !allowedSegmentForRole(role, segment)) {
    return <Navigate to={`/app/${user.role}/dashboard`} replace />;
  }

  const nav = NAV_BY_ROLE[role] || [];
  const copy = SHELL_COPY[language] || SHELL_COPY.eng;
  const notifications = getNotificationsForRole(role);
  const messages = getMessagesForRole(role);
  const notificationCount = notifications.length;
  const messageCount = messages.length;
  const notificationTarget =
    nav.find((item) => item.segment === 'alerts')?.segment ||
    nav.find((item) => item.segment === 'approvals')?.segment ||
    nav.find((item) => item.segment === 'inbox')?.segment ||
    nav.find((item) => item.segment === 'activity')?.segment ||
    'dashboard';
  const messageTarget =
    nav.find((item) => item.segment === 'messages')?.segment || nav.find((item) => item.segment === 'settings')?.segment || 'dashboard';
  const settingsTarget = nav.find((item) => item.segment === 'settings')?.segment || 'dashboard';
  const addItemTarget =
    role === 'clerk'
      ? 'requests'
      : role === 'supervisor'
        ? 'reports'
        : role === 'accountant'
          ? 'invoices'
          : role === 'admin'
            ? 'users'
            : role === 'supplier'
              ? 'inbox'
              : 'dashboard';
  const primaryActionLabel =
    role === 'supervisor'
      ? language === 'kiny'
        ? '+ Kora raporo'
        : '+ Generate report'
      : copy.addNewItem;
  const profileTarget = nav.find((item) => item.segment === 'dashboard')?.segment || 'dashboard';
  const initials = (user.fullName || user.email || 'EC')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
  const identityMeta = user.location || user.team || '';
  const supplierBrandName = role === 'supplier' ? user.fullName || user.email || 'Supplier' : null;
  const supplierMark = supplierBrandName
    ? supplierBrandName
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0] || '')
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : null;

  function translateNavItem(item) {
    if (language !== 'kiny') return item.label;
    if (role === 'clerk') return CLERK_NAV_TRANSLATIONS[item.segment] || item.label;
    if (role === 'supplier') return SUPPLIER_NAV_TRANSLATIONS[item.segment] || item.label;
    return item.label;
  }

  function routeGroupTabs() {
    if (role === 'clerk') {
      return [
        { id: 'overview', label: language === 'kiny' ? 'Incamake' : 'Overview', segment: 'dashboard', active: ['dashboard', 'inventory', 'expiry'].includes(segment) },
        { id: 'operations', label: language === 'kiny' ? 'Ibikorwa' : 'Operations', segment: 'requests', active: ['requests', 'materials', 'usage'].includes(segment) },
        { id: 'reports', label: language === 'kiny' ? 'Raporo' : 'Reports', segment: 'alerts', active: ['alerts', 'documents', 'messages'].includes(segment) },
      ];
    }
    if (role === 'supervisor') {
      return [
        { id: 'overview', label: language === 'kiny' ? 'Incamake' : 'Overview', segment: 'dashboard', active: ['dashboard', 'visibility'].includes(segment) },
        { id: 'reviews', label: language === 'kiny' ? 'Isuzuma' : 'Reviews', segment: 'approvals', active: ['approvals', 'invoices'].includes(segment) },
        { id: 'reports', label: language === 'kiny' ? 'Raporo' : 'Reports', segment: 'reports', active: ['reports', 'messages'].includes(segment) },
      ];
    }
    if (role === 'accountant') {
      return [
        { id: 'overview', label: language === 'kiny' ? 'Incamake' : 'Overview', segment: 'dashboard', active: ['dashboard', 'approvals'].includes(segment) },
        { id: 'finance', label: language === 'kiny' ? 'Imari' : 'Finance', segment: 'invoices', active: ['invoices', 'payments'].includes(segment) },
        { id: 'reports', label: language === 'kiny' ? 'Raporo' : 'Reports', segment: 'reports', active: ['reports', 'messages'].includes(segment) },
      ];
    }
    if (role === 'admin') {
      return [
        { id: 'overview', label: language === 'kiny' ? 'Incamake' : 'Overview', segment: 'dashboard', active: ['dashboard', 'users', 'rbac'].includes(segment) },
        { id: 'control', label: language === 'kiny' ? 'Igenzura' : 'Control', segment: 'settings', active: ['settings', 'activity'].includes(segment) },
        { id: 'support', label: language === 'kiny' ? 'Ubufasha' : 'Support', segment: 'help', active: ['help', 'reports'].includes(segment) },
      ];
    }
    if (role === 'supplier') {
      return [
        {
          id: 'overview',
          label: language === 'kiny' ? 'Incamake' : 'Overview',
          segment: 'dashboard',
          active: ['dashboard', 'inbox', 'approved-proforma', 'rejected-proforma'].includes(segment),
        },
        {
          id: 'fulfilment',
          label: language === 'kiny' ? 'Kohereza' : 'Fulfilment',
          segment: 'documents',
          active: ['documents', 'history'].includes(segment),
        },
        { id: 'messages', label: language === 'kiny' ? 'Ubutumwa' : 'Messages', segment: 'messages', active: ['messages'].includes(segment) },
      ];
    }
    return [];
  }

  const shellTabs = routeGroupTabs();

  const railConfig = useMemo(
    () =>
      getWorkspaceRail({
        role,
        segment,
        language,
        portalState,
        user,
        notificationCount,
        messageCount,
      }),
    [role, segment, language, portalState, user, notificationCount, messageCount]
  );

  const insightTarget =
    role === 'clerk'
      ? 'alerts'
      : role === 'supervisor'
        ? 'reports'
        : role === 'accountant'
          ? 'reports'
          : role === 'supplier'
            ? 'history'
            : 'reports';
  const openWorkflowCount =
    role === 'clerk'
      ? portalState.requisitions.filter((entry) => entry.clerkId === portalState.users.find((u) => u.email === user?.email)?.id && entry.status !== 'closed').length
      : notificationCount + messageCount;

  function goTo(segmentName) {
    navigate(`/app/${role}/${segmentName}`);
    setAccountMenuOpen(false);
  }

  function signOut() {
    logout();
    setAccountMenuOpen(false);
    navigate('/login');
  }

  useEffect(() => {
    function handlePointer(event) {
      if (!accountMenuRef.current?.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setAccountMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem('ecunga-language', language);
  }, [language]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    function applyTheme() {
      const nextTheme = themeMode === 'system' ? (media.matches ? 'dark' : 'light') : themeMode;
      document.documentElement.setAttribute('data-ec-theme', nextTheme);
      document.documentElement.style.colorScheme = nextTheme;
      setResolvedTheme(nextTheme);
    }

    applyTheme();
    window.localStorage.setItem('ecunga-theme-mode', themeMode);
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [themeMode]);

  return (
    <div className={styles.app}>
      <aside className={styles.sidebar} aria-label="Application">
        <div className={styles.sideHead}>
          <span className={supplierBrandName ? `${styles.logoMark} ${styles.logoMarkSupplier}` : styles.logoMark}>
            {supplierBrandName ? supplierMark : 'e'}
          </span>
          <div>
            {supplierBrandName ? (
              <>
                <div className={styles.logoText}>{supplierBrandName}</div>
                <div className={styles.logoSub}>
                  Supplier · {portalState.company?.name || 'e-CUNGA'}
                </div>
              </>
            ) : (
              <div className={styles.logoText}>e-CUNGA</div>
            )}
          </div>
        </div>
        <div className={styles.workspaceMeta}>
          <div className={styles.workspaceProfile}>
            <span className={styles.workspaceAvatar} aria-hidden>
              {initials || 'EC'}
            </span>
            <div className={styles.workspaceInfo}>
              <strong className={styles.workspaceName}>{user.fullName || user.email}</strong>
              <span className={styles.workspaceRole}>{ROLE_LABELS[user.role]}</span>
            </div>
          </div>
          {identityMeta ? <span className={styles.metaPill}>{identityMeta}</span> : null}
          <span className={styles.metaHint}>{user.email}</span>
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
              {translateNavItem(item)}
            </NavLink>
          ))}
        </nav>
        <div className={styles.sideFoot}>
          <button type="button" className={styles.sidePrimaryBtn} onClick={() => goTo(addItemTarget)}>
            {primaryActionLabel}
          </button>
          <button type="button" className={styles.ghostBtn} onClick={() => goTo(settingsTarget)}>
            <span className={styles.ghostBtnInner}>
              <span className={styles.ghostBtnIcon} aria-hidden>
                <AppIcon kind="settings" />
              </span>
              {copy.settings}
            </span>
          </button>
          <button
            type="button"
            className={styles.logout}
            onClick={signOut}
          >
            {copy.logout}
          </button>
        </div>
      </aside>
      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <div className={styles.search} role="search">
              <span className={styles.searchIcon} aria-hidden>
                <SearchIcon />
              </span>
              <input type="search" placeholder={copy.search} className={styles.searchInput} />
            </div>
            {shellTabs.length ? (
              <div className={styles.shellTabs} role="tablist" aria-label="Workflow groups">
                {shellTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={tab.active ? `${styles.shellTab} ${styles.shellTabActive}` : styles.shellTab}
                    onClick={() => goTo(tab.segment)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <div className={styles.topRight}>
            <button type="button" className={styles.insightBtn} onClick={() => goTo(insightTarget)}>
              <span className={styles.insightSpark} aria-hidden>
                *
              </span>
              <span>AI Insights</span>
              <span className={styles.insightCount}>{openWorkflowCount}</span>
            </button>
            <div className={styles.langSwitch} role="group" aria-label="Language switcher">
              <button
                type="button"
                className={language === 'eng' ? `${styles.langBtn} ${styles.langBtnActive}` : styles.langBtn}
                onClick={() => setLanguage('eng')}
              >
                ENG
              </button>
              <button
                type="button"
                className={language === 'kiny' ? `${styles.langBtn} ${styles.langBtnActive}` : styles.langBtn}
                onClick={() => setLanguage('kiny')}
              >
                KINY
              </button>
            </div>
            <div className={styles.themeSwitch} role="group" aria-label={copy.theme}>
              <button
                type="button"
                className={themeMode === 'light' ? `${styles.themeBtn} ${styles.themeBtnActive}` : styles.themeBtn}
                onClick={() => setThemeMode('light')}
                title={copy.light}
              >
                {copy.light}
              </button>
              <button
                type="button"
                className={themeMode === 'dark' ? `${styles.themeBtn} ${styles.themeBtnActive}` : styles.themeBtn}
                onClick={() => setThemeMode('dark')}
                title={copy.dark}
              >
                {copy.dark}
              </button>
              <button
                type="button"
                className={themeMode === 'system' ? `${styles.themeBtn} ${styles.themeBtnActive}` : styles.themeBtn}
                onClick={() => setThemeMode('system')}
                title={copy.system}
              >
                {copy.system}
              </button>
            </div>
            <button type="button" className={styles.iconBtn} aria-label={copy.notifications} onClick={() => goTo(notificationTarget)}>
              <BellIcon />
              {notificationCount ? <span className={styles.iconCount}>{notificationCount}</span> : null}
            </button>
            <button type="button" className={styles.iconBtn} aria-label={copy.messages} onClick={() => goTo(messageTarget)}>
              <ChatIcon />
              {messageCount ? <span className={styles.iconCount}>{messageCount}</span> : null}
            </button>
            <div className={styles.accountMenuWrap} ref={accountMenuRef}>
              <button
                type="button"
                className={styles.profileBtn}
                onClick={() => setAccountMenuOpen((current) => !current)}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
              >
                <span className={styles.avatar} aria-hidden>
                  {initials}
                </span>
                <div className={styles.profileText}>
                  <span className={styles.profileName}>{user.fullName || user.email}</span>
                  <span className={styles.profileRole}>{ROLE_LABELS[user.role]}</span>
                </div>
                <span className={styles.profileChevron} aria-hidden>
                  <ChevronDownIcon />
                </span>
              </button>

              {accountMenuOpen ? (
                <div className={styles.accountMenu} role="menu" aria-label="Account menu">
                  <div className={styles.accountMenuHeader}>
                    <span className={styles.accountMenuAvatar} aria-hidden>
                      {initials}
                    </span>
                    <div className={styles.accountMenuIdentity}>
                      <strong>{user.fullName || 'Account holder'}</strong>
                      <span>{user.email}</span>
                      <span>{user.location || 'Assigned workspace'} · {ROLE_LABELS[user.role]}</span>
                    </div>
                  </div>

                  <div className={styles.accountMenuGroup}>
                    <div className={styles.accountMenuThemeBlock}>
                      <span className={styles.accountMenuThemeLabel}>
                        {copy.theme}: {resolvedTheme === 'dark' ? copy.dark : copy.light}
                      </span>
                      <div className={styles.accountMenuThemeBtns}>
                        <button
                          type="button"
                          className={themeMode === 'light' ? `${styles.accountMenuThemeBtn} ${styles.accountMenuThemeBtnActive}` : styles.accountMenuThemeBtn}
                          onClick={() => setThemeMode('light')}
                        >
                          {copy.light}
                        </button>
                        <button
                          type="button"
                          className={themeMode === 'dark' ? `${styles.accountMenuThemeBtn} ${styles.accountMenuThemeBtnActive}` : styles.accountMenuThemeBtn}
                          onClick={() => setThemeMode('dark')}
                        >
                          {copy.dark}
                        </button>
                        <button
                          type="button"
                          className={themeMode === 'system' ? `${styles.accountMenuThemeBtn} ${styles.accountMenuThemeBtnActive}` : styles.accountMenuThemeBtn}
                          onClick={() => setThemeMode('system')}
                        >
                          {copy.system}
                        </button>
                      </div>
                    </div>
                    <button type="button" className={styles.accountMenuItem} onClick={() => goTo(profileTarget)} role="menuitem">
                      My profile
                    </button>
                    <button type="button" className={styles.accountMenuItem} onClick={() => goTo(settingsTarget)} role="menuitem">
                      {copy.accountSettings}
                    </button>
                    <button type="button" className={styles.accountMenuItem} onClick={() => goTo(notificationTarget)} role="menuitem">
                      {copy.notifications}
                    </button>
                    <button type="button" className={styles.accountMenuItem} onClick={() => goTo(messageTarget)} role="menuitem">
                      {copy.messages}
                    </button>
                  </div>

                  <div className={styles.accountMenuGroup}>
                    <button type="button" className={styles.accountMenuItem} onClick={signOut} role="menuitem">
                      {copy.signOut}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <div className={styles.contentGrid}>
          <div className={styles.contentMain}>
            <Outlet context={{ role, segment, user }} />
          </div>
          <aside className={styles.contentRail} aria-label="Page quick panel">
            <p className={styles.railEyebrow}>{railConfig.eyebrow}</p>
            <p className={styles.railTitle}>{railConfig.title}</p>
            <div className={styles.railMetrics}>
              {railConfig.metrics.map((row) => (
                <div key={String(row.label)} className={styles.railMetric}>
                  <span className={styles.railMetricValue}>{row.value}</span>
                  <span className={styles.railMetricLabel}>{row.label}</span>
                </div>
              ))}
            </div>
            <div className={styles.railNotify}>
              <span className={styles.railNotifyIcon} aria-hidden>
                {railConfig.notify.kind === 'chat' ? (
                  <ChatIcon />
                ) : railConfig.notify.kind === 'spark' ? (
                  <span className={styles.railSpark}>*</span>
                ) : (
                  <BellIcon />
                )}
              </span>
              <div>
                <p className={styles.railNotifyTitle}>{railConfig.notify.title}</p>
                <p className={styles.railNotifyMeta}>{railConfig.notify.meta}</p>
              </div>
            </div>
            {railConfig.actions?.length ? (
              <div className={styles.railActions}>
                <p className={styles.railActionsEyebrow}>{language === 'kiny' ? 'Gukora vuba' : 'Quick actions'}</p>
                <div className={styles.railActionRow}>
                  {railConfig.actions.map((action) => (
                    <button
                      key={action.segment + action.label}
                      type="button"
                      className={action.variant === 'primary' ? styles.railActionPrimary : styles.railActionGhost}
                      onClick={() => goTo(action.segment)}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div>
              <p className={styles.railShortcutsEyebrow}>{language === 'kiny' ? 'Inzira ngufi' : 'Related pages'}</p>
              <nav className={styles.railShortcuts} aria-label="Related sections">
                {railConfig.shortcuts.map((seg) => {
                  const item = nav.find((n) => n.segment === seg);
                  if (!item) return null;
                  return (
                    <NavLink
                      key={seg}
                      to={`/app/${role}/${seg}`}
                      className={({ isActive }) => (isActive ? styles.railShortcutActive : styles.railShortcut)}
                    >
                      {translateNavItem(item)}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
            <div className={styles.railTip}>
              <span className={styles.railTipMark} aria-hidden>
                *
              </span>
              <p className={styles.railTipText}>{railConfig.tip}</p>
            </div>
            <p className={styles.railFoot}>
              {language === 'kiny' ? 'Icyigereranyo' : 'Context panel'} · {segment} · {new Date().toLocaleDateString()}
            </p>
          </aside>
        </div>
        <footer className={styles.appFooter}>
          <span>{copy.portalLog}</span>
          <span>e-CUNGA · {user.fullName || user.email} · {ROLE_LABELS[user.role]}</span>
          <span>{copy.footerDetails}</span>
          <span>{copy.supportWindow}</span>
        </footer>
      </div>
      {role !== 'admin' ? (
        <button type="button" className={styles.helpCenter} onClick={() => navigate('/contact')}>
          <HelpIcon />
          <span>{copy.helpCenter}</span>
        </button>
      ) : null}
    </div>
  );
}
