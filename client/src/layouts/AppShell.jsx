import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { GlobalFlashBanner } from '../context/FlashContext.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';
import { allowedSegmentForRole, NAV_BY_ROLE } from '../constants/rbac.js';
import { messagesForRole, notificationsForRole, usePortalData } from '../context/PortalStateContext.jsx';
import '../theme.css';
import styles from './AppShell.module.css';
import LangFlag from '../components/LangFlag.jsx';
import { EcungaSidebarIcon, EcungaWordmarkAdaptive } from '../components/EcungaLogo.jsx';
import HelpWidget from '../components/HelpWidget.jsx';
import { getWorkspaceRail } from './workspaceRail.js';
import { syncDocumentTheme } from '../utils/documentTheme.js';
import { scrollAppShellContentToTop } from '../utils/hashNavigation.js';
import { cleanRemoteLogoUrl, workspaceAvatarUrlChain } from '../utils/workspaceBranding.js';
import { AddItemModal } from '../components/StockManagementModals.jsx';
import {
  ClerkBillItemModal,
} from '../pages/app/clerkPages.jsx';
import { getToken, resolveApiUrl } from '../api/client.js';

/**
 * Nav links that use emphasis styling (`.navItemApprovals`, `.navItemBill`) are shown
 * after all standard links so the highlighted card sits at the bottom of the list.
 */
function useWorkspaceAvatarChain(company, user) {
  const chain = useMemo(() => workspaceAvatarUrlChain(company, user), [company?.logoUrl, user?.logoUrl]);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    setIdx(0);
  }, [chain.join('|')]);
  const url = idx < chain.length ? chain[idx] : '';
  const onImgError = useCallback(() => {
    setIdx((i) => Math.min(i + 1, chain.length));
  }, [chain.length]);
  return { url, onImgError, hasImage: Boolean(url) };
}

/**
 * Full-screen slide-in Cunga AI chat panel.
 * Sends messages to POST /api/insights/chat with the live workspace snapshot as context.
 */
