import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../api/client.js';
import { usePortalData } from '../../context/PortalStateContext.jsx';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { SearchIcon } from '../../components/Icons.jsx';
import ui from './DashboardUi.module.css';

function IconUserPlus() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 8v6M16 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MarketplaceConnectButton({ supplier, onConnect }) {
  const { t } = useI18n();
  if (supplier.linked) {
    return (
      <button
        type="button"
        className={`${ui.btnMarketplaceConnect} ${ui.btnMarketplaceConnectLinked}`}
        disabled
        aria-label={t('app.supervisor.marketplaceConnected')}
      >
        <IconCheck />
        {t('app.supervisor.marketplaceConnected')}
      </button>
    );
  }
  return (
    <button type="button" onClick={() => onConnect(supplier)} className={ui.btnMarketplaceConnect}>
      <IconUserPlus />
      {t('app.supervisor.marketplaceConnectCta')}
    </button>
  );
}

function SupplierCard({ supplier, onConnectSupplier, onOpenCatalog }) {
  return (
    <article className={ui.supplierFeaturedCard}>
      <div className={ui.supplierFeaturedHead}>
        <div>
          <h3 className={ui.supplierFeaturedName}>{supplier.companyName}</h3>
          <p className={ui.supplierFeaturedMeta}>
            {supplier.industry}
            {Number.isFinite(supplier.lowestPrice) && supplier.lowestPrice !== Number.POSITIVE_INFINITY
              ? ` · From ${supplier.lowestPrice.toLocaleString()} RWF (visible catalog)`
              : null}
          </p>
        </div>
        <span className={ui.supplierIndustry}>{supplier.industry}</span>
      </div>

      <dl className={`${ui.supplierDl} ${ui.supplierDlMarketplace}`}>
        <div>
          <dt>Contact</dt>
          <dd>{supplier.contactPerson || '—'}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{supplier.contactEmail || '—'}</dd>
        </div>
        <div>
          <dt>Phone</dt>
          <dd>{supplier.contactPhone || '—'}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{supplier.location || '—'}</dd>
        </div>
        <div>
          <dt>Catalog size</dt>
          <dd>{supplier.catalogSize ?? 0} items</dd>
        </div>
      </dl>

      <div className={ui.supplierActions}>
        <button type="button" onClick={() => onOpenCatalog(supplier.id)} className={ui.btnSecondary}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
          </svg>
          Full catalog
        </button>
        <a
          href={supplier.contactEmail ? `mailto:${supplier.contactEmail}` : '#'}
          className={ui.btnSecondary}
          onClick={(e) => {
            if (!supplier.contactEmail) e.preventDefault();
          }}
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="m22 6-10 7L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Contact supplier
        </a>
        <MarketplaceConnectButton supplier={supplier} onConnect={onConnectSupplier} />
      </div>
    </article>
  );
}

