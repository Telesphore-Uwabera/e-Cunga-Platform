import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { apiFetch, getToken } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';
import {
  accountantReviewInvoice as mockAccountantReviewInvoice,
  addStockItem as mockAddStockItem,
  attachDeliveryNote as mockAttachDeliveryNote,
  attachFinalInvoice as mockAttachFinalInvoice,
  consumeStockItem as mockConsumeStockItem,
  createRequisition as mockCreateRequisition,
  inviteUser as mockInviteUser,
  markInvoicePaid as mockMarkInvoicePaid,
  reviewRequisition as mockReviewRequisition,
  submitSupplierProforma as mockSubmitSupplierProforma,
  selectCompany as mockSelectCompany,
  toggleUserActive as mockToggleUserActive,
  updateCompanySettings as mockUpdateCompanySettings,
  upsertSupplierCatalogItem as mockUpsertSupplierCatalogItem,
  usePortalState as useMockPortalState,
} from '../data/mockPortal.js';

const PortalStateContext = createContext(null);

function emptyLiveShape(mockState) {
  return {
    version: 5,
    companies: mockState?.companies || [],
    selectedCompanyId: mockState?.selectedCompanyId || '',
    users: [],
    stockItems: [],
    consumptions: [],
    requisitions: [],
    invoices: [],
    supplierCatalog: [],
    messages: [],
    notifications: [],
    activity: [],
  };
}

