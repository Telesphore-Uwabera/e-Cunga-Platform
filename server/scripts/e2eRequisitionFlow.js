/**
 * End-to-end requisition workflow smoke test (requires MongoDB API mode).
 * Run with API server up:  node scripts/e2eRequisitionFlow.js
 *
 * Flow: clerk create → supervisor approve + supplier → supplier proforma
 *       → clerk accept proforma → accountant approve → mark paid
 *
 * Uses DEMO_* env vars (same as demo seed / .env).
 */
import 'dotenv/config';

const API_ROOT = (process.env.E2E_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo@1234';
const EMAILS = {
  clerk: process.env.DEMO_EMAIL_CLERK_ONE || 'clerk.one@ecunga.com',
  supervisor: process.env.DEMO_EMAIL_SUPERVISOR || 'supervisor@ecunga.com',
  supplier: process.env.DEMO_EMAIL_SUPPLIER || 'supplier@ecunga.com',
  accountant: process.env.DEMO_EMAIL_ACCOUNTANT || 'accountant@ecunga.com',
};
function log(step, detail) {
  console.log(`[e2e] ${step}${detail != null ? `: ${detail}` : ''}`);
}

async function login(email, password) {
  const res = await fetch(`${API_ROOT}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${data.error || res.statusText}`);
  }
  if (!data.token) throw new Error(`No token for ${email}`);
  return { token: data.token, user: data.user || null };
}

