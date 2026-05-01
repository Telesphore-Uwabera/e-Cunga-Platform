import { useWorkspaceAiInsight } from '../hooks/useWorkspaceAiInsight.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import styles from './WorkspaceAiInsight.module.css';

function formatBody(text) {
  if (!text) return [];
  const chunks = text.split(/\n\n+/).map((s) => s.trim()).filter(Boolean);
  if (chunks.length <= 1 && text.includes('•')) {
    return text.split('\n').map((s) => s.trim()).filter(Boolean);
  }
  return chunks.length ? chunks : [text];
}

/**
 * Loads role-scoped AI guidance from /api/insights/workspace (OpenAI + live Mongo snapshot).
 */
export default function WorkspaceAiInsight({ scope, fallbackText, children, showRefresh = true }) {
  const { language, t } = useI18n();
  const { loading, body, source, error, cached, refresh, metrics } = useWorkspaceAiInsight(scope, language);

  const display = loading ? 'loading' : body ? 'live' : 'fallback';

  const fallback =
    fallbackText ||
    (source === 'disabled'
      ? t('ai.insightDisabled')
      : source === 'rate_limited'
        ? t('ai.insightRateLimited')
        : error || source === 'error'
          ? t('ai.insightError')
          : t('ai.insightDisabled'));

  return (
    <>
      {display === 'loading' ? <p className={styles.loading}>{t('ai.insightLoading')}</p> : null}
      {display === 'live' ? (
        <div className={styles.body}>
          {formatBody(body).map((para, i) => (
            <p key={i} className={styles.paragraph}>
              {para}
            </p>
          ))}
        </div>
      ) : null}
      {display === 'fallback' && !loading ? <p className={styles.fallback}>{fallback}</p> : null}
      {showRefresh ? (
        <div className={styles.metaRow}>
          <button type="button" className={styles.refreshBtn} disabled={loading} onClick={() => refresh()}>
            {t('ai.refreshInsight')}
          </button>
          {cached && body ? <span className={styles.cachedHint}>{t('ai.cachedHint')}</span> : null}
        </div>
      ) : null}
      {!loading && metrics?.asOf ? (
        <p className={styles.metricsFoot}>
          {t('ai.metricsSource', {
            time: new Date(metrics.asOf).toLocaleString(language === 'kiny' ? 'rw-RW' : undefined),
            sku: metrics.stock?.skuCount ?? '—',
            low: metrics.stock?.lowStockPercentOfSkus ?? '—',
            reqTotal: metrics.requisitions?.totalCount ?? '—',
            reqInternal: metrics.requisitions?.internalReviewPercentOfTotal ?? '—',
            reqSupplier: metrics.requisitions?.atSupplierPercentOfTotal ?? '—',
            act: metrics.activity?.percentChangeVsPriorWeek ?? '—',
          })}
        </p>
      ) : null}
      {children}
    </>
  );
}
