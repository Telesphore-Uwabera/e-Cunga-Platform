import React, { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { usePortalData } from '../context/PortalStateContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { categoryFilterOptionLabel } from '../lib/formatters.js';
import ui from '../pages/app/clerkPages.module.css'; // Reusing styles for now

function useActor(state, user) {
  if (user?.role === 'clerk') {
    return state.users.find(u => u.email === user.email && u.role === 'clerk');
  }
  if (user?.role === 'supervisor') {
    return state.users.find(u => u.email === user.email && u.role === 'supervisor');
  }
  return null;
}

function CurrentStockReadout({ name, actorId, stockItems, unit }) {
  const match = stockItems.find(i => i.name === name && i.ownerId === actorId && i.unit === unit);
  if (!match) return <div className={ui.clerkStockReadoutEmpty}>— TYPE ITEM NAME TO LOOK UP</div>;
  const isLow = Number(match.quantity || 0) <= Number(match.minThreshold || 0);
  return (
    <div className={ui.clerkStockReadoutActive}>
      <span className={ui.clerkStockReadoutQty}>{match.quantity} {match.unit}</span>
      <span className={isLow ? ui.clerkStockReadoutStatusLow : ui.clerkStockReadoutStatusOk}>
        {isLow ? '⚠ below min level' : '✓ in stock'} · {match.name}
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

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name || '',
        category: item.category || 'Laboratory',
        sku: item.sku || '',
        quantity: item.quantity || 1,
        unit: item.unit || 'units',
        minThreshold: item.minThreshold || 10,
        maxThreshold: item.maxThreshold || 100,
        batchNumber: item.batchNumber || '',
        expiryDate: item.expiryDate || '',
        location: item.location || '',
      });
    } else {
      setForm({
        name: '',
        category: 'Laboratory',
        sku: '',
        quantity: 1,
        unit: 'units',
        minThreshold: 10,
        maxThreshold: 100,
        batchNumber: '',
        expiryDate: '',
        location: '',
      });
    }
  }, [item, isOpen]);

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

  useEffect(() => {
    if (!item && !form.sku) {
      setForm(prev => ({ ...prev, sku: generateSKU(prev.category) }));
    }
  }, [form.category, generateSKU, item, isOpen]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
          <h2 className={ui.modalTitle}>{item ? 'Edit Stock Item' : t('app.clerk.stockFormTitle')}</h2>
          <button type="button" className={ui.modalClose} onClick={onClose}>×</button>
        </div>
        <form className={ui.modalForm} onSubmit={handleSubmit}>
          {error && <p className={ui.err}>{error}</p>}
          
          <div className={ui.modalBody} style={{ maxHeight: '70vh', overflowY: 'auto', padding: '0.5rem' }}>
            <div className={ui.modalFormGrid}>
            <label className={ui.materialsField} style={{ position: 'relative' }}>
              <span>{t('app.clerk.addStockName')}</span>
              <input
                className={ui.materialsInput}
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Start typing to look up existing stock…"
                required
              />
              {form.name && !item && state.masterStock?.filter(m => m.name.toLowerCase().includes(form.name.toLowerCase())).length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  zIndex: 10,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  marginTop: '2px'
                }}>
                  {state.masterStock
                    .filter(m => m.name.toLowerCase().includes(form.name.toLowerCase()))
                    .slice(0, 5)
                    .map(m => (
                      <div
                        key={m._id}
                        onClick={() => setForm({
                          ...form,
                          name: m.name,
                          category: m.category,
                          unit: m.unit,
                          minThreshold: m.suggestedMin,
                          maxThreshold: m.suggestedMax,
                          sku: generateSKU(m.category)
                        })}
                        style={{
                          padding: '8px 12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #eee'
                        }}
                        onMouseEnter={e => e.target.style.background = '#f5f5f5'}
                        onMouseLeave={e => e.target.style.background = 'transparent'}
                      >
                        <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{m.name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>{m.category} · Sector: {m.sector}</div>
                      </div>
                    ))}
                </div>
              )}
            </label>

            <label className={ui.materialsField}>
              <span>{t('app.clerk.addStockCategory')}</span>
              <select
                className={ui.materialsInput}
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c === 'Laboratory' ? t('app.clerk.categoryLab') : categoryFilterOptionLabel(c)}</option>
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
                  actorId={actor?.id}
                  stockItems={state.stockItems}
                  unit={form.unit}
                />
              </label>
            </div>

            <div className={ui.portalProfilePair}>
              <label className={ui.materialsField}>
                <span>{t('app.clerk.addStockMin')}</span>
                <input
                  type="number"
                  className={ui.materialsInput}
                  value={form.minThreshold}
                  onChange={e => setForm({ ...form, minThreshold: e.target.value })}
                />
              </label>
              <label className={ui.materialsField}>
                <span>{t('app.clerk.addStockMax')}</span>
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
                <span>{t('app.clerk.addStockBatch')}</span>
                <input
                  className={ui.materialsInput}
                  value={form.batchNumber}
                  onChange={e => setForm({ ...form, batchNumber: e.target.value })}
                  placeholder="e.g. B-123-X"
                />
              </label>
              <label className={ui.materialsField}>
                <span>{t('app.clerk.addStockExpiry')}</span>
                <input
                  type="date"
                  className={ui.materialsInput}
                  value={form.expiryDate}
                  onChange={e => setForm({ ...form, expiryDate: e.target.value })}
                />
              </label>
            </div>

            <label className={ui.materialsField}>
              <span>{t('app.clerk.addStockLocation')}</span>
              <input
                className={ui.materialsInput}
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Warehouse A / Shelf 4"
              />
            </label>
            </div>
          </div>

          <div className={ui.modalActions}>
            <button type="button" className={ui.modalSecondaryBtn} onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className={ui.materialsSubmitBtn} disabled={saving}>
              {saving ? 'Processing...' : (item ? 'Update Stock Item' : t('app.clerk.addStockSubmit'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
