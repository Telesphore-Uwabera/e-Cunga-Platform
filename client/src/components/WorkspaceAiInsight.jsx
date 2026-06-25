import { useState } from 'react';
import { useWorkspaceAiInsight } from '../hooks/useWorkspaceAiInsight.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import styles from './WorkspaceAiInsight.module.css';

/* ── Section icons keyed by common title keywords ───────────────────────── */
const SECTION_ICON_MAP = [
  [/stock|inventory|expir|item|sku/i, '📦'],
  [/requisition|approval|queue|request/i, '📋'],
  [/invoice|payment|proforma|finance|amount|cash|overdue/i, '💳'],
  [/team|user|staff|activit/i, '👥'],
  [/action|priority|urgent|next|recommend/i, '⚡'],
  [/supplier|vendor|catalog/i, '🏭'],
  [/consumption|usage|velocity/i, '📊'],
];

function sectionIcon(title) {
  if (!title) return '💡';
  for (const [re, icon] of SECTION_ICON_MAP) {
    if (re.test(title)) return icon;
  }
  return '💡';
}

/* ── Fallback: parse plain-text body into pseudo-sections ───────────────── */
function parsePlainText(text) {
  if (!text) return [];
  const chunks = text.split(/\n\n+/).map((s) => s.trim()).filter(Boolean);
  if (chunks.length > 1) {
    return chunks.map((c) => ({ title: null, points: [c] }));
  }
  if (text.includes('•')) {
    const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
    return [{ title: null, points: lines }];
  }
  return [{ title: null, points: [text] }];
}

/* ── Metrics summary bar ─────────────────────────────────────────────────── */
function MetricsBar({ metrics, t, language }) {
  if (!metrics?.asOf) return null;
  const m = metrics;
  const items = [
    { label: '📦', value: m.stock?.skuCount ?? '—', hint: 'SKUs' },
    { label: '⚠️', value: `${m.stock?.lowStockPercentOfSkus ?? '—'}%`, hint: 'low stock' },
    { label: '📋', value: m.requisitions?.totalCount ?? '—', hint: 'requisitions' },
    { label: '💳', value: m.invoices?.openPipelineCount ?? '—', hint: 'open invoices' },
    m.invoices?.overdueCount > 0
      ? { label: '🔴', value: m.invoices.overdueCount, hint: 'overdue', urgent: true }
      : null,
    m.stock?.expiringWithin7DaysCount > 0
      ? { label: '⏰', value: m.stock.expiringWithin7DaysCount, hint: 'expiring <7d', urgent: true }
      : null,
  ].filter(Boolean);

  return (
    <div className={styles.metricsBar}>
      {items.map((item, i) => (
        <span key={i} className={`${styles.metricChip} ${item.urgent ? styles.metricChipUrgent : ''}`}>
          <span className={styles.metricIcon}>{item.label}</span>
          <strong>{item.value}</strong>
          <span className={styles.metricHint}>{item.hint}</span>
        </span>
      ))}
      <span className={styles.metricTimestamp}>
        {t('ai.snapshotAt')} {new Date(metrics.asOf).toLocaleTimeString(
          language === 'kiny' ? 'rw-RW' : undefined,
          { hour: '2-digit', minute: '2-digit' }
        )}
      </span>
    </div>
  );
}

/* ── Loading skeleton ────────────────────────────────────────────────────── */
function LoadingSkeleton() {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <div className={styles.skeletonHeader} />
      <div className={styles.skeletonLine} style={{ width: '92%' }} />
      <div className={styles.skeletonLine} style={{ width: '78%' }} />
      <div className={styles.skeletonLine} style={{ width: '85%' }} />
      <div className={styles.skeletonHeader} style={{ marginTop: '1rem', width: '40%' }} />
      <div className={styles.skeletonLine} style={{ width: '88%' }} />
      <div className={styles.skeletonLine} style={{ width: '70%' }} />
    </div>
  );
}

/* ── Copy button ─────────────────────────────────────────────────────────── */
function CopyButton({ text, t }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  };
  return (
    <button type="button" className={styles.copyBtn} onClick={handleCopy} title={t('ai.copyInsight')}>
      {copied ? '✓' : '⎘'}
    </button>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
/**
 * Renders role-scoped Cunga AI guidance from /api/insights/workspace.
 */
export default function WorkspaceAiInsight({
  scope,
  fallbackText,
  children,
  showRefresh = true,
  showMetrics = true,
  compact = false,
}) {
  const { language, t } = useI18n();
  const { loading, body, sections, source, error, cached, refresh, metrics } =
    useWorkspaceAiInsight(scope, language);

  const display = loading ? 'loading' : (body || sections) ? 'live' : 'fallback';

  const fallback =
    fallbackText ||
    (source === 'disabled'
      ? t('ai.insightDisabled')
      : source === 'rate_limited'
        ? t('ai.insightRateLimited')
        : error || source === 'error'
          ? t('ai.insightError')
          : t('ai.insightDisabled'));

  // Resolve what to render: structured sections or parsed plain text
  const renderedSections = sections && sections.length > 0
    ? sections
    : body
      ? parsePlainText(body)
      : [];

  return (
    <div className={`${styles.root} ${compact ? styles.compact : ''}`}>
      {/* Metrics bar — shown even while loading if we have stale metrics */}
      {showMetrics && (display !== 'loading' || metrics) && (
        <MetricsBar metrics={metrics} t={t} language={language} />
      )}

      {/* Loading state */}
      {display === 'loading' && (
        <div className={styles.loadingWrap}>
          <LoadingSkeleton />
          <p className={styles.loadingLabel}>
            <span className={styles.spinner} aria-hidden="true" />
            {t('ai.insightLoading')}
          </p>
        </div>
      )}

      {/* Live insight — structured sections */}
      {display === 'live' && renderedSections.length > 0 && (
        <div className={styles.sectionsWrap}>
          {renderedSections.map((section, si) => (
            <div key={si} className={styles.section}>
              {section.title && (
                <h4 className={styles.sectionTitle}>
                  <span className={styles.sectionIcon} aria-hidden="true">
                    {sectionIcon(section.title)}
                  </span>
                  {section.title}
                </h4>
              )}
              <ul className={styles.pointList}>
                {(section.points || []).map((point, pi) => (
                  <li key={pi} className={styles.point}>
                    {String(point).replace(/^[•\-–]\s*/, '')}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Fallback */}
      {display === 'fallback' && !loading && (
        <p className={styles.fallback}>{fallback}</p>
      )}

      {/* Footer row: refresh + cache hint + copy */}
      {showRefresh && (
        <div className={styles.footRow}>
          <button
            type="button"
            className={styles.refreshBtn}
            disabled={loading}
            onClick={() => refresh()}
          >
            <span className={styles.refreshIcon} aria-hidden="true">↻</span>
            {t('ai.refreshInsight')}
          </button>
          {cached && body && (
            <span className={styles.cachedHint}>{t('ai.cachedHint')}</span>
          )}
          {body && !loading && (
            <CopyButton text={body} t={t} />
          )}
          {source === 'gemini' && body && !loading && (
            <span className={styles.poweredBy} title="Powered by Google Gemini">✦ Gemini</span>
          )}
        </div>
      )}

      {children}
    </div>
  );
}
