import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { apiFetch, getToken } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';
import { createEmptyPortalState } from '../lib/emptyPortalState.js';
/** Supplier catalog always uses the healthcare ecosystem master list (same pool as facility clerks). */
const SUPPLIER_MASTER_STOCK_SECTOR = 'Healthcare';
const PORTAL_STATE_CACHE_TTL_MS = 15000;
const MASTER_STOCK_CACHE_TTL_MS = 60000;

const PortalStateContext = createContext(null);

function requireApiWorkspace(portalUsesLive) {
  if (!getToken()) {
    throw new Error('Sign in to continue.');
  }
  if (!portalUsesLive) {
    throw new Error(
      'Workspace requires a live database. Ensure MONGODB_URI is set, the API is running, and try again.'
    );
  }
}

export function PortalStateProvider({ children }) {
  const { user, bootstrapping, logout } = useAuth();
  const [apiMode, setApiMode] = useState(null);
  const [liveState, setLiveState] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const portalCacheRef = useRef(new Map());
  const masterStockCacheRef = useRef(new Map());

  /** All workspace roles use the same MongoDB-backed API — no client mock. */
  const portalUsesLive = Boolean(user) && apiMode === true;

  useEffect(() => {
    let cancelled = false;
    apiFetch('/health')
      .then((h) => {
        if (!cancelled) setApiMode(h?.mode === 'database');
      })
      .catch(() => {
        if (!cancelled) setApiMode(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setLiveState(null);
      setFetchError(null);
      setFetching(false);
      portalCacheRef.current.clear();
      masterStockCacheRef.current.clear();
    }
  }, [user]);

  const refreshPortalState = useCallback(async ({ force = false } = {}) => {
    if (!getToken() || !portalUsesLive) return;
    const uid = user?.id != null ? String(user.id).trim() : '';
    const userCompanyId = user?.companyId != null ? String(user.companyId).trim() : '';
    const role = user?.role || '';
    const cacheKey = `${uid}:${userCompanyId}:${role}`;
    const now = Date.now();

    if (!force) {
      const cached = portalCacheRef.current.get(cacheKey);
      if (cached && now - cached.fetchedAt <= PORTAL_STATE_CACHE_TTL_MS) {
        setLiveState(cached.data);
        return;
      }
    }

    setFetching(true);
    setFetchError(null);
    try {
      const data = await apiFetch('/portal/state');
      const isSupplier = role === 'supplier';
      const catalogSector = isSupplier
        ? SUPPLIER_MASTER_STOCK_SECTOR
        : (data?.company?.type || 'General');
      const sector = encodeURIComponent(catalogSector);
      const msPath = isSupplier
        ? `/master-stock/trending?sector=${sector}&days=120`
        : `/master-stock?sector=${sector}`;
      const cachedMasterStock = !force ? masterStockCacheRef.current.get(msPath) : null;
      let masterStock = [];
      if (cachedMasterStock && now - cachedMasterStock.fetchedAt <= MASTER_STOCK_CACHE_TTL_MS) {
        masterStock = cachedMasterStock.rows;
      } else {
        const msData = await apiFetch(msPath);
        masterStock = msData?.masterStock || [];
        masterStockCacheRef.current.set(msPath, { rows: masterStock, fetchedAt: Date.now() });
      }
      const merged = { ...data, masterStock };
      portalCacheRef.current.set(cacheKey, { data: merged, fetchedAt: Date.now() });
      setLiveState(merged);
    } catch (e) {
      if (e.status === 401 && getToken()) {
        setLiveState(null);
        setFetchError(null);
        portalCacheRef.current.clear();
        masterStockCacheRef.current.clear();
        logout();
        return;
      }
      setFetchError(e.message || 'Failed to load workspace data.');
      setLiveState(null);
    } finally {
      setFetching(false);
    }
  }, [portalUsesLive, logout, user?.role]);

  useEffect(() => {
    if (bootstrapping || !portalUsesLive) return;
    refreshPortalState();
  }, [bootstrapping, portalUsesLive, user?.id, refreshPortalState]);

  useEffect(() => {
    if (bootstrapping || !portalUsesLive) return;
    let debounce;
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        refreshPortalState();
      }, 400);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(debounce);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [bootstrapping, portalUsesLive, refreshPortalState]);

  const state = useMemo(() => {
    const raw = portalUsesLive ? liveState : null;
    if (!raw) return createEmptyPortalState();
    const company = raw.companies?.find((c) => c.id === raw.selectedCompanyId) || raw.companies?.[0] || { name: 'Unknown' };
    const cid = company.id;
    const uid = user?.id != null ? String(user.id).trim() : '';
    const uCo = user?.companyId != null ? String(user.companyId).trim() : '';
    const role = user?.role || '';
    const isSupplier = role === 'supplier';

    function supplierAssigneeMatches(rowSupplierId) {
      const sid = rowSupplierId != null ? String(rowSupplierId).trim() : '';
      if (!sid) return false;
      return (uid && sid === uid) || (uCo && sid === uCo);
    }

    const linkedSupplierCids = company.linkedSupplierCompanyIds || [];
    return {
      ...raw,
      company,
      users: company.isPlatformTenant
        ? (raw.users || [])
        : (raw.users || []).filter((u) => {
            if (u.role === 'supplier') {
              return String(u.companyId) === String(cid) || linkedSupplierCids.map(String).includes(String(u.companyId));
            }
            return String(u.companyId) === String(cid);
          }),
      stockItems: (raw.stockItems || []).filter((i) => String(i.companyId) === String(cid)),
      requisitions: isSupplier
        ? (raw.requisitions || []).filter((r) => supplierAssigneeMatches(r.supplierId))
        : (raw.requisitions || []).filter((r) => String(r.companyId) === String(cid)),
      invoices: isSupplier
        ? (raw.invoices || []).filter((v) => supplierAssigneeMatches(v.supplierId))
        : (raw.invoices || []).filter((v) => String(v.companyId) === String(cid)),
      consumptions: (raw.consumptions || []).filter((c) => String(c.companyId) === String(cid)),
      messages: (raw.messages || []).filter((m) => String(m.companyId) === String(cid) || String(m.userId) === uid),
      notifications: (raw.notifications || []).filter((n) => String(n.companyId) === String(cid) || String(n.userId) === uid),
      masterStock: raw.masterStock || [],
    };
  }, [portalUsesLive, liveState, user?.id, user?.companyId, user?.role]);

  const switchCompany = useCallback(async () => {
    /* Multi-company switch not exposed in API yet */
  }, []);

  const databaseUnavailable = Boolean(user) && apiMode === false;
  const portalLoading = portalUsesLive && fetching && !liveState && !fetchError;
  const portalErrorMessage = databaseUnavailable
    ? 'This workspace requires a live database. Start the API with MONGODB_URI set, or check that /api/health reports mode "database".'
    : portalUsesLive && fetchError && !fetching && !liveState
      ? fetchError
      : null;
  const portalError = Boolean(portalErrorMessage);

  const addStockItem = useCallback(
    async (payload, actorId) => {
      requireApiWorkspace(portalUsesLive);
      await apiFetch('/stock', {
        method: 'POST',
        body: JSON.stringify({ ...payload, ownerId: actorId }),
      });
      await refreshPortalState({ force: true });
    },
    [portalUsesLive, refreshPortalState]
  );

  const addMasterCatalogItem = useCallback(
    async (payload) => {
      requireApiWorkspace(portalUsesLive);
      await apiFetch('/master-stock', {
        method: 'POST',
        body: JSON.stringify({
          name: payload.name,
          category: payload.category,
          unit: payload.unit || 'units',
          sector: payload.sector || 'General',
          description: payload.description || '',
          suggestedMin: payload.suggestedMin ?? 10,
          suggestedMax: payload.suggestedMax ?? 100,
        }),
      });
      await refreshPortalState({ force: true });
    },
    [portalUsesLive, refreshPortalState]
  );

  const updateStockItem = useCallback(
    async (itemId, payload) => {
      requireApiWorkspace(portalUsesLive);
      await apiFetch(`/stock/${encodeURIComponent(itemId)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      await refreshPortalState({ force: true });
    },
    [portalUsesLive, refreshPortalState]
  );

  const deleteStockItem = useCallback(
    async (itemId) => {
      requireApiWorkspace(portalUsesLive);
      await apiFetch(`/stock/${encodeURIComponent(itemId)}`, {
        method: 'DELETE',
      });
      await refreshPortalState({ force: true });
    },
    [portalUsesLive, refreshPortalState]
  );

  const consumeStockItem = useCallback(
    async ({ itemId, quantity, purpose, consumptionKind, relatedRequisitionId }, _actorId) => {
      requireApiWorkspace(portalUsesLive);
      await apiFetch(`/stock/${encodeURIComponent(itemId)}/consume`, {
        method: 'POST',
        body: JSON.stringify({ quantity, purpose, consumptionKind, relatedRequisitionId }),
      });
      await refreshPortalState({ force: true });
    },
    [portalUsesLive, refreshPortalState]
  );

  const createRequisition = useCallback(
    async (payload) => {
      requireApiWorkspace(portalUsesLive);
      const lines = Array.isArray(payload.lines) ? payload.lines : [];
      await apiFetch('/requisitions', {
        method: 'POST',
        body: JSON.stringify({
          title: payload.title,
          lines: lines.map((line) => ({
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            estimatedCost: line.estimatedCost,
            dateValue: line.dateValue,
          })),
          priority: payload.priority,
          location: payload.location,
          requestingDepartment: payload.requestingDepartment,
          deliveryNote: payload.deliveryNote,
          clerkJustification: payload.clerkJustification,
        }),
      });
      await refreshPortalState({ force: true });
    },
    [portalUsesLive, refreshPortalState]
  );

  const reviewRequisition = useCallback(
    async (requisitionId, decision, note, supplierId) => {
      requireApiWorkspace(portalUsesLive);
      const apiDecision = decision === 'rejected' ? 'rejected' : 'approved';
      const body = { decision: apiDecision, note: note || '' };
      if (apiDecision === 'approved' && supplierId) body.supplierId = supplierId;
      await apiFetch(`/requisitions/${encodeURIComponent(requisitionId)}/review`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      await refreshPortalState({ force: true });
    },
    [portalUsesLive, refreshPortalState]
  );

  const clerkProformaReview = useCallback(
    async (requisitionId, decision, note) => {
      requireApiWorkspace(portalUsesLive);
      await apiFetch(`/requisitions/${encodeURIComponent(requisitionId)}/clerk-proforma-review`, {
        method: 'POST',
        body: JSON.stringify({
          decision: decision === 'rejected' ? 'rejected' : 'accepted',
          note: note || '',
        }),
      });
      await refreshPortalState({ force: true });
    },
    [portalUsesLive, refreshPortalState]
  );

  const accountantReviewInvoice = useCallback(
    async (invoiceId, decision) => {
      requireApiWorkspace(portalUsesLive);
      const apiDecision = decision === 'rejected' ? 'rejected' : 'approved';
      await apiFetch(`/invoices/${encodeURIComponent(invoiceId)}/accountant-review`, {
        method: 'POST',
        body: JSON.stringify({ decision: apiDecision }),
      });
      await refreshPortalState({ force: true });
    },
    [portalUsesLive, refreshPortalState]
  );

  const markInvoicePaid = useCallback(
    async (invoiceId) => {
      requireApiWorkspace(portalUsesLive);
      await apiFetch(`/invoices/${encodeURIComponent(invoiceId)}/mark-paid`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await refreshPortalState({ force: true });
    },
    [portalUsesLive, refreshPortalState]
  );

  const markInvoiceCreditPurchase = useCallback(
    async (invoiceId) => {
      requireApiWorkspace(portalUsesLive);
      await apiFetch(`/invoices/${encodeURIComponent(invoiceId)}/mark-credit-purchase`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await refreshPortalState({ force: true });
    },
    [portalUsesLive, refreshPortalState]
  );

  const submitSupplierProforma = useCallback(
    async (requisitionId, payload) => {
      requireApiWorkspace(portalUsesLive);
      await apiFetch(`/requisitions/${encodeURIComponent(requisitionId)}/supplier-proforma`, {
        method: 'POST',
        body: JSON.stringify({
          reference: String(payload.reference || ''),
          amount: Number(payload.amount) || 0,
          attachmentUrl: String(payload.attachmentUrl || 'proforma-upload.pdf'),
          notes: String(payload.notes || ''),
          currency: String(payload.currency || 'RWF'),
        }),
      });
      await refreshPortalState({ force: true });
    },
    [portalUsesLive, refreshPortalState]
  );

  const attachDeliveryNote = useCallback(
    async (invoiceId, deliveryNoteUrl) => {
      requireApiWorkspace(portalUsesLive);
      await apiFetch(`/invoices/${encodeURIComponent(invoiceId)}/delivery-note`, {
        method: 'POST',
        body: JSON.stringify({ deliveryNoteUrl: deliveryNoteUrl || 'delivery-note.pdf' }),
      });
      await refreshPortalState({ force: true });
    },
    [portalUsesLive, refreshPortalState]
  );

  const attachFinalInvoice = useCallback(
    async (invoiceId, finalInvoiceUrl) => {
      requireApiWorkspace(portalUsesLive);
      await apiFetch(`/invoices/${encodeURIComponent(invoiceId)}/final-invoice`, {
        method: 'POST',
        body: JSON.stringify({ finalInvoiceUrl: finalInvoiceUrl || 'final-invoice.pdf' }),
      });
      await refreshPortalState({ force: true });
    },
    [portalUsesLive, refreshPortalState]
  );

  const upsertSupplierCatalogItem = useCallback(
    async (payload) => {
      requireApiWorkspace(portalUsesLive);
      await apiFetch('/catalog', {
        method: 'POST',
        body: JSON.stringify({
          id: payload.id,
          name: payload.name,
          sku: payload.sku,
          category: payload.category,
          price: payload.price,
          quantity: payload.quantity,
          minThreshold: payload.minThreshold,
          maxThreshold: payload.maxThreshold,
          unit: payload.unit,
          description: payload.description,
          storageLocation: payload.storageLocation,
          listed: payload.listed,
        }),
      });
      await refreshPortalState({ force: true });
    },
    [portalUsesLive, refreshPortalState]
  );

  const inviteWorkspaceUser = useCallback(
    async (payload) => {
      requireApiWorkspace(portalUsesLive);
      const data = await apiFetch('/workspace/users/invite', {
        method: 'POST',
        body: JSON.stringify({
          email: payload.email,
          fullName: payload.fullName,
          role: payload.role,
          jobTitle: payload.jobTitle,
          team: payload.team,
          phone: payload.phone,
          location: payload.location,
          department: payload.department,
          companyName: payload.companyName,
          logoUrl: payload.logoUrl,
        }),
      });
      await refreshPortalState({ force: true });
      return data;
    },
    [portalUsesLive, refreshPortalState]
  );

  const toggleWorkspaceUserActive = useCallback(
    async (userId) => {
      requireApiWorkspace(portalUsesLive);
      await apiFetch(`/workspace/users/${encodeURIComponent(userId)}/toggle-active`, {
        method: 'PATCH',
      });
      await refreshPortalState({ force: true });
    },
    [portalUsesLive, refreshPortalState]
  );

  const updateWorkspaceUser = useCallback(
    async (userId, patch) => {
      requireApiWorkspace(portalUsesLive);
      await apiFetch(`/workspace/users/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      await refreshPortalState({ force: true });
    },
    [portalUsesLive, refreshPortalState]
  );

  const updateMyProfile = useCallback(
    async (patch) => {
      requireApiWorkspace(portalUsesLive);
      await apiFetch('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      await refreshPortalState({ force: true });
    },
    [portalUsesLive, refreshPortalState]
  );

  const deleteWorkspaceUser = useCallback(
    async (userId) => {
      requireApiWorkspace(portalUsesLive);
      await apiFetch(`/workspace/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
      await refreshPortalState({ force: true });
    },
    [portalUsesLive, refreshPortalState]
  );

  const patchCompanySettings = useCallback(
    async (patch) => {
      requireApiWorkspace(portalUsesLive);
      await apiFetch('/company', {
        method: 'PATCH',
        body: JSON.stringify({
          name: patch.name,
          type: patch.type,
          language: patch.language,
          currency: patch.currency,
          usersLimit: patch.usersLimit != null ? Number(patch.usersLimit) : undefined,
          industry: patch.industry,
          legalName: patch.legalName,
          taxId: patch.taxId,
          address: patch.address,
          lowStockThreshold: patch.lowStockThreshold,
          anomalyDetection: patch.anomalyDetection,
          auditRetention: patch.auditRetention,
          sessionTimeout: patch.sessionTimeout,
          logoUrl: patch.logoUrl,
        }),
      });
      await refreshPortalState({ force: true });
    },
    [portalUsesLive, refreshPortalState]
  );

  const sendPortalMessage = useCallback(
    async ({ toRole, title, body }) => {
      requireApiWorkspace(portalUsesLive);
      await apiFetch('/messages', {
        method: 'POST',
        body: JSON.stringify({
          toRole,
          title: title || 'Message',
          body: String(body || '').trim(),
        }),
      });
      await refreshPortalState({ force: true });
    },
    [portalUsesLive, refreshPortalState]
  );

  const markNotificationRead = useCallback(
    async (notificationId) => {
      requireApiWorkspace(portalUsesLive);
      await apiFetch(`/notifications/${encodeURIComponent(notificationId)}/read`, {
        method: 'PATCH',
      });
      await refreshPortalState({ force: true });
    },
    [portalUsesLive, refreshPortalState]
  );

  const clerkUsesApi = portalUsesLive && user?.role === 'clerk';
  const supervisorUsesApi = portalUsesLive && user?.role === 'supervisor';
  const accountantUsesApi = portalUsesLive && user?.role === 'accountant';
  const supplierUsesApi = portalUsesLive && user?.role === 'supplier';
  const adminUsesApi = portalUsesLive && user?.role === 'admin';

  const value = useMemo(
    () => ({
      state,
      apiMode,
      clerkUsesApi,
      supervisorUsesApi,
      accountantUsesApi,
      supplierUsesApi,
      adminUsesApi,
      portalUsesLive,
      portalLoading,
      portalError,
      portalErrorMessage,
      databaseUnavailable,
      refreshPortalState,
      addStockItem,
      addMasterCatalogItem,
      updateStockItem,
      deleteStockItem,
      consumeStockItem,
      createRequisition,
      reviewRequisition,
      clerkProformaReview,
      accountantReviewInvoice,
      markInvoicePaid,
      markInvoiceCreditPurchase,
      submitSupplierProforma,
      attachDeliveryNote,
      attachFinalInvoice,
      upsertSupplierCatalogItem,
      inviteWorkspaceUser,
      toggleWorkspaceUserActive,
      updateWorkspaceUser,
      deleteWorkspaceUser,
      patchCompanySettings,
      sendPortalMessage,
      updateMyProfile,
      switchCompany,
      markNotificationRead,
    }),
    [
      state,
      apiMode,
      clerkUsesApi,
      supervisorUsesApi,
      accountantUsesApi,
      supplierUsesApi,
      adminUsesApi,
      portalUsesLive,
      portalLoading,
      portalError,
      portalErrorMessage,
      databaseUnavailable,
      refreshPortalState,
      addStockItem,
      addMasterCatalogItem,
      updateStockItem,
      deleteStockItem,
      consumeStockItem,
      createRequisition,
      reviewRequisition,
      clerkProformaReview,
      accountantReviewInvoice,
      markInvoicePaid,
      markInvoiceCreditPurchase,
      submitSupplierProforma,
      attachDeliveryNote,
      attachFinalInvoice,
      upsertSupplierCatalogItem,
      inviteWorkspaceUser,
      toggleWorkspaceUserActive,
      updateWorkspaceUser,
      deleteWorkspaceUser,
      patchCompanySettings,
      sendPortalMessage,
      updateMyProfile,
      switchCompany,
      markNotificationRead,
    ]
  );

  return <PortalStateContext.Provider value={value}>{children}</PortalStateContext.Provider>;
}

export function usePortalData() {
  const ctx = useContext(PortalStateContext);
  if (!ctx) throw new Error('usePortalData must be used within PortalStateProvider');
  return ctx;
}

export function notificationsForRole(state, role, userId) {
  const uid = userId != null ? String(userId).trim() : '';
  return (state?.notifications || []).filter((n) => {
    const nid = n.userId != null ? String(n.userId).trim() : '';
    if (nid) return uid !== '' && nid === uid;
    return n.role === role;
  });
}

export function messagesForRole(state, role, userId) {
  const uid = userId != null ? String(userId).trim() : '';
  return (state?.messages || []).filter((m) => {
    const mid = m.userId != null ? String(m.userId).trim() : '';
    if (mid) return uid !== '' && mid === uid;
    return m.role === role;
  });
}
