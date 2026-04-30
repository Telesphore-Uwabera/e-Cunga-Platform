import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { usePortalData } from '../context/PortalStateContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { categoryFilterOptionLabel } from '../lib/formatters.js';
import ui from '../pages/app/DashboardUi.module.css';

function useActor(state, user) {
  if (user?.role === 'clerk') {
    return state.users.find(u => u.email === user.email && u.role === 'clerk');
  }
  if (user?.role === 'supervisor') {
    return state.users.find(u => u.email === user.email && u.role === 'supervisor');
  }
  return null;
}

function CurrentStockReadout({ name, stockItems, unit }) {
  if (!name) return <div className={ui.clerkStockReadoutEmpty}>— TYPE ITEM NAME TO LOOK UP</div>;
  const matches = stockItems.filter(i => i.name.toLowerCase() === name.toLowerCase() && i.unit === unit);
  if (matches.length === 0) return <div className={ui.clerkStockReadoutEmpty}>— TYPE ITEM NAME TO LOOK UP</div>;
  
  const totalQty = matches.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const minThreshold = Math.min(...matches.map(i => Number(i.minThreshold || 0)));
  const isLow = totalQty <= minThreshold;
  
  return (
    <div className={ui.clerkStockReadoutActive}>
      <span className={ui.clerkStockReadoutQty}>{totalQty} {unit}</span>
      <span className={isLow ? ui.clerkStockReadoutStatusLow : ui.clerkStockReadoutStatusOk}>
        {isLow ? '⚠ below min level' : '✓ in stock'} · {name}
      </span>
    </div>
  );
}