export function PortalStateProvider({ children }) {
  const { user, bootstrapping, logout } = useAuth();
  const mockState = useMockPortalState();

  const [apiMode, setApiMode] = useState(null);
  const [liveState, setLiveState] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const clerkUsesApi = apiMode === true && user?.role === 'clerk';
  const supervisorUsesApi = apiMode === true && user?.role === 'supervisor';
  const accountantUsesApi = apiMode === true && user?.role === 'accountant';
  const supplierUsesApi = apiMode === true && user?.role === 'supplier';
  const adminUsesApi = apiMode === true && user?.role === 'admin';
  const portalUsesLive =
    clerkUsesApi || supervisorUsesApi || accountantUsesApi || supplierUsesApi || adminUsesApi;

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
    }
  }, [user]);

  const refreshPortalState = useCallback(async () => {
    if (!getToken() || !portalUsesLive) return;
    setFetching(true);
    setFetchError(null);
    try {
      const data = await apiFetch('/portal/state');
      setLiveState(data);
    } catch (e) {
      if (e.status === 401 && getToken()) {
        setLiveState(null);
        setFetchError(null);
        logout();
        return;
      }
      setFetchError(e.message || 'Failed to load workspace data.');
      setLiveState(null);
    } finally {
      setFetching(false);
    }
  }, [portalUsesLive, logout]);

  useEffect(() => {
    if (bootstrapping || !portalUsesLive) return;
    refreshPortalState();
  }, [bootstrapping, portalUsesLive, user?.id, refreshPortalState]);

  /** In API mode, never fall back to mock seed data—only empty shell until /portal/state loads. */
  const state = useMemo(() => {
    const raw = portalUsesLive ? liveState : mockState;
    if (!raw) return emptyLiveShape(mockState);
    const company = raw.companies?.find((c) => c.id === raw.selectedCompanyId) || raw.companies?.[0] || { name: 'Unknown' };
    const cid = company.id;

    // For Admin using the switcher, we filter globally. For others, they only stay in their tenant.
    const filteredState = {
      ...raw,
      company,
      users: (raw.users || []).filter((u) => u.companyId === cid || u.role === 'admin'),
      stockItems: (raw.stockItems || []).filter((i) => i.companyId === cid),
      requisitions: (raw.requisitions || []).filter((r) => r.companyId === cid),
      invoices: (raw.invoices || []).filter((v) => v.companyId === cid),
      consumptions: (raw.consumptions || []).filter((c) => c.companyId === cid),
      messages: (raw.messages || []).map(m => m), // Keep global list or filter as needed
      notifications: (raw.notifications || []).map(n => n), 
    };

    return filteredState;
  }, [portalUsesLive, liveState, mockState]);

  const switchCompany = useCallback(async (companyId) => {
    if (portalUsesLive) {
      // API call
    } else {
      mockSelectCompany(companyId);
    }
  }, [portalUsesLive]);

  const portalLoading = portalUsesLive && fetching && !liveState && !fetchError;
  const portalError = Boolean(portalUsesLive && fetchError && !fetching && !liveState);

  const addStockItem = useCallback(
    async (payload, actorId) => {
      if (clerkUsesApi && getToken()) {
        await apiFetch('/stock', {
          method: 'POST',
          body: JSON.stringify({ ...payload, ownerId: actorId }),
        });
        await refreshPortalState();
        return;
      }
      mockAddStockItem(payload, actorId);
    },
    [clerkUsesApi, refreshPortalState]
  );

  const consumeStockItem = useCallback(
    async ({ itemId, quantity, purpose, consumptionKind, relatedRequisitionId }, actorId) => {
      if (clerkUsesApi && getToken()) {
        await apiFetch(`/stock/${encodeURIComponent(itemId)}/consume`, {
          method: 'POST',
          body: JSON.stringify({ quantity, purpose, consumptionKind, relatedRequisitionId }),
        });
        await refreshPortalState();
        return;
      }
      mockConsumeStockItem({ itemId, quantity, purpose }, actorId);
    },
    [clerkUsesApi, refreshPortalState]
  );

  const createRequisition = useCallback(
    async (payload, _actorId) => {
      if (clerkUsesApi && getToken()) {
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
        await refreshPortalState();
        return;
      }
      mockCreateRequisition(payload, _actorId);
    },
    [clerkUsesApi, refreshPortalState]
  );

  const reviewRequisition = useCallback(
    async (requisitionId, decision, note, actorId) => {
      if (supervisorUsesApi && getToken()) {
        const apiDecision = decision === 'rejected' ? 'rejected' : 'approved';
        await apiFetch(`/requisitions/${encodeURIComponent(requisitionId)}/review`, {
          method: 'PATCH',
          body: JSON.stringify({ decision: apiDecision, note: note || '' }),
        });
        await refreshPortalState();
        return;
      }
      mockReviewRequisition(requisitionId, decision, note, actorId);
    },
    [supervisorUsesApi, refreshPortalState]
  );

  const accountantReviewInvoice = useCallback(
    async (invoiceId, decision, actorId) => {
      if (accountantUsesApi && getToken()) {
        const apiDecision = decision === 'rejected' ? 'rejected' : 'approved';
        await apiFetch(`/invoices/${encodeURIComponent(invoiceId)}/accountant-review`, {
          method: 'POST',
          body: JSON.stringify({ decision: apiDecision }),
        });
        await refreshPortalState();
        return;
      }
      mockAccountantReviewInvoice(invoiceId, decision, actorId);
    },
    [accountantUsesApi, refreshPortalState]
  );

  const markInvoicePaid = useCallback(
    async (invoiceId, actorId) => {
      if (accountantUsesApi && getToken()) {
        await apiFetch(`/invoices/${encodeURIComponent(invoiceId)}/mark-paid`, {
          method: 'POST',
          body: JSON.stringify({}),
        });
        await refreshPortalState();
        return;
      }
      mockMarkInvoicePaid(invoiceId, actorId);
    },
    [accountantUsesApi, refreshPortalState]
  );

  const submitSupplierProforma = useCallback(
    async (requisitionId, payload, actorId) => {
      if (supplierUsesApi && getToken()) {
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
        await refreshPortalState();
        return;
      }
      mockSubmitSupplierProforma(requisitionId, payload, actorId);
    },
    [supplierUsesApi, refreshPortalState]
  );

  const attachDeliveryNote = useCallback(
    async (invoiceId, deliveryNoteUrl, actorId) => {
      if (supplierUsesApi && getToken()) {
        await apiFetch(`/invoices/${encodeURIComponent(invoiceId)}/delivery-note`, {
          method: 'POST',
          body: JSON.stringify({ deliveryNoteUrl: deliveryNoteUrl || 'delivery-note.pdf' }),
        });
        await refreshPortalState();
        return;
      }
      mockAttachDeliveryNote(invoiceId, deliveryNoteUrl, actorId);
    },
    [supplierUsesApi, refreshPortalState]
  );

  const attachFinalInvoice = useCallback(
    async (invoiceId, finalInvoiceUrl, actorId) => {
      if (supplierUsesApi && getToken()) {
        await apiFetch(`/invoices/${encodeURIComponent(invoiceId)}/final-invoice`, {
          method: 'POST',
          body: JSON.stringify({ finalInvoiceUrl: finalInvoiceUrl || 'final-invoice.pdf' }),
        });
        await refreshPortalState();
        return;
      }
      mockAttachFinalInvoice(invoiceId, finalInvoiceUrl, actorId);
    },
    [supplierUsesApi, refreshPortalState]
  );

  const upsertSupplierCatalogItem = useCallback(
    async (payload, actorId) => {
      if (supplierUsesApi && getToken()) {
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
        await refreshPortalState();
        return;
      }
      mockUpsertSupplierCatalogItem(payload, actorId);
    },
    [supplierUsesApi, refreshPortalState]
  );

  const inviteWorkspaceUser = useCallback(
    async (payload, actorId) => {
      if ((adminUsesApi || supervisorUsesApi) && getToken()) {
        const data = await apiFetch('/workspace/users/invite', {
          method: 'POST',
          body: JSON.stringify({
            email: payload.email,
            fullName: payload.fullName,
            role: payload.role,
            team: payload.team,
            location: payload.location,
          }),
        });
        await refreshPortalState();
        return data;
      }
      mockInviteUser(payload, actorId);
      return {};
    },
    [adminUsesApi, supervisorUsesApi, refreshPortalState]
  );

  const toggleWorkspaceUserActive = useCallback(
    async (userId, actorId) => {
      if ((adminUsesApi || supervisorUsesApi) && getToken()) {
        await apiFetch(`/workspace/users/${encodeURIComponent(userId)}/toggle-active`, {
          method: 'PATCH',
        });
        await refreshPortalState();
        return;
      }
      mockToggleUserActive(userId, actorId);
    },
    [adminUsesApi, supervisorUsesApi, refreshPortalState]
  );

  const patchCompanySettings = useCallback(
    async (patch, actorId) => {
      if (adminUsesApi && getToken()) {
        await apiFetch('/company', {
          method: 'PATCH',
          body: JSON.stringify({
            name: patch.name,
            type: patch.type,
            language: patch.language,
            currency: patch.currency,
            usersLimit: patch.usersLimit != null ? Number(patch.usersLimit) : undefined,
            industry: patch.industry,
          }),
        });
        await refreshPortalState();
        return;
      }
      mockUpdateCompanySettings(patch, actorId);
    },
    [adminUsesApi, refreshPortalState]
  );

  const sendPortalMessage = useCallback(
    async ({ toRole, title, body }) => {
      if (!getToken()) {
        throw new Error('Sign in to send messages.');
      }
      if (!portalUsesLive) {
        throw new Error('Database mode is required to send messages.');
      }
      await apiFetch('/messages', {
        method: 'POST',
        body: JSON.stringify({
          toRole,
          title: title || 'Message',
          body: String(body || '').trim(),
        }),
      });
      await refreshPortalState();
    },
    [portalUsesLive, refreshPortalState]
  );

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
      refreshPortalState,
      addStockItem,
      consumeStockItem,
      createRequisition,
      reviewRequisition,
      accountantReviewInvoice,
      markInvoicePaid,
      submitSupplierProforma,
      attachDeliveryNote,
      attachFinalInvoice,
      upsertSupplierCatalogItem,
      inviteWorkspaceUser,
      toggleWorkspaceUserActive,
      patchCompanySettings,
      sendPortalMessage,
      switchCompany,
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
      refreshPortalState,
      addStockItem,
      consumeStockItem,
      createRequisition,
      reviewRequisition,
      accountantReviewInvoice,
      markInvoicePaid,
      submitSupplierProforma,
      attachDeliveryNote,
      attachFinalInvoice,
      upsertSupplierCatalogItem,
      inviteWorkspaceUser,
      toggleWorkspaceUserActive,
      patchCompanySettings,
      sendPortalMessage,
      switchCompany,
    ]
  );

  return <PortalStateContext.Provider value={value}>{children}</PortalStateContext.Provider>;
}

export function usePortalData() {
  const ctx = useContext(PortalStateContext);
  if (!ctx) throw new Error('usePortalData must be used within PortalStateProvider');
  return ctx;
}

/** Filter notifications the same way as mock helpers, but from merged portal state. */
export function notificationsForRole(state, role) {
  return (state?.notifications || []).filter((n) => n.role === role);
}

export function messagesForRole(state, role) {
  return (state?.messages || []).filter((m) => m.role === role);
}
