import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../api/client.js';
import { useI18n } from '../../i18n/I18nContext.jsx';
import { SearchIcon } from '../../components/Icons.jsx';
import ui from './DashboardUi.module.css';

export default function SupplierDirectoryPage() {
  const { t } = useI18n();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  const industries = [
    'All',
    'Supplier',
    'Medical Equipment',
    'Pharmaceuticals',
    'Laboratory Supplies',
    'Surgical Supplies',
    'Hospital Furniture',
    'Disposables',
    'Other'
  ];

  const locations = ['All', 'Kigali', 'Northern Province', 'Southern Province', 'Eastern Province', 'Western Province'];

  const rankedSuppliers = useMemo(() => {
    function lowestCatalogPrice(supplier) {
      const prices = (supplier.catalog || [])
        .map((item) => Number(item.price || 0))
        .filter((price) => Number.isFinite(price) && price > 0);
      if (!prices.length) return Number.POSITIVE_INFINITY;
      return Math.min(...prices);
    }
    return [...suppliers]
      .map((supplier) => ({ ...supplier, lowestPrice: lowestCatalogPrice(supplier) }))
      .sort((a, b) => a.lowestPrice - b.lowestPrice);
  }, [suppliers]);
  const bestSupplier = rankedSuppliers[0] || null;
  const otherSuppliers = rankedSuppliers.slice(1, 5);

  useEffect(() => {
    loadSuppliers();
  }, [searchTerm, selectedIndustry, selectedLocation]);

  async function loadSuppliers() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedIndustry && selectedIndustry !== 'All') params.append('industry', selectedIndustry);
      if (selectedLocation && selectedLocation !== 'All') params.append('location', selectedLocation);

      const response = await apiFetch(`/supplier-directory${params.toString() ? `?${params.toString()}` : ''}`);
      setSuppliers(response.suppliers || []);
    } catch (error) {
      console.error('Failed to load suppliers:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadSupplierDetails(supplierId) {
    try {
      const response = await apiFetch(`/supplier-directory/${supplierId}`);
      setSelectedSupplier(response.supplier);
      setShowDetails(true);
    } catch (error) {
      console.error('Failed to load supplier details:', error);
    }
  }

  async function connectWithSupplier(supplierId) {
    try {
      await apiFetch(`/supplier-directory/${supplierId}/connect`, {
        method: 'POST'
      });
      // Show success message or update UI
      alert('Successfully connected with supplier!');
    } catch (error) {
      console.error('Failed to connect with supplier:', error);
      alert('Failed to connect with supplier. Please try again.');
    }
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Suppliers</h1>
        <p className={ui.pageLead}>
          The supplier below is your collaborator. Other listed suppliers are ranked by best visible price.
        </p>
      </div>

      <div className={ui.filtersSection}>
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
          >
            {industries.map(industry => (
              <option key={industry} value={industry}>{industry}</option>
            ))}
          </select>

          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className={ui.filterSelect}
          >
            {locations.map(location => (
              <option key={location} value={location}>{location}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className={ui.loadingState}>
          <p>Loading suppliers...</p>
        </div>
      ) : (
        <div className={ui.supplierGrid}>
          {suppliers.length === 0 ? (
            <div className={ui.emptyState}>
              <p>No suppliers found matching your criteria.</p>
            </div>
          ) : (
            suppliers.map(supplier => (
              <div key={supplier.id} className={ui.supplierCard}>
                <div className={ui.supplierHeader}>
                  <h3 className={ui.supplierName}>{supplier.companyName}</h3>
                  <span className={ui.supplierIndustry}>{supplier.industry}</span>
                </div>
                
                <div className={ui.supplierInfo}>
                  <div className={ui.supplierDetail}>
                    <strong>Contact:</strong> {supplier.contactPerson}
                  </div>
                  <div className={ui.supplierDetail}>
                    <strong>Email:</strong> {supplier.contactEmail}
                  </div>
                  <div className={ui.supplierDetail}>
                    <strong>Location:</strong> {supplier.location}
                  </div>
                  <div className={ui.supplierDetail}>
                    <strong>Catalog Size:</strong> {supplier.catalogSize} items
                  </div>
                </div>

                <div className={ui.supplierActions}>
                  <button
                    onClick={() => loadSupplierDetails(supplier.id)}
                    className={ui.btnSecondary}
                  >
                    View Catalog
                  </button>
                  <a href={`mailto:${supplier.contactEmail}`} className={ui.btnSecondary}>
                    Contact supplier
                  </a>
                  <button
                    onClick={() => connectWithSupplier(supplier.id)}
                    className={ui.btnPrimary}
                  >
                    Connect
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {bestSupplier ? (
        <div className={ui.supervisorReportTrendCard} style={{ padding: '1rem', marginTop: '1rem' }}>
          <div className={ui.supervisorReportCardHead}>
            <div>
              <h2 className={ui.supervisorReportCardTitle}>e-Cunga AI supplier recommendation</h2>
              <p className={ui.supervisorReportCardMeta}>
                Based on visible catalog prices, <strong>{bestSupplier.companyName}</strong> is currently the best option.
              </p>
            </div>
            <div className={ui.supervisorReportValueBlock}>
              <strong>{Number.isFinite(bestSupplier.lowestPrice) ? `${bestSupplier.lowestPrice.toLocaleString()} RWF` : 'N/A'}</strong>
              <span>lowest catalog price</span>
            </div>
          </div>
        </div>
      ) : null}

      {otherSuppliers.length ? (
        <div className={ui.supervisorReportCategoryCard} style={{ padding: '1rem', marginTop: '1rem' }}>
          <h2 className={ui.supervisorReportCardTitle}>Other suppliers (by price)</h2>
          <div className={ui.supervisorClerkGrid} style={{ marginTop: '0.8rem' }}>
            {otherSuppliers.map((supplier, index) => (
              <article key={supplier.id || `${supplier.companyName}-${index}`} className={ui.supervisorClerkSummary}>
                  <div>
                    <p className={ui.supervisorClerkName} style={{ margin: 0 }}>
                      {supplier.companyName}
                    </p>
                    <p className={ui.supervisorClerkLoc} style={{ marginTop: '0.2rem' }}>
                      {supplier.contactEmail || 'No email provided'}
                    </p>
                  </div>
                <div style={{ marginTop: '0.6rem', fontSize: '0.78rem', color: 'var(--ec-primary-dark)', fontWeight: 700 }}>
                  {Number.isFinite(supplier.lowestPrice) ? `From ${supplier.lowestPrice.toLocaleString()} RWF` : 'Price on request'}
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {showDetails && selectedSupplier && (
        <div className={ui.modalOverlay} onClick={() => setShowDetails(false)}>
          <div className={ui.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={ui.modalHeader}>
              <h2>{selectedSupplier.companyName}</h2>
              <button
                onClick={() => setShowDetails(false)}
                className={ui.modalClose}
              >
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
                <h3>Product Catalog ({selectedSupplier.catalog.length} items)</h3>
                <div className={ui.catalogGrid}>
                  {selectedSupplier.catalog.map(item => (
                    <div key={item.id} className={ui.catalogItem}>
                      <h4>{item.name}</h4>
                      <p>{item.description}</p>
                      <div className={ui.catalogPrice}>
                        {item.price ? `${item.price.toLocaleString()} RWF` : 'Contact for pricing'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={ui.modalActions}>
              <button
                onClick={() => connectWithSupplier(selectedSupplier.id)}
                className={ui.btnPrimary}
              >
                Connect with Supplier
              </button>
              <button
                onClick={() => setShowDetails(false)}
                className={ui.btnSecondary}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