function CungaAiChat({ role, open, onClose }) {
  const { user } = useAuth();
  const { language } = useI18n();
  const [messages, setMessages] = useState([]); // { role: 'user'|'ai', text: string }
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 120);
      // Send a welcome analysis on first open
      if (messages.length === 0) {
        sendMessage('Give me a quick overview of my workspace right now — key metrics and what needs my attention today.');
      }
    }
  }, [open]);

  async function sendMessage(text) {
    const userText = String(text || input).trim();
    if (!userText) return;
    setInput('');
    setError('');
    const userMsg = { role: 'user', text: userText };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const token = getToken();
      const url = resolveApiUrl('/insights/chat');
      const history = messages.map((m) => ({ role: m.role === 'ai' ? 'model' : 'user', text: m.text }));

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message: userText, history, scope: role, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Unable to get a response.');
      setMessages((prev) => [...prev, { role: 'ai', text: data.reply }]);
    } catch (e) {
      setError(e.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!loading && input.trim()) sendMessage(input);
  }

  const suggestions = {
    clerk: ['Show low-stock items', 'What expires this week?', 'My consumption this month'],
    supervisor: ['Approval queue summary', 'Which requisitions are critical?', 'Team activity this week'],
    accountant: ['Overdue invoices', 'Outstanding balance total', 'What should I pay first?'],
    admin: ['Workspace health summary', 'Team composition', 'Stock risk overview'],
    supplier: ['My open invoices', 'Stalled orders', 'Catalog performance'],
  };
  const chips = suggestions[role] || suggestions.admin;

  if (!open) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 14000, display: 'flex', justifyContent: 'flex-end' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.38)', backdropFilter: 'blur(2px)' }} aria-hidden />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cunga AI"
        style={{ position: 'relative', width: 'min(440px, 98vw)', height: '100%', background: 'var(--ec-surface)', boxShadow: '-8px 0 48px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column' }}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem 0.9rem', background: 'linear-gradient(135deg, var(--ec-primary) 0%, color-mix(in srgb,var(--ec-primary) 70%,#000) 100%)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.4rem', lineHeight: 1, color: '#fff' }}>✦</span>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: '1.05rem', color: '#fff' }}>Cunga AI</p>
              <p style={{ margin: 0, fontSize: '0.68rem', color: 'rgba(255,255,255,0.72)' }}>
                {role} · Live workspace data · Powered by Gemini
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                title="Clear conversation"
                style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '6px', padding: '0.3rem 0.5rem', cursor: 'pointer', color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: '2rem', height: '2rem', cursor: 'pointer', color: '#fff', fontSize: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ×
            </button>
          </div>
        </div>

        {/* ── Messages ───────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {messages.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--ec-muted)' }}>
              <p style={{ fontSize: '2rem', margin: '0 0 0.5rem' }}>✦</p>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: 'var(--ec-text)' }}>Ask Cunga AI anything</p>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem' }}>About your stock, invoices, team, or orders — it reads your live data.</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {msg.role === 'ai' && (
                <span style={{ flexShrink: 0, width: '1.75rem', height: '1.75rem', borderRadius: '50%', background: 'var(--ec-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, marginRight: '0.5rem', marginTop: '0.15rem' }}>✦</span>
              )}
              <div style={{
                maxWidth: '82%',
                padding: '0.6rem 0.85rem',
                borderRadius: msg.role === 'user' ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
                background: msg.role === 'user'
                  ? 'var(--ec-primary)'
                  : 'color-mix(in srgb, var(--ec-primary) 6%, var(--ec-bg))',
                color: msg.role === 'user' ? '#fff' : 'var(--ec-text)',
                fontSize: '0.84rem',
                lineHeight: 1.6,
                border: msg.role === 'ai' ? '1px solid color-mix(in srgb,var(--ec-primary) 15%,transparent)' : 'none',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {msg.text}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ flexShrink: 0, width: '1.75rem', height: '1.75rem', borderRadius: '50%', background: 'var(--ec-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>✦</span>
              <div style={{ padding: '0.55rem 0.85rem', borderRadius: '1rem 1rem 1rem 0.25rem', background: 'color-mix(in srgb,var(--ec-primary) 6%,var(--ec-bg))', border: '1px solid color-mix(in srgb,var(--ec-primary) 15%,transparent)', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                {[0, 1, 2].map((d) => (
                  <span key={d} style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--ec-primary)', opacity: 0.7, animation: `aiDot 1.2s ${d * 0.4}s infinite ease-in-out alternate` }} />
                ))}
              </div>
            </div>
          )}

          {error && (
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#dc2626', padding: '0.5rem 0.75rem', background: 'rgba(220,38,38,0.06)', borderRadius: '0.5rem', border: '1px solid rgba(220,38,38,0.2)' }}>
              {error}
            </p>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Quick-action chips ──────────────────────────────────── */}
        {messages.length === 0 && (
          <div style={{ padding: '0 1.1rem 0.75rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', flexShrink: 0 }}>
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => sendMessage(chip)}
                disabled={loading}
                style={{ padding: '0.32rem 0.7rem', borderRadius: '999px', border: '1.5px solid color-mix(in srgb,var(--ec-primary) 35%,transparent)', background: 'color-mix(in srgb,var(--ec-primary) 5%,transparent)', color: 'var(--ec-primary)', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* ── Input ──────────────────────────────────────────────── */}
        <form
          onSubmit={handleSubmit}
          style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--ec-border)', display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexShrink: 0 }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
            placeholder="Ask about your stock, invoices, team…"
            rows={1}
            disabled={loading}
            style={{ flex: 1, padding: '0.6rem 0.8rem', border: '1.5px solid var(--ec-border)', borderRadius: '0.75rem', resize: 'none', fontFamily: 'inherit', fontSize: '0.85rem', background: 'var(--ec-bg)', color: 'var(--ec-text)', lineHeight: 1.5, outline: 'none', maxHeight: '120px', overflowY: 'auto' }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', border: 'none', background: input.trim() && !loading ? 'var(--ec-primary)' : 'var(--ec-border)', color: input.trim() && !loading ? '#fff' : 'var(--ec-muted)', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.1rem', transition: 'background 0.15s' }}
            aria-label="Send"
          >
            ↑
          </button>
        </form>

        {/* Dot animation keyframes */}
        <style>{`@keyframes aiDot{from{transform:translateY(0)}to{transform:translateY(-4px)}}`}</style>
      </div>
    </div>
  );
}

function orderSidebarNavEmphasisLast(role, items) {
  const emphasized = [];
  const normal = [];
  for (const item of items) {
    const isEmphasized =
      item.segment === 'approvals' || (role === 'clerk' && item.segment === 'usage');
    if (isEmphasized) emphasized.push(item);
    else normal.push(item);
  }
  return [...normal, ...emphasized];
}

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
  if (kind === 'approvals' || kind === 'rbac' || kind === 'company-registrations') {
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
  if (kind === 'users' || kind === 'team' || kind === 'clerks' || kind === 'accountants' || kind === 'suppliers') {
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
  if (kind === 'delivery') {
    return (
      <svg {...common}>
        <path d="M3 7h11v10H3V7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path
          d="M14 11h3l3 3v3h-3M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
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
  if (kind === 'history' || kind === 'products') {
    return (
      <svg {...common}>
        <path d="M8 4h8l2 2v14H6V6l2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M9 10h6M9 14h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
  if (kind === 'settings' || kind === 'preferences') {
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
  if (kind === 'profile' || kind === 'account-settings') {
    return (
      <svg {...common}>
        <circle cx="12" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M6.5 20.2v-.6c0-2.5 2.2-4.6 5.5-4.6s5.5 2.1 5.5 4.6v.6"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
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

function SunIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default function AppShell() {
  const { role, segment } = useParams();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useI18n();
  const navigate = useNavigate();
  const {
    state: portalState,
    apiMode,
    portalLoading,
    portalError,
    portalErrorMessage,
    refreshPortalState,
    switchCompany,
  } = usePortalData();

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [themeMode, setThemeMode] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    const raw = window.localStorage.getItem('ecunga-theme-mode') || 'light';
    if (raw === 'system') {
      const next = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      window.localStorage.setItem('ecunga-theme-mode', next);
      return next;
    }
    return raw === 'dark' ? 'dark' : 'light';
  });
  const [resolvedTheme, setResolvedTheme] = useState('light');
  const accountMenuRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const contentMainRef = useRef(null);
  const contentRailRef = useRef(null);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedShellSearch, setDebouncedShellSearch] = useState('');
  const [railSlot, setRailSlot] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [clerkAddModalOpen, setClerkAddModalOpen] = useState(false);
  const [clerkAddModalItem, setClerkAddModalItem] = useState(null);
  const [clerkAddModalPrefillMaster, setClerkAddModalPrefillMaster] = useState(null);
  const [clerkBillModalOpen, setClerkBillModalOpen] = useState(false);

  useEffect(() => {
    setRailSlot(null);
  }, [segment, role]);

  useLayoutEffect(() => {
    scrollAppShellContentToTop(contentMainRef.current, contentRailRef.current);
    setAiPanelOpen(false); // close AI drawer on every navigation
  }, [location.pathname, location.search, location.hash]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedShellSearch(searchInput), 280);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('ecunga-shell-search', { detail: { query: debouncedShellSearch } }));
  }, [debouncedShellSearch]);


  useEffect(() => {
    setSearchInput('');
  }, [segment, role]);

  useEffect(() => {
    function onOpenAddItem(e) {
      setClerkAddModalItem(e.detail?.item || null);
      setClerkAddModalPrefillMaster(e.detail?.prefillMaster || null);
      setClerkAddModalOpen(true);
    }
    function onOpenBillItem() {
      setClerkBillModalOpen(true);
    }
    window.addEventListener('ecunga-open-add-item-modal', onOpenAddItem);
    window.addEventListener('ecunga-open-bill-item-modal', onOpenBillItem);
    return () => {
      window.removeEventListener('ecunga-open-add-item-modal', onOpenAddItem);
      window.removeEventListener('ecunga-open-bill-item-modal', onOpenBillItem);
    };
  }, []);

  const nav = (() => {
    if (!role) return [];
    let base = [...(NAV_BY_ROLE[role] || [])];
    if (role === 'admin' && user?.canApproveRegistrations) {
      const idx = base.findIndex((item) => item.segment === 'reports');
      const row = { segment: 'company-registrations', label: 'Company registrations' };
      if (idx >= 0) base.splice(idx, 0, row);
      else base.push(row);
    }
    return orderSidebarNavEmphasisLast(role, base);
  })();

  const notifications = notificationsForRole(portalState, role, user?.id).filter(n => !n.isRead);
  const messages = messagesForRole(portalState, role, user?.id).filter(m => !m.isRead);
  const notificationCount = notifications.length;
  const messageCount = messages.length;
  const notificationTarget = role === 'admin' ? 'activity' : 'notifications';
  const messageTarget = 'messages';
  const settingsTarget = nav.find((item) => item.segment === 'settings')?.segment || 'account-settings';
  /** Personal account (password, notifications): not the same as company-wide "Settings" for admin/supervisor. */
  const accountSettingsSegment = (() => {
    if (role === 'supervisor') return 'preferences';
    if (role === 'admin' || role === 'supplier') return 'account-settings';
    if (role === 'clerk' || role === 'accountant') {
      return nav.some((item) => item.segment === 'settings') ? 'settings' : 'account-settings';
    }
    return 'account-settings';
  })();
  /** Footer also has a "Settings" shortcut; hide it when Settings is already a main nav item (supplier, admin). */
  const settingsInMainNav = nav.some((item) => item.segment === 'settings');
  const addItemTarget =
    role === 'clerk'
      ? 'materials'
      : role === 'admin'
        ? 'materials'
        : role === 'supervisor'
          ? 'clerks'
          : role === 'accountant'
            ? 'invoices'
            : role === 'supplier'
              ? 'product-edit'
              : 'dashboard';
  const primaryActionLabel =
    role === 'supervisor' && (segment === 'suppliers' || segment === 'supplier-directory')
      ? t('shell.addSupplier')
      : role === 'supervisor' || role === 'clerk'
        ? t('shell.addNewItem')
        : role === 'supplier'
          ? t('shell.addNewProduct')
          : t('shell.addNewItem');
  const profileTarget = 'profile';
  const initials = (user?.fullName || user?.email || 'EC')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  function translateNavItem(item) {
    const key = `nav.${role}.${item.segment}`;
    const translated = t(key);
    return translated !== key ? translated : item.label;
  }

  function labelForNavSegment(seg) {
    const item = nav.find((n) => n.segment === seg);
    if (item) return translateNavItem(item);
    const key = `nav.${role}.${seg}`;
    const translated = t(key);
    return translated !== key ? translated : seg;
  }

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
        t,
      }),
    [role, segment, language, portalState, user, notificationCount, messageCount, t]
  );

  const insightTarget =
    role === 'clerk'
      ? 'alerts'
      : role === 'supervisor'
        ? 'reports'
        : role === 'accountant'
          ? 'reports'
          : role === 'supplier'
            ? 'products'
            : 'reports';
  const openWorkflowCount =
    role === 'clerk'
      ? portalState.requisitions.filter((entry) => entry.clerkId === portalState.users.find((u) => u.email === user?.email)?.id && entry.status !== 'closed').length
      : notificationCount + messageCount;

  function goTo(segmentName) {
    navigate(`/app/${role}/${segmentName}`);
    setAccountMenuOpen(false);
  }

  /** Admin "Add new item" targets Users; opening invite when already on that route needs explicit handling. */
  function goToPrimaryAction() {
    setAccountMenuOpen(false);
    if (role === 'clerk' || (role === 'admin' && addItemTarget === 'materials')) {
      window.dispatchEvent(new CustomEvent('ecunga-open-add-item-modal'));
      return;
    }
    if (role === 'admin' && addItemTarget === 'users') {
      if (segment === 'users') {
        window.dispatchEvent(new CustomEvent('ecunga-admin-users-open-invite'));
        return;
      }
      navigate(`/app/${role}/users`, { state: { openInvite: true } });
      return;
    }
    if (role === 'supervisor') {
      if (segment === 'suppliers' || segment === 'supplier-directory') {
        navigate(`/app/${role}/supplier-directory`);
        return;
      }
      window.dispatchEvent(new CustomEvent('ecunga-open-add-item-modal'));
      return;
    }
    navigate(`/app/${role}/${addItemTarget}`);
  }

  function signOut() {
    logout();
    setAccountMenuOpen(false);
    navigate('/login', { replace: true });
  }

  useEffect(() => {
    function handlePointer(event) {
      if (!accountMenuRef.current?.contains(event.target)) {
        setAccountMenuOpen(false);
      }
      if (!mobileMenuRef.current?.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        setAccountMenuOpen(false);
        setMobileMenuOpen(false);
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
    if (typeof window === 'undefined') return undefined;
    const resolved = syncDocumentTheme(themeMode);
    setResolvedTheme(resolved);
    window.localStorage.setItem('ecunga-theme-mode', themeMode);
  }, [themeMode]);

  const avatar = useWorkspaceAvatarChain(portalState?.company, user);

  if (!user) return null;
  if (role !== user.role) {
    return <Navigate to={`/app/${user.role}/dashboard`} replace />;
  }
  if (!segment || !allowedSegmentForRole(role, segment, user)) {
    return <Navigate to={`/app/${user.role}/dashboard`} replace />;
  }

  const hasUsableOrgLogo = Boolean(cleanRemoteLogoUrl(portalState?.company?.logoUrl));
  const sidebarBrandInitial = (portalState?.company?.name || user?.companyName || user?.fullName || '?')
    .trim()
    .charAt(0)
    .toUpperCase();
  const showSidebarWorkspaceRow = Boolean(user?.companyName || portalState?.company?.name);

  return (
    <div className={styles.app}>
      <GlobalFlashBanner />
      <aside className={styles.sidebar} aria-label={t('shell.applicationAria')}>
        <div className={styles.sideHead}>
          <Link to={`/app/${role}/dashboard`} style={{ textDecoration: 'none' }}>
            <EcungaWordmarkAdaptive size="lg" centered />
          </Link>
          {showSidebarWorkspaceRow && (
            <div className={styles.companyRowSidebar}>
              <div className={styles.companyBadge}>
                {avatar.hasImage ? (
                  <img
                    src={avatar.url}
                    alt={portalState?.company?.name || user?.companyName || ''}
                    className={styles.companyLogoImg}
                    onError={avatar.onImgError}
                  />
                ) : (
                  sidebarBrandInitial
                )}
              </div>
              <div className={styles.companyInfo}>
                <span className={styles.companyNameSidebar}>{(user.fullName || user.companyName || '').split(' ')[0]}</span>
                <span className={styles.companyRoleSidebar}>· {t(`roles.${user.role}`)}</span>
              </div>
            </div>
          )}
        </div>
        <div className={styles.sidebarNavScroll}>
          <nav className={styles.nav} aria-label={t('shell.workspaceNav')}>
            {nav.map((item) => {
              const clerkRecordUsageModal = role === 'clerk' && item.segment === 'usage';
              const approvalsNav = item.segment === 'approvals';
              if (clerkRecordUsageModal) {
                return (
                  <button
                    key={item.segment}
                    type="button"
                    className={styles.navItemBill}
                    onClick={() => window.dispatchEvent(new CustomEvent('ecunga-open-bill-item-modal'))}
                  >
                    <span className={styles.navIcon} aria-hidden>
                      <AppIcon kind={item.segment} />
                    </span>
                    {translateNavItem(item)}
                  </button>
                );
              }
              return (
                <NavLink
                  key={item.segment}
                  to={`/app/${role}/${item.segment}`}
                  className={({ isActive }) => {
                    if (approvalsNav) {
                      return isActive
                        ? `${styles.navItemApprovals} ${styles.navItemApprovalsActive}`
                        : styles.navItemApprovals;
                    }
                    return isActive ? styles.navItemActive : styles.navItem;
                  }}
                >
                  <span className={styles.navIcon} aria-hidden>
                    <AppIcon kind={item.segment} />
                  </span>
                  {translateNavItem(item)}
                </NavLink>
              );
            })}
          </nav>
        </div>
        <div className={styles.sideFoot}>
          {role !== 'accountant' && (
            <button type="button" className={styles.sidePrimaryBtn} onClick={goToPrimaryAction}>
              <span className={styles.sidePrimaryBtnPlus}>+</span>
              <span className={styles.sidePrimaryBtnLabel}>{primaryActionLabel}</span>
            </button>
          )}
          {settingsInMainNav ? null : (
            <button type="button" className={styles.ghostBtn} onClick={() => goTo(settingsTarget)}>
              <span className={styles.ghostBtnInner}>
                <span className={styles.ghostBtnIcon} aria-hidden>
                  <AppIcon kind="settings" />
                </span>
                {t('shell.settings')}
              </span>
            </button>
          )}
          <button
            type="button"
            className={styles.logout}
            onClick={signOut}
          >
            {t('shell.logout')}
          </button>
        </div>
      </aside>
      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topbarInner}>
            <div className={styles.topbarLeft}>
            <button
              type="button"
              className={styles.mobileMenuBtn}
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
            >
              <MenuIcon />
            </button>
            <div className={styles.topbarLogo}>
              <Link to={`/app/${role}/dashboard`} style={{ textDecoration: 'none' }}>
                <EcungaWordmarkAdaptive />
              </Link>
            </div>
            <div className={styles.search} role="search">
              <span className={styles.searchIcon} aria-hidden>
                <SearchIcon />
              </span>
              <input
                type="search"
                placeholder={segment === 'inbox' ? t('shell.searchInbox') : t('shell.search')}
                className={styles.searchInput}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label={segment === 'inbox' ? t('shell.searchInbox') : t('shell.search')}
              />
            </div>
          </div>

          <div className={styles.topRight}>
            <button
              type="button"
              className={styles.themeToggle}
              onClick={() => setThemeMode(themeMode === 'light' ? 'dark' : 'light')}
              title={themeMode === 'light' ? t('shell.switchToDark') : t('shell.switchToLight')}
              aria-label={themeMode === 'light' ? t('shell.switchToDark') : t('shell.switchToLight')}
            >
              {themeMode === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
            <button type="button" className={styles.iconBtn} aria-label={t('shell.notifications')} onClick={() => goTo(notificationTarget)}>
              <BellIcon />
              {notificationCount ? <span className={styles.iconCount}>{notificationCount}</span> : null}
            </button>
            <button type="button" className={styles.iconBtn} aria-label={t('shell.messages')} onClick={() => goTo(messageTarget)}>
              <ChatIcon />
              {messageCount ? <span className={styles.iconCount}>{messageCount}</span> : null}
            </button>
            {role === 'admin' && portalState.companies?.length > 1 && (
              <div className={styles.tenantSwitch}>
                <InventoryFilterSelect
                  value={portalState.selectedCompanyId}
                  onChange={switchCompany}
                  options={portalState.companies.map((c) => ({ value: c.id, label: c.name }))}
                />
              </div>
            )}
            <button type="button" className={`${styles.insightBtn} ${aiPanelOpen ? styles.insightBtnActive : ''}`} onClick={() => setAiPanelOpen((o) => !o)} aria-expanded={aiPanelOpen} aria-label="Open Cunga AI insights">
              <span className={styles.insightSpark} aria-hidden>
                *
              </span>
              <span>{t('shell.aiInsights')}</span>
              <span className={styles.insightCount}>{openWorkflowCount}</span>
            </button>
            <div className={styles.langSwitch} role="group" aria-label={t('shell.langAria')}>
              <button
                type="button"
                className={language === 'eng' ? `${styles.langBtn} ${styles.langBtnActive}` : styles.langBtn}
                onClick={() => setLanguage('eng')}
                title="English"
              >
                <LangFlag lang="eng" className={styles.langFlag} />
                ENG
              </button>
              <button
                type="button"
                className={language === 'kiny' ? `${styles.langBtn} ${styles.langBtnActive}` : styles.langBtn}
                onClick={() => setLanguage('kiny')}
                title="Kinyarwanda"
              >
                <LangFlag lang="kiny" className={styles.langFlag} />
                KINY
              </button>
            </div>
            <div className={styles.accountMenuWrap} ref={accountMenuRef}>
              <button
                type="button"
                className={styles.profileBtn}
                onClick={() => setAccountMenuOpen((current) => !current)}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
              >
                {avatar.hasImage ? (
                  <span className={`${styles.avatar} ${styles.avatarImageWrap}`} aria-hidden>
                    <img src={avatar.url} alt="" className={styles.avatarImage} onError={avatar.onImgError} />
                  </span>
                ) : (
                  <span className={styles.avatar} aria-hidden>
                    {initials}
                  </span>
                )}
                <div className={styles.profileText}>
                  <span className={styles.profileName}>{(user.fullName || user.email || '').split(' ')[0]}</span>
                  <div className={styles.profileSpaceRow}>
                    {!(hasUsableOrgLogo && avatar.hasImage) && (user.fullName || user.companyName) ? (
                      <span className={styles.profileCompanyBadge}>
                        {(user.fullName || user.companyName || '?').charAt(0).toUpperCase()}
                      </span>
                    ) : null}
                    <span className={styles.profileRole}>{user.companyName || t(`roles.${user.role}`)}</span>
                  </div>
                </div>
                <span className={styles.profileChevron} aria-hidden>
                  <ChevronDownIcon />
                </span>
              </button>

              {accountMenuOpen ? (
                <div className={styles.accountMenu} role="menu" aria-label={t('shell.accountMenuAria')}>
                  <div className={styles.accountMenuHeader}>
                    {avatar.hasImage ? (
                      <span className={`${styles.accountMenuAvatar} ${styles.accountMenuAvatarImage}`} aria-hidden>
                        <img src={avatar.url} alt="" className={styles.accountMenuAvatarImg} onError={avatar.onImgError} />
                      </span>
                    ) : (
                      <span className={styles.accountMenuAvatar} aria-hidden>
                        {initials}
                      </span>
                    )}
                    <div className={styles.accountMenuIdentity}>
                      <strong>{(user.fullName || t('shell.accountHolder')).split(' ')[0]}</strong>
                      <span>{user.email}</span>
                      <span>
                        {user.location || t('shell.assignedWorkspace')} · {t(`roles.${user.role}`)}
                      </span>
                    </div>
                  </div>

                  <div className={styles.accountMenuGroup}>
                    <button type="button" className={styles.accountMenuItem} onClick={() => goTo(profileTarget)} role="menuitem">
                      {t('shell.myProfile')}
                    </button>
                    <button type="button" className={styles.accountMenuItem} onClick={() => goTo(accountSettingsSegment)} role="menuitem">
                      {t('shell.accountSettings')}
                    </button>
                    <button type="button" className={styles.accountMenuItem} onClick={() => goTo(messageTarget)} role="menuitem">
                      {t('shell.messages')}
                    </button>
                  </div>

                  <div className={styles.accountMenuGroup}>
                    <button type="button" className={styles.accountMenuItem} onClick={signOut} role="menuitem">
                      {t('shell.signOut')}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

        {(role === 'clerk' || role === 'admin' || role === 'supervisor') && (
          <>
            <AddItemModal
              isOpen={clerkAddModalOpen}
              onClose={() => {
                setClerkAddModalOpen(false);
                setClerkAddModalItem(null);
                setClerkAddModalPrefillMaster(null);
              }}
              item={clerkAddModalItem}
              prefillMaster={clerkAddModalPrefillMaster}
            />
            {role === 'clerk' && (
              <ClerkBillItemModal
                isOpen={clerkBillModalOpen}
                onClose={() => setClerkBillModalOpen(false)}
              />
            )}
          </>
        )}

        {mobileMenuOpen && (
          <div className={styles.mobileDrawerOverlay}>
            <aside className={styles.mobileDrawer} ref={mobileMenuRef}>
              <div className={styles.mobileDrawerHead}>
                <div className={styles.mobileDrawerHeadRow}>
                  <Link
                    className={styles.mobileDrawerBrand}
                    to={`/app/${role}/dashboard`}
                    style={{ textDecoration: 'none' }}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <EcungaWordmarkAdaptive className={styles.mobileDrawerWordmark} />
                  </Link>
                  <div className={styles.mobileDrawerUser}>
                    <div className={styles.mobileDrawerUserAvatar}>
                      {avatar.hasImage ? (
                        <img
                          src={avatar.url}
                          alt=""
                          className={styles.companyLogoImg}
                          onError={avatar.onImgError}
                        />
                      ) : (
                        <span aria-hidden>{sidebarBrandInitial}</span>
                      )}
                    </div>
                    <div className={styles.mobileDrawerUserMeta}>
                      <span className={styles.mobileDrawerUserName}>
                        {(user.fullName || user.email || user.companyName || 'User').trim()}
                      </span>
                      <span className={styles.mobileDrawerUserRole}>{t(`roles.${user.role}`)}</span>
                    </div>
                  </div>
                  <button type="button" className={styles.drawerClose} onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">
                    <CloseIcon />
                  </button>
                </div>
              </div>
              <div className={styles.mobileDrawerBody}>
                <div className={styles.mobileDrawerNav}>
                  {nav.map((item) => {
                    const clerkRecordUsageModal = role === 'clerk' && item.segment === 'usage';
                    if (clerkRecordUsageModal) {
                      return (
                        <button
                          key={item.segment}
                          type="button"
                          className={styles.drawerNavItem}
                          onClick={() => {
                            setMobileMenuOpen(false);
                            window.dispatchEvent(new CustomEvent('ecunga-open-bill-item-modal'));
                          }}
                        >
                          <span className={styles.navIcon} aria-hidden>
                            <AppIcon kind={item.segment} />
                          </span>
                          {translateNavItem(item)}
                        </button>
                      );
                    }
                    return (
                      <NavLink
                        key={item.segment}
                        to={`/app/${role}/${item.segment}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className={({ isActive }) =>
                          item.segment === 'approvals'
                            ? isActive
                              ? `${styles.drawerNavItemApprovals} ${styles.drawerNavItemApprovalsActive}`
                              : styles.drawerNavItemApprovals
                            : isActive
                              ? styles.drawerNavItemActive
                              : styles.drawerNavItem
                        }
                      >
                        <span className={styles.navIcon} aria-hidden>
                          <AppIcon kind={item.segment} />
                        </span>
                        {translateNavItem(item)}
                      </NavLink>
                    );
                  })}
                </div>
                <div className={styles.mobileDrawerFoot}>
                  <button type="button" className={styles.sidePrimaryBtn} onClick={goToPrimaryAction}>
                    {primaryActionLabel}
                  </button>
                  <button type="button" className={styles.drawerLogout} onClick={signOut}>
                    {t('shell.logout')}
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )}

        <nav className={styles.mobileBottomNav}>
          {nav.slice(0, 5).map((item) => (
            <NavLink
              key={item.segment}
              to={`/app/${role}/${item.segment}`}
              className={({ isActive }) =>
                item.segment === 'approvals'
                  ? isActive
                    ? `${styles.bottomNavItemApprovals} ${styles.bottomNavItemApprovalsActive}`
                    : styles.bottomNavItemApprovals
                  : isActive
                    ? styles.bottomNavItemActive
                    : styles.bottomNavItem
              }
            >
              <span className={styles.bottomNavIcon}>
                <AppIcon kind={item.segment} />
              </span>
              <span className={styles.bottomNavLabel}>{translateNavItem(item)}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.contentGrid}>
          <div ref={contentMainRef} className={styles.contentMain}>
            {(role === 'clerk' ||
              role === 'supervisor' ||
              role === 'accountant' ||
              role === 'supplier' ||
              role === 'admin') &&
            portalLoading || (user && apiMode === null) ? (
              <div role="status" style={{ padding: '2rem' }}>
                <p>Loading workspace…</p>
              </div>
            ) : (role === 'clerk' ||
                role === 'supervisor' ||
                role === 'accountant' ||
                role === 'supplier' ||
                role === 'admin') &&
              portalError ? (
              <div style={{ padding: '2rem', maxWidth: '32rem' }}>
                <p style={{ marginBottom: '1rem' }}>{portalErrorMessage}</p>
                <button type="button" className={styles.accountMenuItem} onClick={() => refreshPortalState()}>
                  Retry
                </button>
              </div>
            ) : (
              <Outlet context={{ role, segment, user, setRailSlot }} />
            )}
          </div>
          <aside ref={contentRailRef} className={styles.contentRail} aria-label="Page quick panel">
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
            {railConfig.notify ? (
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
            ) : null}
            {railConfig.actions?.length ? (
              <div className={styles.railActions}>
                <p className={styles.railActionsEyebrow}>{t('shell.quickActions')}</p>
                <div className={styles.railActionRow}>
                  {railConfig.actions.map((action) => (
                    <button
                      key={action.segment + action.label}
                      type="button"
                      className={action.variant === 'primary' ? styles.railActionPrimary : styles.railActionGhost}
                      onClick={() => {
                        if (
                          role === 'supervisor' &&
                          segment === action.segment &&
                          ['clerks', 'accountants', 'suppliers', 'team'].includes(segment)
                        ) {
                          window.dispatchEvent(new CustomEvent('ecunga-supervisor-team-open-invite'));
                          return;
                        }
                        if (role === 'clerk' && action.segment === 'usage') {
                          window.dispatchEvent(new CustomEvent('ecunga-open-bill-item-modal'));
                          return;
                        }
                        goTo(action.segment);
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {railSlot ? <div className={styles.railSlot}>{railSlot}</div> : null}
            <div className={styles.railShortcutsBlock}>
              <p className={styles.railShortcutsEyebrow}>{t('shell.relatedPages')}</p>
              <nav className={styles.railShortcuts} aria-label="Related sections">
                {railConfig.shortcuts.map((seg) => (
                  <NavLink
                    key={seg}
                    to={`/app/${role}/${seg}`}
                    className={({ isActive }) => (isActive ? styles.railShortcutActive : styles.railShortcut)}
                  >
                    {labelForNavSegment(seg)}
                  </NavLink>
                ))}
              </nav>
            </div>
            <div className={styles.railTip}>
              <span className={styles.railTipMark} aria-hidden>
                *
              </span>
              <p className={styles.railTipText}>{railConfig.tip}</p>
            </div>
            <p className={styles.railFoot}>
              {t('shell.contextPanel')} · {segment} · {new Date().toLocaleDateString()}
            </p>
          </aside>
        </div>
        <footer className={styles.appFooter}>
          <span>
            <Link to="/terms" className={styles.footerLegalLink}>
              {t('shell.termsAndConditions')}
            </Link>
            {' · '}
            <Link to="/privacy" className={styles.footerLegalLink}>
              {t('shell.privacyPolicy')}
            </Link>
            {' · '}
            {t('shell.supportWindow')}
          </span>
        </footer>
      </div>
      {role !== 'admin' ? <HelpWidget /> : null}

      <CungaAiChat role={role} open={aiPanelOpen} onClose={() => setAiPanelOpen(false)} />
    </div>
  );
}