async function api(method, path, token, body) {
  const headers = { Authorization: `Bearer ${token}` };
  let reqBody;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    reqBody = JSON.stringify(body);
  }
  const res = await fetch(`${API_ROOT}${path}`, { method, headers, body: reqBody });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`${method} ${path} → ${res.status}: ${data?.error || text || 'error'}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

function assert(cond, msg) {
  if (!cond) throw new Error(`Assert failed: ${msg}`);
}

async function main() {
  const healthUrl = API_ROOT.replace(/\/api\/?$/, '/api/health');
  const h = await fetch(healthUrl).then((r) => r.json());
  assert(h.mode === 'database', `Need MongoDB API mode (got ${h.mode}). Start server with MONGODB_URI.`);

  log('login', 'clerk');
  const { token: clerkTok } = await login(EMAILS.clerk, DEMO_PASSWORD);
  log('login', 'supervisor');
  const { token: superTok } = await login(EMAILS.supervisor, DEMO_PASSWORD);
  log('login', 'supplier');
  const { token: supTok, user: supplierProfile } = await login(EMAILS.supplier, DEMO_PASSWORD);
  const supplierUserId = String(supplierProfile?.id || supplierProfile?._id || '').trim();
  assert(supplierUserId, 'Supplier login must return user.id for supervisor approval');
  log('login', 'accountant');
  const { token: acctTok } = await login(EMAILS.accountant, DEMO_PASSWORD);

  const stamp = `E2E-${Date.now()}`;
  log('create', 'requisition');
  const created = await api('POST', '/requisitions', clerkTok, {
    title: `E2E flow ${stamp}`,
    priority: 'normal',
    location: 'Warehouse A',
    requestingDepartment: 'Operations',
    deliveryNote: '',
    clerkJustification: 'Automated end-to-end test',
    lines: [
      { description: 'E2E test consumable', quantity: 3, unit: 'units', estimatedCost: 1000, dateValue: '' },
    ],
  });
  const reqId = created.requisition?._id || created.requisition?.id;
  assert(reqId, 'Missing requisition id from create response');

  let r = await api('GET', '/portal/state', clerkTok);
  let req = r.requisitions.find((q) => q.id === reqId);
  assert(req?.status === 'submitted', `Expected submitted, got ${req?.status}`);

  const supplierId = supplierUserId;
  log('supervisor approve', `supplierId=${supplierId} (demo supplier login)`);
  await api('PATCH', `/requisitions/${encodeURIComponent(reqId)}/review`, superTok, {
    decision: 'approved',
    note: 'e2e auto-approve',
    supplierId,
  });

  r = await api('GET', '/portal/state', supTok);
  req = r.requisitions.find((q) => q.id === reqId);
  assert(req?.status === 'sentToSupplier', `Expected sentToSupplier, got ${req?.status}`);
  assert(String(req?.supplierId) === String(supplierId), 'supplierId not set on requisition');

  const proRef = `PRO-${stamp}`;
  log('supplier proforma', proRef);
  const proformaRes = await api('POST', `/requisitions/${encodeURIComponent(reqId)}/supplier-proforma`, supTok, {
    reference: proRef,
    amount: 15000,
    currency: 'RWF',
    attachmentUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/e2e-proforma.pdf',
    notes: 'e2e proforma',
  });
  const invoiceId = proformaRes.invoice?._id || proformaRes.invoice?.id;
  assert(invoiceId, 'Missing invoice id from proforma response');

  r = await api('GET', '/portal/state', clerkTok);
  req = r.requisitions.find((q) => q.id === reqId);
  assert(req?.status === 'proformaAwaitingClerk', `Expected proformaAwaitingClerk, got ${req?.status}`);

  let inv = r.invoices.find((i) => i.id === invoiceId);
  assert(inv?.status === 'proformaReceived', `Expected proformaReceived, got ${inv?.status}`);
  assert(String(inv?.supplierId) === String(supplierId), 'Invoice supplierId should match assigned supplier');

  log('clerk accept proforma');
  await api('POST', `/requisitions/${encodeURIComponent(reqId)}/clerk-proforma-review`, clerkTok, {
    decision: 'accepted',
    note: '',
  });

  r = await api('GET', '/portal/state', acctTok);
  req = r.requisitions.find((q) => q.id === reqId);
  assert(req?.status === 'proformaReceived', `Expected proformaReceived on req, got ${req?.status}`);
  inv = r.invoices.find((i) => i.id === invoiceId);
  assert(inv?.status === 'proformaReceived', `Invoice still proformaReceived for accountant, got ${inv?.status}`);

  log('accountant approve proforma');
  await api('POST', `/invoices/${encodeURIComponent(invoiceId)}/accountant-review`, acctTok, {
    decision: 'approved',
  });

  r = await api('GET', '/portal/state', acctTok);
  req = r.requisitions.find((q) => q.id === reqId);
  inv = r.invoices.find((i) => i.id === invoiceId);
  assert(req?.status === 'proformaApproved', `Expected proformaApproved on req, got ${req?.status}`);
  assert(inv?.status === 'proformaApproved', `Expected proformaApproved on invoice, got ${inv?.status}`);

  log('accountant mark paid');
  await api('POST', `/invoices/${encodeURIComponent(invoiceId)}/mark-paid`, acctTok, {});

  r = await api('GET', '/portal/state', acctTok);
  req = r.requisitions.find((q) => q.id === reqId);
  inv = r.invoices.find((i) => i.id === invoiceId);
  assert(req?.status === 'paid', `Expected paid on req, got ${req?.status}`);
  assert(inv?.status === 'paid', `Expected paid on invoice, got ${inv?.status}`);

  log('clerk delivery note (optional URL)');
  await api('POST', `/invoices/${encodeURIComponent(invoiceId)}/delivery-note`, clerkTok, {
    deliveryNoteUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/e2e-delivery-note.pdf',
  });

  r = await api('GET', '/portal/state', acctTok);
  inv = r.invoices.find((i) => i.id === invoiceId);
  assert(inv?.status === 'deliveryNoteAttached', `Expected deliveryNoteAttached, got ${inv?.status}`);

  log('stats', 'cross-role /portal/state sanity');
  r = await api('GET', '/portal/state', superTok);
  const supReq = r.requisitions.find((q) => q.id === reqId);
  assert(supReq && supReq.status !== 'submitted', 'Supervisor stats: workflow req should not stay submitted');
  const pendingSupervisor = r.requisitions.filter((q) => q.status === 'submitted').length;
  assert(typeof pendingSupervisor === 'number', 'Supervisor pending count should be computable');

  r = await api('GET', '/portal/state', clerkTok);
  const clerkReq = r.requisitions.find((q) => q.id === reqId);
  assert(clerkReq, 'Clerk portal should include the workflow requisition');
  const clerkActive = r.requisitions.filter((q) => q.status !== 'closed' && q.status !== 'rejected').length;
  assert(clerkActive >= 1, 'Clerk should see at least one active requisition in KPI pool');

  r = await api('GET', '/portal/state', acctTok);
  assert(r.messages?.every((m) => m.companyId), 'Portal messages should include companyId for client filters');
  assert(r.notifications?.every((n) => n.companyId != null), 'Portal notifications should include companyId');
  const settledLike = r.invoices.filter((i) => ['paid', 'deliveryNoteAttached', 'closed'].includes(i.status)).length;
  assert(settledLike >= 1, 'Accountant should see at least one settled / in-flight paid invoice for charts');

  log('done', `OK — requisition ${reqId}, invoice ${invoiceId}, ref ${proRef}`);
  console.log('[e2e] All workflow steps passed.');
}

main().catch((err) => {
  console.error('[e2e] FAILED:', err.message);
  if (err.body) console.error(JSON.stringify(err.body, null, 2));
  process.exit(1);
});