export function AddItemModal({ isOpen, onClose, item }) {
  const { t } = useI18n();
  const { addStockItem, updateStockItem, state } = usePortalData();
  const { user } = useAuth();
  const actor = useActor(state, user);

  const [form, setForm] = useState({
    name: item?.name || '',
    category: item?.category || 'Laboratory',
    sku: item?.sku || '',
    quantity: item?.quantity || 1,
    unit: item?.unit || 'units',
    minThreshold: item?.minThreshold || 10,
    maxThreshold: item?.maxThreshold || 100,
    batchNumber: item?.batchNumber || '',
    expiryDate: item?.expiryDate || '',
    location: item?.location || '',
  });

  // generateSKU must be declared before the reset effect that uses it
  const generateSKU = useCallback((cat) => {
    const prefix = (cat || 'UNC').substring(0, 3).toUpperCase();
    const skus = (state.stockItems || [])
      .filter(i => i.sku && i.sku.startsWith(prefix))
      .map(i => {
        const parts = i.sku.split('-');
        const num = parseInt(parts[parts.length - 1]);
        return isNaN(num) ? 0 : num;
      });
    const max = skus.length > 0 ? Math.max(...skus) : 0;
    return `${prefix}-${String(max + 1).padStart(3, '0')}`;
  }, [state.stockItems]);

  // Reset form when modal opens/closes — SKU is generated inline so it's
  // always populated on open (avoids stale-closure timing issues).
  useEffect(() => {
    if (!isOpen) return;
    if (item) {
      setForm({
        name: item.name || '',
        category: item.category || 'Laboratory',
        sku: item.sku || generateSKU(item.category || 'Laboratory'),
        quantity: item.quantity || 1,
        unit: item.unit || 'units',
        minThreshold: item.minThreshold || 10,
        maxThreshold: item.maxThreshold || 100,
        batchNumber: item.batchNumber || '',
        expiryDate: item.expiryDate || '',
        location: item.location || '',
      });
    } else {
      const defaultCat = 'Laboratory';
      setForm({
        name: '',
        category: defaultCat,
        sku: generateSKU(defaultCat),
        quantity: 1,
        unit: 'units',
        minThreshold: 10,
        maxThreshold: 100,
        batchNumber: '',
        expiryDate: '',
        location: '',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, isOpen]);

  // Re-generate SKU whenever the user changes category (new item only)
  const prevCategoryRef = React.useRef(form.category);
  useEffect(() => {
    if (!isOpen || item) return;
    if (form.category !== prevCategoryRef.current) {
      prevCategoryRef.current = form.category;
      setForm(prev => ({ ...prev, sku: generateSKU(prev.category) }));
    }
  }, [form.category, generateSKU, isOpen, item]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [suppressNameSuggest, setSuppressNameSuggest] = useState(false);
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) setSuppressNameSuggest(false);
  }, [isOpen]);

  const filteredMasterMatches = useMemo(() => {
    if (!form.name?.trim() || !state.masterStock?.length) return [];
    const q = form.name.toLowerCase();
    return state.masterStock.filter(m => m.name.toLowerCase().includes(q)).slice(0, 5);
  }, [form.name, state.masterStock]);

  const showNameSuggest = Boolean(
    form.name && !item && !suppressNameSuggest && filteredMasterMatches.length > 0
  );

  const applyMasterCatalogRow = useCallback(
    m => {
      setForm(prev => ({
        ...prev,
        name: m.name,
        category: m.category,
        unit: m.unit,
        minThreshold: m.suggestedMin,
        maxThreshold: m.suggestedMax,
        sku: generateSKU(m.category),
      }));
      setSuppressNameSuggest(true);
      nameInputRef.current?.blur();
    },
    [generateSKU]
  );

  if (!isOpen) return null;

  const categories = [
    'Laboratory',
    'Medical consumables',
    'Sanitation',
    'Pharmacy',
    'Office supplies',
    'Cold chain',
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required');
    setSaving(true);
    setError('');
    try {
      if (item) {
        await updateStockItem(item.id || item._id, {
          ...form,
          quantity: Number(form.quantity) || 0,
          minThreshold: Number(form.minThreshold) || 10,
          maxThreshold: Number(form.maxThreshold) || 100,
        }, actor?.id);
      } else {
        await addStockItem({
          ...form,
          quantity: Number(form.quantity) || 0,
          minThreshold: Number(form.minThreshold) || 10,
          maxThreshold: Number(form.maxThreshold) || 100,
        }, actor?.id);
      }
      onClose();
    } catch (ex) {
      setError(ex.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={ui.modalOverlay} role="dialog" aria-modal="true">
      <div className={ui.modalCard} style={{ maxWidth: '640px' }}>
        <div className={ui.modalHead}>
          <h2 className={ui.modalTitle}>{item ? 'Edit Stock Item' : t('shell.addNewItem')}</h2>
          <button type="button" className={ui.modalClose} onClick={onClose}>×</button>
        </div>
        <form className={ui.modalForm} onSubmit={handleSubmit}>
          {error && <p className={ui.err}>{error}</p>}
          
          <div className={ui.modalBody} style={{ maxHeight: '70vh', overflowY: 'auto', padding: '0.5rem' }}>
            {!item && (state.masterStock?.length ?? 0) > 0 ? (
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, margin: '0 0 0.55rem', color: 'var(--ec-muted)' }}>
                  {t('shell.addItemCatalogIntro')}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {state.masterStock.map((m) => (
                    <button
                      key={m._id || m.id}
                      type="button"
                      className={ui.materialsInput}
                      style={{
                        width: 'auto',
                        cursor: 'pointer',
                        borderRadius: '999px',
                        padding: '0.28rem 0.65rem',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        border: '1px solid rgb(120 11 35 / 0.35)',
                        background: 'var(--ec-bg-soft)',
                      }}
                      onClick={() => applyMasterCatalogRow(m)}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className={ui.modalFormGrid}>
            <label className={ui.materialsField} style={{ position: 'relative' }}>
              <span>Item Name</span>
              <input
                ref={nameInputRef}
                className={ui.materialsInput}
                value={form.name}
                onChange={e => {
                  setSuppressNameSuggest(false);
                  setForm({ ...form, name: e.target.value });
                }}
                placeholder={t('shell.addItemNamePlaceholder')}
                required
              />
              {showNameSuggest ? (
                <div
                  role="listbox"
                  aria-label={t('shell.addItemCatalogIntro')}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'var(--ec-bg, #fff)',
                    border: '1px solid var(--ec-border, #ddd)',
                    borderRadius: '4px',
                    zIndex: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    marginTop: '2px',
                  }}
                >
                  {filteredMasterMatches.map(m => (
                    <button
                      key={m._id || m.id}
                      type="button"
                      role="option"
                      onClick={() => applyMasterCatalogRow(m)}
                      className={ui.materialsInput}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderRadius: 0,
                        border: 'none',
                        borderBottom: '1px solid var(--ec-border, #eee)',
                        background: 'transparent',
                        font: 'inherit',
                      }}
                    >
                      <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{m.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--ec-muted, #666)' }}>
                        {m.category} · Sector: {m.sector}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </label>

            <label className={ui.materialsField}>
              <span>Category</span>
              <select
                className={ui.materialsInput}
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
              >
                {categories.map(c => (
                  <option key={c} value={c}>{categoryFilterOptionLabel(c)}</option>
                ))}
              </select>
            </label>

            <div className={ui.portalProfilePair}>
              <label className={ui.materialsField}>
                <span>SKU / Code</span>
                <input
                  className={ui.materialsInput}
                  value={form.sku}
                  onChange={e => setForm({ ...form, sku: e.target.value })}
                  placeholder="e.g. MED-001"
                />
              </label>
              <label className={ui.materialsField}>
                <span>Unit</span>
                <select
                  className={ui.materialsInput}
                  value={form.unit}
                  onChange={e => setForm({ ...form, unit: e.target.value })}
                >
                  {['units', 'boxes', 'pcs', 'kg', 'g', 'mg', 'L', 'mL', 'vials', 'bottles', 'packs', 'pairs', 'rolls', 'sheets'].map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className={ui.portalProfilePair}>
              <label className={ui.materialsField}>
                <span>Quantity to add</span>
                <input
                  type="number"
                  min="0"
                  className={ui.materialsInput}
                  value={form.quantity}
                  onChange={e => setForm({ ...form, quantity: e.target.value })}
                />
              </label>
              <label className={ui.materialsField} style={{ pointerEvents: 'none' }}>
                <span>Current stock (live)</span>
                <CurrentStockReadout
                  name={form.name}
                  stockItems={state.stockItems}
                  unit={form.unit}
                />
              </label>
            </div>

            <div className={ui.portalProfilePair}>
              <label className={ui.materialsField}>
                <span>Minimum threshold</span>
                <input
                  type="number"
                  className={ui.materialsInput}
                  value={form.minThreshold}
                  onChange={e => setForm({ ...form, minThreshold: e.target.value })}
                />
              </label>
              <label className={ui.materialsField}>
                <span>Maximum threshold</span>
                <input
                  type="number"
                  className={ui.materialsInput}
                  value={form.maxThreshold}
                  onChange={e => setForm({ ...form, maxThreshold: e.target.value })}
                />
              </label>
            </div>

            <div className={ui.portalProfilePair}>
              <label className={ui.materialsField}>
                <span>Batch number</span>
                <input
                  className={ui.materialsInput}
                  value={form.batchNumber}
                  onChange={e => setForm({ ...form, batchNumber: e.target.value })}
                  placeholder="e.g. B-123-X"
                />
              </label>
              <label className={ui.materialsField}>
                <span>Expiry date</span>
                <input
                  type="date"
                  className={ui.materialsInput}
                  value={form.expiryDate}
                  onChange={e => setForm({ ...form, expiryDate: e.target.value })}
                />
              </label>
            </div>

            <label className={ui.materialsField}>
              <span>Warehouse location</span>
              <input
                className={ui.materialsInput}
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Warehouse A / Shelf 4"
              />
            </label>
            </div>
            {!item ? (
              <p
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--ec-muted)',
                  margin: '0.35rem 0 0',
                  lineHeight: 1.45,
                }}
              >
                {t('shell.addItemSubmitDestinationHint')}
              </p>
            ) : null}
          </div>

          <div className={ui.modalActions}>
            <button type="button" className={ui.modalSecondaryBtn} onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className={ui.materialsSubmitBtn} disabled={saving}>
              {saving ? 'Processing...' : (item ? 'Update Stock Item' : 'Submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
