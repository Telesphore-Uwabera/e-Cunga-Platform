import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo, useId } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n/I18nContext.jsx';
import { usePortalData } from '../context/PortalStateContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { categoryFilterOptionLabel } from '../lib/formatters.js';
import {
  ECOSYSTEM_CATALOG_CATEGORY_IDS,
  ECOSYSTEM_CATEGORY_LABEL_KEYS,
  ecosystemSlugForMasterStockRow,
  HEALTHCARE_STOCK_CATEGORIES,
  healthcareSkuPrefix,
  isHealthcareCompany,
  mapMasterStockToHealthcareCategory,
  normalizeToHealthcareCategory,
  sectorForEcosystemCategoryId,
} from '../constants/ecosystemCatalog.js';
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

function normalizeFieldKey(value) {
  return String(value || '').trim().toLowerCase();
}



/**
 * Master catalog uses `m_stk_*` ids. Live inventory uses `stk_*`. If a row was mis-keyed with a
 * catalog id, resolve the real stock line from the current snapshot (SKU + owner).
 */
function resolveStockEditId(row, stockItems) {
  const raw = String(row?.id ?? row?._id ?? '').trim();
  if (!raw) return '';
  const isMasterStyle = raw.startsWith('m_stk_');
  if (!isMasterStyle) return raw;
  const sku = String(row?.sku || '').trim();
  const ownerId = row?.ownerId != null ? String(row.ownerId) : '';
  const name = String(row?.name || '').trim().toLowerCase();
  const pool = Array.isArray(stockItems) ? stockItems : [];
  const notMaster = (s) => !String(s?.id ?? s?._id ?? '').startsWith('m_stk_');
  if (sku && ownerId) {
    const hit = pool.find(
      (s) =>
        notMaster(s) &&
        String(s.sku || '').trim() === sku &&
        String(s.ownerId || '') === ownerId
    );
    if (hit) return String(hit.id ?? hit._id);
  }
  if (name && ownerId) {
    const hit = pool.find(
      (s) =>
        notMaster(s) &&
        String(s.name || '').trim().toLowerCase() === name &&
        String(s.ownerId || '') === ownerId
    );
    if (hit) return String(hit.id ?? hit._id);
  }
  return raw;
}

export const UNIT_OPTION_PRESETS = [
  'units',
  'Set',
  'boxes',
  'pcs',
  'kg',
  'g',
  'mg',
  'L',
  'mL',
  'vials',
  'bottles',
  'tablets',
  'ampoules',
  'packs',
  'pairs',
  'rolls',
  'sheets',
];

