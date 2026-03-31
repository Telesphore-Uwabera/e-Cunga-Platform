import { Fragment } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';
import styles from './ListPageControls.module.css';

/**
 * Shared pagination: latest slice is controlled by usePagedList (typically 6 per page).
 */
export default function ListPageControls({
  rangeFrom,
  rangeTo,
  total,
  page,
  pageCount,
  pagerNums,
  onPrev,
  onNext,
  onSelectPage,
  canPrev,
  canNext,
  className,
  showPageNumbers = true,
}) {
  const { t } = useI18n();
  if (total <= 0) return null;

  const wrapClass = className ? `${styles.footer} ${className}` : styles.footer;

  return (
    <div className={wrapClass}>
      <p className={styles.meta}>
        {t('listings.showingRange', { from: rangeFrom, to: rangeTo, total })}
      </p>
      <nav className={styles.nav} aria-label={t('listings.ariaPagination')}>
        <button type="button" className={styles.btn} disabled={!canPrev} onClick={onPrev}>
          {t('listings.prev')}
        </button>
        {showPageNumbers && pageCount > 1
          ? pagerNums.map((n, idx) => (
              <Fragment key={n}>
                {idx > 0 && pagerNums[idx] - pagerNums[idx - 1] > 1 ? (
                  <span className={styles.ellipsis} aria-hidden>
                    …
                  </span>
                ) : null}
                <button
                  type="button"
                  className={n === page ? styles.btnActive : styles.btn}
                  onClick={() => onSelectPage(n)}
                  aria-current={n === page ? 'page' : undefined}
                >
                  {n}
                </button>
              </Fragment>
            ))
          : null}
        <button type="button" className={styles.btn} disabled={!canNext} onClick={onNext}>
          {t('listings.next')}
        </button>
        <button type="button" className={styles.viewMore} disabled={!canNext} onClick={onNext}>
          {t('listings.viewMore')}
        </button>
      </nav>
    </div>
  );
}
