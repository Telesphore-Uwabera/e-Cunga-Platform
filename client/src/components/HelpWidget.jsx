import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext.jsx';
import styles from './HelpWidget.module.css';

function ChatBubbleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <path
        d="M5 6.5c0-1.4 1.1-2.5 2.5-2.5h9C17.9 4 19 5.1 19 6.5v7c0 1.4-1.1 2.5-2.5 2.5H10l-4.5 3V6.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8 9h8M8 12h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function HelpWidget() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('faq');
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const faqs = useMemo(() => {
    const items = [
      { q: t('pricing.faq1q'), a: t('pricing.faq1a') },
      { q: t('pricing.faq2q'), a: t('pricing.faq2a') },
      { q: t('auth.forgotPassword'), a: t('auth.resetLead') || 'Use “Forgot password” to receive a reset link by email.' },
      { q: t('shell.supportWindow'), a: t('shell.supportWindow') },
    ];
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((it) => (it.q || '').toLowerCase().includes(needle) || (it.a || '').toLowerCase().includes(needle));
  }, [q, t]);

  return (
    <div className={styles.wrap} aria-live="polite">
      {open ? (
        <div className={styles.panel} role="dialog" aria-label={t('shell.helpCenter')}>
          <div className={styles.panelHead}>
            <div className={styles.panelTitle}>
              <strong>{t('shell.helpCenter')}</strong>
              <span>{tab === 'faq' ? 'Search FAQs' : 'Contact support'}</span>
            </div>
            <button type="button" className={styles.panelClose} onClick={() => setOpen(false)} aria-label="Close help">
              <CloseIcon width={16} height={16} />
            </button>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Help tabs">
            <button
              type="button"
              className={tab === 'faq' ? styles.tabOn : styles.tab}
              onClick={() => setTab('faq')}
              aria-selected={tab === 'faq'}
              role="tab"
            >
              FAQs
            </button>
            <button
              type="button"
              className={tab === 'message' ? styles.tabOn : styles.tab}
              onClick={() => setTab('message')}
              aria-selected={tab === 'message'}
              role="tab"
            >
              Message
            </button>
          </div>
          <div className={styles.body}>
            {tab === 'faq' ? (
              <>
                <div className={styles.searchRow}>
                  <SearchIcon width={16} height={16} />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search FAQs…" />
                </div>
                <div className={styles.list}>
                  {faqs.map((it) => (
                    <details key={it.q} className={styles.faqItem}>
                      <summary className={styles.faqSummary}>
                        <span>
                          {it.q}
                          <small>Tap to view answer</small>
                        </span>
                        <span aria-hidden>›</span>
                      </summary>
                      <div className={styles.faqBody}>{it.a}</div>
                    </details>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className={styles.msgBlock}>
                  <strong>Questions? Chat with us.</strong>
                  <p>Use the help desk to reach support or book a demo.</p>
                  <div className={styles.msgActions}>
                    <Link className={styles.linkBtn} to="/contact">
                      Open contact page
                    </Link>
                    <a className={styles.linkBtn} href="mailto:hello.ecunga@gmail.com">
                      Email support
                    </a>
                    <a className={styles.linkBtn} href="https://wa.me/250781975074" target="_blank" rel="noreferrer">
                      WhatsApp
                    </a>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      <button type="button" className={styles.fab} onClick={() => setOpen((v) => !v)} aria-label={t('shell.helpCenter')}>
        <ChatBubbleIcon className={styles.fabIcon} />
      </button>
    </div>
  );
}