/** Themed list — native select option menus are OS-styled and cannot match the UI; portal avoids modal overflow clipping. */
export function StockModalCombobox({ id, value, onChange, options, disabled }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const [coords, setCoords] = useState(null);
  const listboxId = id ? `${id}-listbox` : undefined;

  const selectedLabel = useMemo(() => {
    const hit = options.find((o) => o.value === value);
    return hit?.label ?? String(value ?? '');
  }, [options, value]);

  const syncCoords = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setCoords({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    syncCoords();
    const onScroll = () => syncCoords();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, syncCoords]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      const t = e.target;
      if (wrapRef.current?.contains(t)) return;
      if (typeof t.closest === 'function' && t.closest('[data-ec-stock-combobox-list]')) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const listEl =
    open && coords
      ? createPortal(
          <ul
            data-ec-stock-combobox-list
            id={listboxId}
            className={ui.materialsComboboxList}
            role="listbox"
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: coords.width,
              zIndex: 6000,
            }}
          >
            {options.map((o) => (
              <li key={String(o.value)} role="presentation" className={ui.materialsComboboxLi}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === o.value}
                  className={ui.materialsComboboxOption}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body
        )
      : null;

  return (
    <div className={ui.materialsCombobox} ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        id={id}
        className={`${ui.materialsComboboxTrigger} ${open ? ui.materialsComboboxTriggerOpen : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
      >
        <span className={ui.materialsComboboxValue}>{selectedLabel}</span>
      </button>
      {listEl}
    </div>
  );
}

export function AddItemModal({ isOpen, onClose, item, prefillMaster = null }) {
  const { t } = useI18n();
  const { addStockItem, addMasterCatalogItem, updateStockItem, state } = usePortalData();
  const { user } = useAuth();
  const actor = useActor(state, user);
  const useHealthcare = isHealthcareCompany(state.company);
  const isAdminNewCatalog = Boolean(!item && user?.role === 'admin');

  const [form, setForm] = useState({
    name: item?.name || '',
    category: item?.category || ECOSYSTEM_CATALOG_CATEGORY_IDS[0],
    sku: item?.sku || '',
    quantity: item?.quantity || 1,
    unit: item?.unit || 'units',
    minThreshold: item?.minThreshold ?? 10,
    maxThreshold: item?.maxThreshold ?? 100,
    batchNumber: item?.batchNumber || '',
    expiryDate: item?.expiryDate || '',
    location: item?.location || '',
    department: item?.department || '',
  });

  // generateSKU must be declared before the reset effect that uses it
  const generateSKU = useCallback((cat) => {
    const useEcosystemSlugPrefix = isAdminNewCatalog || !useHealthcare;
    const prefix = useEcosystemSlugPrefix
      ? (cat || 'UNC').substring(0, 3).toUpperCase()
      : healthcareSkuPrefix(normalizeToHealthcareCategory(cat));
    const skus = (state.stockItems || [])
      .filter(i => i.sku && i.sku.startsWith(prefix))
      .map(i => {
        const parts = i.sku.split('-');
        const num = parseInt(parts[parts.length - 1]);
        return isNaN(num) ? 0 : num;
      });
    const max = skus.length > 0 ? Math.max(...skus) : 0;
    return `${prefix}-${String(max + 1).padStart(3, '0')}`;
  }, [state.stockItems, useHealthcare, isAdminNewCatalog]);

  // Reset form when modal opens/closes — SKU is generated inline so it's
  // always populated on open (avoids stale-closure timing issues).
  useEffect(() => {
    if (!isOpen) return;
    const fallbackCat = isAdminNewCatalog
      ? ECOSYSTEM_CATALOG_CATEGORY_IDS[0]
      : useHealthcare
        ? HEALTHCARE_STOCK_CATEGORIES[0]
        : ECOSYSTEM_CATALOG_CATEGORY_IDS[0];
    const categoryValues = isAdminNewCatalog
      ? ECOSYSTEM_CATALOG_CATEGORY_IDS
      : useHealthcare
        ? HEALTHCARE_STOCK_CATEGORIES
        : ECOSYSTEM_CATALOG_CATEGORY_IDS;
    const defaultCat = fallbackCat;
    const isInternalStaff = user?.role === 'clerk' || user?.role === 'supervisor';
    const defaultDepartment = isInternalStaff
      ? String(actor?.department || actor?.team || '').trim()
      : '';
    const defaultLocation = isInternalStaff
      ? String(actor?.location || '').trim()
      : '';
    if (item) {
      setForm({
        name: item.name || '',
        category: item.category || defaultCat,
        sku: item.sku || generateSKU(item.category || defaultCat),
        quantity: item.quantity || 1,
        unit: item.unit || 'units',
        minThreshold: item.minThreshold ?? 10,
        maxThreshold: item.maxThreshold ?? 100,
        batchNumber: item.batchNumber || '',
        expiryDate: item.expiryDate || '',
        location: item.location || defaultLocation,
        department: item.department || defaultDepartment,
      });
    } else if (prefillMaster && typeof prefillMaster === 'object') {
      const nextCat = useHealthcare
        ? mapMasterStockToHealthcareCategory(prefillMaster)
        : ecosystemSlugForMasterStockRow(prefillMaster);
      setForm({
        name: prefillMaster.name || '',
        category: nextCat,
        sku: generateSKU(nextCat),
        quantity: 1,
        unit: prefillMaster.unit || 'units',
        minThreshold: (prefillMaster.suggestedMin !== undefined && prefillMaster.suggestedMin !== null && prefillMaster.suggestedMin !== '') ? Number(prefillMaster.suggestedMin) : 10,
        maxThreshold: (prefillMaster.suggestedMax !== undefined && prefillMaster.suggestedMax !== null && prefillMaster.suggestedMax !== '') ? Number(prefillMaster.suggestedMax) : 100,
        batchNumber: '',
        expiryDate: '',
        location: defaultLocation,
        department: defaultDepartment,
      });
    } else {
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
        location: defaultLocation,
        department: defaultDepartment,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, isOpen, user?.role, actor?.department, actor?.team, actor?.location, useHealthcare, isAdminNewCatalog, prefillMaster?._id, prefillMaster?.id]);

  // Re-generate SKU whenever the user changes category (new item only)
  const prevCategoryRef = React.useRef(form.category);
  useEffect(() => {
    if (!isOpen || item || user?.role === 'admin') return;
    if (form.category !== prevCategoryRef.current) {
      prevCategoryRef.current = form.category;
      setForm(prev => ({ ...prev, sku: generateSKU(prev.category) }));
    }
  }, [form.category, generateSKU, isOpen, item, user?.role]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [suppressNameSuggest, setSuppressNameSuggest] = useState(false);
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setSuppressNameSuggest(Boolean(prefillMaster && !item));
  }, [isOpen, prefillMaster, item]);

  const isInternalStaff = Boolean(!item && (user?.role === 'clerk' || user?.role === 'supervisor'));
  const showStockDetailFields = Boolean(item || user?.role !== 'admin');

  /**
   * Admin publishing master catalog: always the four ecosystem pillars (landing-page copy via i18n).
   * Healthcare workspaces adding stock: operational categories. Else: ecosystem pillars.
   */
  const categorySelectOptions = useMemo(() => {
    if (isAdminNewCatalog) {
      return ECOSYSTEM_CATALOG_CATEGORY_IDS.map((id) => ({
        value: id,
        label: t(ECOSYSTEM_CATEGORY_LABEL_KEYS[id]),
      }));
    }
    if (useHealthcare) {
      return HEALTHCARE_STOCK_CATEGORIES.map((c) => ({ value: c, label: c }));
    }
    return ECOSYSTEM_CATALOG_CATEGORY_IDS.map((id) => ({
      value: id,
      label: t(ECOSYSTEM_CATEGORY_LABEL_KEYS[id]),
    }));
  }, [t, useHealthcare, isAdminNewCatalog]);

  const categoryComboboxOptions = useMemo(() => {
    if (form.category && !categorySelectOptions.some((o) => o.value === form.category)) {
      return [
        { value: form.category, label: categoryFilterOptionLabel(form.category, state.company) },
        ...categorySelectOptions,
      ];
    }
    return categorySelectOptions;
  }, [form.category, categorySelectOptions]);

  const unitComboboxOptions = useMemo(
    () => UNIT_OPTION_PRESETS.map((u) => ({ value: u, label: u })),
    []
  );

  const categoryFieldId = useId();
  const unitFieldId = useId();

  const filteredMasterMatches = useMemo(() => {
    if (!form.name?.trim()) return [];
    const q = form.name.toLowerCase();
    const adminPool = (state.masterStock || []);
    const supplierPool = (state.supplierCatalog || []);
    const pool = [...adminPool, ...supplierPool];
    return pool.filter(m => m.name.toLowerCase().includes(q)).slice(0, 5);
  }, [form.name, state.masterStock, state.supplierCatalog]);

  const showNameSuggest = Boolean(
    form.name && !item && !isAdminNewCatalog && !suppressNameSuggest && filteredMasterMatches.length > 0
  );

  const applyMasterCatalogRow = useCallback(
    m => {
      const nextCat = useHealthcare ? mapMasterStockToHealthcareCategory(m) : ecosystemSlugForMasterStockRow(m);
      setForm(prev => ({
        ...prev,
        name: m.name,
        category: nextCat,
        unit: m.unit || 'units',
        minThreshold: m.suggestedMin ?? m.minThreshold ?? 10,
        maxThreshold: m.suggestedMax ?? m.maxThreshold ?? 100,
        sku: generateSKU(nextCat),
      }));
      setSuppressNameSuggest(true);
      nameInputRef.current?.blur();
    },
    [generateSKU, useHealthcare, state.company]
  );

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setError('Name is required');
    setSaving(true);
    setError('');
    try {
      if (item) {
        const stockId = resolveStockEditId(item, state.stockItems);
        if (!stockId) {
          setError('Missing stock item id.');
          return;
        }
        await updateStockItem(stockId, {
          ...form,
          quantity: Number(form.quantity) || 0,
          minThreshold: (form.minThreshold !== undefined && form.minThreshold !== null && String(form.minThreshold).trim() !== '') ? Number(form.minThreshold) : 10,
          maxThreshold: (form.maxThreshold !== undefined && form.maxThreshold !== null && String(form.maxThreshold).trim() !== '') ? Number(form.maxThreshold) : 100,
          department: String(form.department || '').trim(),
        }, actor?.id);
        onClose();
        return;
      }

      if (isAdminNewCatalog) {
        if (!ECOSYSTEM_CATALOG_CATEGORY_IDS.includes(form.category)) {
          setError(t('shell.addCatalogEcosystemCategoryRequired'));
          return;
        }
        const trimmed = form.name.trim();
        const dup = (state.masterStock || []).some(
          m => m.name.trim().toLowerCase() === trimmed.toLowerCase()
        );
        if (dup) {
          setError(t('shell.addCatalogDuplicateName'));
          return;
        }
        await addMasterCatalogItem(
          {
            name: trimmed,
            category: form.category,
            unit: 'units',
            sector: sectorForEcosystemCategoryId(form.category),
            suggestedMin: 10,
            suggestedMax: 100,
          },
          user?.id
        );
        onClose();
        return;
      }

      let pickedMaster = null;
      if (!item && !isAdminNewCatalog) {
        const catalog = state.masterStock || [];
        pickedMaster = catalog.find(
          m => m.name.trim().toLowerCase() === form.name.trim().toLowerCase()
        );
      }

      await addStockItem(
        {
          ...form,
          category: pickedMaster
            ? (useHealthcare ? mapMasterStockToHealthcareCategory(pickedMaster) : ecosystemSlugForMasterStockRow(pickedMaster))
            : form.category,
          quantity: Number(form.quantity) || 0,
          minThreshold: (form.minThreshold !== undefined && form.minThreshold !== null && String(form.minThreshold).trim() !== '') ? Number(form.minThreshold) : 10,
          maxThreshold: (form.maxThreshold !== undefined && form.maxThreshold !== null && String(form.maxThreshold).trim() !== '') ? Number(form.maxThreshold) : 100,
          department: String(form.department || '').trim(),
          location: String(form.location || '').trim(),
        },
        actor?.id
      );
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
          <h2 className={ui.modalTitle}>
            {item ? 'Edit Stock Item' : isAdminNewCatalog ? t('shell.addCatalogItemTitle') : t('shell.addNewItem')}
          </h2>
          <button type="button" className={ui.modalClose} onClick={onClose}>×</button>
        </div>
        <form className={ui.modalForm} onSubmit={handleSubmit}>
          {error && <p className={ui.err}>{error}</p>}
          
          <div className={ui.modalBody} style={{ maxHeight: '70vh', overflowY: 'auto', padding: '0.5rem' }}>
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
                placeholder={
                  isAdminNewCatalog
                    ? t('shell.addItemNamePlaceholderAdmin')
                    : t('shell.addItemNamePlaceholderClerk')
                }
                required
              />
              {showNameSuggest ? (
                <div
                  role="listbox"
                  aria-label="Suggestions"
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
                        {categoryFilterOptionLabel(m.category, state.company)} · {m.sector}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </label>

            <label className={ui.materialsField} htmlFor={categoryFieldId}>
              <span>{isAdminNewCatalog ? t('shell.addCatalogEcosystemLabel') : 'Category'}</span>
              <StockModalCombobox
                id={categoryFieldId}
                value={form.category}
                onChange={(next) => setForm({ ...form, category: next })}
                options={categoryComboboxOptions}
              />
            </label>

            {showStockDetailFields ? (
            <>
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
              <label className={ui.materialsField} htmlFor={unitFieldId}>
                <span>Unit</span>
                <StockModalCombobox
                  id={unitFieldId}
                  value={form.unit}
                  onChange={(next) => setForm({ ...form, unit: next })}
                  options={unitComboboxOptions}
                />
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
              <label className={ui.materialsField}>
                <span>{t('shell.addItemDepartmentLabel')}</span>
                <input
                  className={ui.materialsInput}
                  value={form.department}
                  readOnly
                  placeholder={t('shell.addItemDepartmentPlaceholder')}
                  autoComplete="organization"
                  style={{ opacity: 0.8, cursor: 'not-allowed', backgroundColor: 'var(--ec-bg-alt)' }}
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
                readOnly
                placeholder="e.g. Warehouse A / Shelf 4"
                style={{ opacity: 0.8, cursor: 'not-allowed', backgroundColor: 'var(--ec-bg-alt)' }}
              />
            </label>
            </>
            ) : null}
            {!item ? (
              <p
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--ec-muted)',
                  margin: '0.35rem 0 0',
                  lineHeight: 1.45,
                }}
              >
                {isAdminNewCatalog ? t('shell.addItemAdminCatalogHint') : t('shell.addItemSubmitDestinationHint')}
              </p>
            ) : null}
            </div>
          </div>

          <div className={ui.modalActions}>
            <button type="button" className={ui.modalSecondaryBtn} onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className={ui.materialsSubmitBtn} disabled={saving}>
              {saving
                ? 'Processing...'
                : item
                  ? 'Update Stock Item'
                  : isAdminNewCatalog
                    ? t('shell.publishToCatalog')
                    : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
