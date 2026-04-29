import { Fragment } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { ChevronLeftIcon, ChevronRightIcon } from './Icons.jsx';
import styles from './ListPageControls.module.css';

function resolveVariant(variant, showViewMore) {
  if (variant === 'table' || variant === 'feed' || variant === 'minimal') return variant;
  if (showViewMore === false) return 'table';
  if (showViewMore === true) return 'feed';
  return 'table';
}

/**
 * @param {'table' | 'feed' | 'minimal'} [variant] — `table`: Previous / Next / page numbers (dense data).
 *   `feed`: link-style “Show earlier” / “View more” only.
 *   `minimal`: icon buttons wrapping range text (compact).
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
  variant,
  showViewMore,
}) {
  const { t } = useI18n();
  const mode = resolveVariant(variant, showViewMore);
  if (total <= 0) return null;

  const wrapClass = className ? `${styles.footer} ${className}` : styles.footer;

  if (mode === 'minimal') {
    return (
      <div className={`${wrapClass} ${styles.minimal}`}>
        <button type="button" className={styles.iconBtn} disabled={!canPrev} onClick={onPrev} aria-label={t('listings.prev')}>
          <ChevronLeftIcon size={14} />
        </button>
        <p className={styles.meta}>
          {t('listings.showingRange', { from: rangeFrom, to: rangeTo, total })}
        </p>
        <button type="button" className={styles.iconBtn} disabled={!canNext} onClick={onNext} aria-label={t('listings.next')}>
          <ChevronRightIcon size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className={wrapClass}>
      <p className={styles.meta}>
        {t('listings.showingRange', { from: rangeFrom, to: rangeTo, total })}
      </p>
      <nav
        className={styles.nav}
        aria-label={mode === 'feed' ? t('listings.ariaFeed') : t('listings.ariaPagination')}
      >
        {mode === 'feed' ? (
          <>
            {canPrev ? (
              <button type="button" className={styles.viewMore} onClick={onPrev}>
                {t('listings.showEarlier')}
              </button>
            ) : null}
            {canNext ? (
              <button type="button" className={styles.viewMore} onClick={onNext}>
                {t('listings.viewMore')}
              </button>
            ) : null}
          </>
        ) : (
          <>
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
          </>
        )}
      </nav>
    </div>
  );
}