export default function SupplierDirectoryPage() {
  const { t } = useI18n();
  const { portalUsesLive, refreshPortalState, state } = usePortalData();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [buyerIndustry, setBuyerIndustry] = useState('');
  const [buyerIndustryLocked, setBuyerIndustryLocked] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [connectFlow, setConnectFlow] = useState(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const industries = useMemo(() => {
    const list = [
      'All',
      'Supplier',
      'Medical Equipment',
      'Pharmaceuticals',
      'Laboratory Supplies',
      'Surgical Supplies',
      'Hospital Furniture',
      'Disposables',
      'Other',
    ];
    const userInd = state?.company?.industry;
    if (userInd && !list.includes(userInd)) {
      list.push(userInd);
    }
    return list;
  }, [state?.company?.industry]);

  const locations = ['All', 'Kigali', 'Northern Province', 'Southern Province', 'Eastern Province', 'Western Province'];

  const rankedSuppliers = useMemo(() => {
    // Optimize: only calculate lowest price for sorting, use cached values if available
    function lowestCatalogPrice(supplier) {
      // If API already provided lowestPrice, use it
      if (supplier.lowestPrice !== undefined) return supplier.lowestPrice;
      const prices = (supplier.catalog || [])
        .map((item) => Number(item.price || 0))
        .filter((price) => Number.isFinite(price) && price > 0);
      if (!prices.length) return Number.POSITIVE_INFINITY;
      return Math.min(...prices);
    }
    // Sort suppliers without re-mapping to avoid recalculating prices
    return [...suppliers].sort((a, b) => {
      const priceA = lowestCatalogPrice(a);
      const priceB = lowestCatalogPrice(b);
      return priceA - priceB;
    });
  }, [suppliers]);
  const bestSupplier = rankedSuppliers[0] || null;
  const gridSuppliers = useMemo(() => {
    if (!bestSupplier) return rankedSuppliers;
    if (rankedSuppliers.length <= 1) return [];
    return rankedSuppliers.filter((s) => s.id !== bestSupplier.id);
  }, [rankedSuppliers, bestSupplier]);

  const openConnectFlow = useCallback((supplier) => {
    if (supplier.linked) return;
    setConnectFlow({
      supplier: { id: supplier.id, companyName: supplier.companyName || supplier.name || 'Supplier' },
      status: 'confirm',
    });
  }, []);

  const closeConnectFlow = useCallback(() => {
    setConnectFlow(null);
  }, []);

  const retryConnect = useCallback(() => {
    setConnectFlow((f) => (f?.supplier ? { supplier: f.supplier, status: 'confirm' } : null));
  }, []);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (!buyerIndustryLocked && selectedIndustry && selectedIndustry !== 'All') {
        params.append('industry', selectedIndustry);
      }
      if (selectedLocation && selectedLocation !== 'All') params.append('location', selectedLocation);

      const response = await apiFetch(`/supplier-directory${params.toString() ? `?${params.toString()}` : ''}`);
      setSuppliers(response.suppliers || []);
      setBuyerIndustry(response.buyerIndustry || '');
      setBuyerIndustryLocked(Boolean(response.buyerIndustryLocked));
    } catch (error) {
      console.error('Failed to load suppliers:', error);
      setSuppliers([]);
      setLoadError(error?.body?.error || error?.message || t('app.supervisor.marketplaceLoadError'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedIndustry, selectedLocation, buyerIndustryLocked, t]);

  // Debounce search term - wait 400ms before triggering search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const confirmConnect = useCallback(() => {
    setConnectFlow((f) => {
      if (!f?.supplier || f.status !== 'confirm') return f;
      const { supplier } = f;
      (async () => {
        try {
          if (!portalUsesLive) {
            throw new Error('Connect supplier requires a live workspace (database).');
          }
          await apiFetch(`/supplier-directory/${supplier.id}/connect`, { method: 'POST' });
          await refreshPortalState();
          await loadSuppliers();
          setConnectFlow((cur) =>
            cur?.supplier?.id === supplier.id ? { supplier, status: 'success' } : cur
          );
        } catch (error) {
          console.error('Failed to connect with supplier:', error);
          const message =
            error?.body?.error || error?.message || 'Failed to connect with supplier. Please try again.';
          setConnectFlow((cur) =>
            cur?.supplier?.id === supplier.id ? { supplier, status: 'error', errorMessage: message } : cur
          );
        }
      })();
      return { supplier, status: 'loading' };
    });
  }, [portalUsesLive, refreshPortalState, loadSuppliers]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  async function loadSupplierDetails(supplierId) {
    try {
      const response = await apiFetch(`/supplier-directory/${supplierId}`);
      setSelectedSupplier(response.supplier);
      setShowDetails(true);
    } catch (error) {
      console.error('Failed to load supplier details:', error);
    }
  }

  return (
    <div className={`${ui.page} ${ui.supplierMarketplacePage}`}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>{t('app.supervisor.marketplaceTitle')}</h1>
        <p className={ui.pageLead}>{t('app.supervisor.marketplaceLead')}</p>
      </div>

      {buyerIndustryLocked && buyerIndustry ? (
        <p className={ui.pageLead} role="status">
          {t('app.supervisor.marketplaceIndustryBanner', { industry: buyerIndustry })}
        </p>
      ) : null}

      <div className={`${ui.filtersSection} ${ui.supplierMarketplaceFilters}`}>
        <div className={ui.filterRow}>
          <div className={ui.searchBox}>
            <SearchIcon size={16} className={ui.searchIcon} />
            <input
              type="text"
              placeholder="Search suppliers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={ui.searchInput}
            />
          </div>

          <select
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            className={ui.filterSelect}
            disabled={buyerIndustryLocked}
            aria-disabled={buyerIndustryLocked}
          >
            {industries.map((industry) => (
              <option key={industry} value={industry}>
                {industry}
              </option>
            ))}
          </select>

          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className={ui.filterSelect}
          >
            {locations.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className={ui.loadingState}>
          <p>{t('app.supervisor.marketplaceLoading')}</p>
        </div>
      ) : loadError ? (
        <div className={ui.emptyState}>
          <p>{loadError}</p>
        </div>
      ) : suppliers.length === 0 ? (
        <div className={ui.emptyState}>
          <p>
            {!buyerIndustry && !buyerIndustryLocked
              ? t('app.supervisor.marketplaceEmptyNoIndustry')
              : t('app.supervisor.marketplaceEmpty')}
          </p>
        </div>
      ) : (
        <>
          {bestSupplier ? (
            <section className={ui.supplierFeaturedSection} aria-labelledby="supplier-featured-heading">
              <h2 id="supplier-featured-heading" className={ui.supplierSectionTitle}>
                {t('app.supervisor.marketplaceFeaturedTitle')}
              </h2>
              <p className={ui.supplierFeaturedLead}>{t('app.supervisor.marketplaceFeaturedLead')}</p>
              <div className={ui.supplierFeaturedCard}>
                <div className={ui.supplierFeaturedHead}>
                  <div>
                    <h3 className={ui.supplierFeaturedName}>{bestSupplier.companyName}</h3>
                    <p className={ui.supplierFeaturedMeta}>
                      {bestSupplier.industry}
                      {Number.isFinite(bestSupplier.lowestPrice) && bestSupplier.lowestPrice !== Number.POSITIVE_INFINITY
                        ? ` · From ${bestSupplier.lowestPrice.toLocaleString()} RWF (visible catalog)`
                        : null}
                    </p>
                  </div>
                  <span className={ui.supplierFeaturedBadge}>Cunga AI pick</span>
                </div>
                <dl className={`${ui.supplierDl} ${ui.supplierDlMarketplace}`}>
                  <div>
                    <dt>Contact</dt>
                    <dd>{bestSupplier.contactPerson || '—'}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{bestSupplier.contactEmail || '—'}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{bestSupplier.contactPhone || '—'}</dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>{bestSupplier.location || '—'}</dd>
                  </div>
                  <div>
                    <dt>Catalog size</dt>
                    <dd>{bestSupplier.catalogSize ?? 0} items</dd>
                  </div>
                </dl>
                <div className={ui.supplierActions}>
                  <button type="button" onClick={() => loadSupplierDetails(bestSupplier.id)} className={ui.btnSecondary}>
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
                    </svg>
                    Full catalog
                  </button>
                  <a
                    href={bestSupplier.contactEmail ? `mailto:${bestSupplier.contactEmail}` : '#'}
                    className={ui.btnSecondary}
                    onClick={(e) => {
                      if (!bestSupplier.contactEmail) e.preventDefault();
                    }}
                  >
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="m22 6-10 7L2 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Contact supplier
                  </a>
                  <MarketplaceConnectButton supplier={bestSupplier} onConnect={openConnectFlow} />
                </div>
              </div>
            </section>
          ) : null}

          {gridSuppliers.length ? (
            <>
              <h2 className={ui.supplierSectionTitle}>{t('app.supervisor.marketplaceAllTitle')}</h2>
              <div className={ui.supplierGrid}>
                {gridSuppliers.map((supplier) => (
                  <SupplierCard
                    key={supplier.id}
                    supplier={supplier}
                    onConnectSupplier={openConnectFlow}
                    onOpenCatalog={loadSupplierDetails}
                  />
                ))}
              </div>
            </>
          ) : null}
        </>
      )}

      {showDetails && selectedSupplier && (
        <div className={ui.modalOverlay} onClick={() => setShowDetails(false)}>
          <div className={ui.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={ui.modalHeader}>
              <h2>{selectedSupplier.companyName}</h2>
              <button type="button" onClick={() => setShowDetails(false)} className={ui.modalClose}>
                ×
              </button>
            </div>

            <div className={ui.modalBody}>
              <div className={ui.supplierDetails}>
                <div className={ui.detailRow}>
                  <strong>Industry:</strong> {selectedSupplier.industry}
                </div>
                <div className={ui.detailRow}>
                  <strong>Contact Person:</strong> {selectedSupplier.contactPerson}
                </div>
                <div className={ui.detailRow}>
                  <strong>Email:</strong> {selectedSupplier.contactEmail}
                </div>
                <div className={ui.detailRow}>
                  <strong>Phone:</strong> {selectedSupplier.contactPhone}
                </div>
                <div className={ui.detailRow}>
                  <strong>Location:</strong> {selectedSupplier.location}
                </div>
              </div>

              <div className={ui.catalogSection}>
                <h3>Product catalog ({(selectedSupplier.catalog || []).length} items)</h3>
                <div className={ui.supplierTableScroll}>
                  <table className={ui.supplierTable}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Unit</th>
                        <th>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedSupplier.catalog || []).map((item) => (
                        <tr key={item.id || item._id}>
                          <td>{item.name}</td>
                          <td>{item.description || '—'}</td>
                          <td>{item.unit || 'units'}</td>
                          <td>{item.price ? `${item.price.toLocaleString()} RWF` : 'Contact for pricing'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className={ui.modalActions}>
              {selectedSupplier.linked ? (
                <button
                  type="button"
                  className={`${ui.btnMarketplaceConnect} ${ui.btnMarketplaceConnectLinked}`}
                  disabled
                  aria-label={t('app.supervisor.marketplaceConnected')}
                >
                  <IconCheck />
                  {t('app.supervisor.marketplaceConnected')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowDetails(false);
                    openConnectFlow(selectedSupplier);
                  }}
                  className={ui.btnMarketplaceConnect}
                >
                  <IconUserPlus />
                  {t('app.supervisor.marketplaceConnectWithSupplier')}
                </button>
              )}
              <button type="button" onClick={() => setShowDetails(false)} className={ui.btnSecondary}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {connectFlow ? (
        <div
          className={ui.modalOverlay}
          onClick={connectFlow.status === 'loading' ? undefined : closeConnectFlow}
          role="presentation"
        >
          <div
            className={`${ui.modalContent} ${ui.marketplaceConnectModal}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="marketplace-connect-title"
          >
            <div className={ui.modalHeader}>
              <h2 id="marketplace-connect-title">
                {connectFlow.status === 'success'
                  ? t('app.supervisor.marketplaceConnectSuccessTitle')
                  : t('app.supervisor.marketplaceConnectModalTitle', { name: connectFlow.supplier.companyName })}
              </h2>
              {connectFlow.status !== 'loading' ? (
                <button type="button" className={ui.modalClose} onClick={closeConnectFlow} aria-label={t('app.supervisor.marketplaceConnectCancel')}>
                  ×
                </button>
              ) : null}
            </div>
            <div className={ui.modalBody}>
              {connectFlow.status === 'confirm' ? (
                <>
                  <p className={ui.marketplaceConnectIntro}>{t('app.supervisor.marketplaceConnectIntro')}</p>
                  <ul className={ui.marketplaceConnectList}>
                    <li>{t('app.supervisor.marketplaceConnectBullet1')}</li>
                    <li>{t('app.supervisor.marketplaceConnectBullet2')}</li>
                    <li>{t('app.supervisor.marketplaceConnectBullet3')}</li>
                  </ul>
                </>
              ) : null}
              {connectFlow.status === 'loading' ? (
                <p className={ui.marketplaceConnectLoading}>{t('app.supervisor.marketplaceConnectLoading')}</p>
              ) : null}
              {connectFlow.status === 'success' ? (
                <p className={ui.marketplaceConnectIntro}>
                  {t('app.supervisor.marketplaceConnectSuccessBody', { name: connectFlow.supplier.companyName })}
                </p>
              ) : null}
              {connectFlow.status === 'error' ? (
                <p className={ui.marketplaceConnectError}>{connectFlow.errorMessage}</p>
              ) : null}
            </div>
            <div className={ui.modalActions}>
              {connectFlow.status === 'confirm' ? (
                <>
                  <button type="button" className={ui.btnSecondary} onClick={closeConnectFlow}>
                    {t('app.supervisor.marketplaceConnectCancel')}
                  </button>
                  <button type="button" className={ui.btnMarketplaceConnect} onClick={confirmConnect}>
                    {t('app.supervisor.marketplaceConnectConfirm')}
                  </button>
                </>
              ) : null}
              {connectFlow.status === 'success' ? (
                <>
                  <Link to="/app/supervisor/suppliers" className={ui.btnSecondary} onClick={closeConnectFlow}>
                    {t('app.supervisor.marketplaceConnectViewSuppliers')}
                  </Link>
                  <button type="button" className={ui.btnMarketplaceConnect} onClick={closeConnectFlow}>
                    {t('app.supervisor.marketplaceConnectDone')}
                  </button>
                </>
              ) : null}
              {connectFlow.status === 'error' ? (
                <>
                  <button type="button" className={ui.btnSecondary} onClick={closeConnectFlow}>
                    {t('app.supervisor.marketplaceConnectCancel')}
                  </button>
                  <button type="button" className={ui.btnMarketplaceConnect} onClick={retryConnect}>
                    {t('app.supervisor.marketplaceConnectRetry')}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
