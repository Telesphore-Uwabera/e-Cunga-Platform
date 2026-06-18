/**
 * Full demo-credentials smoke test for all portal roles.
 * Usage:
 *   E2E_API_URL=https://e-cunga-platform.onrender.com/api DEMO_PASSWORD='...' node scripts/e2eDemoCredentialsTest.js
 */
import 'dotenv/config';

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}

const API_ROOT = (arg('--api', process.env.E2E_API_URL || 'http://localhost:5000/api')).replace(/\/+$/, '');
const PASSWORD = arg('--password', process.env.DEMO_PASSWORD || 'Masangano@16');

const USERS = {
  supervisor: 't.uwabera@alustudent.com',
  clerk: 'telesphore91073@gmail.com',
  accountant: 'uwaberatelesphore@gmail.com',
  supplier: 'benithehirwa@gmail.com',
};

const results = [];
let passed = 0;
let failed = 0;

function record(role, step, ok, detail = '') {
  const row = { role, step, ok, detail };
  results.push(row);
  if (ok) {
    passed += 1;
    console.log(`  ✓ [${role}] ${step}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.error(`  ✗ [${role}] ${step}${detail ? ` — ${detail}` : ''}`);
  }
}

async function login(email, password) {
  const res = await fetch(`${API_ROOT}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || `HTTP ${res.status}`);
  if (!data.token) throw new Error('No token returned');
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
  return { ok: res.ok, status: res.status, data, text };
}

async function testHealth() {
  const healthUrl = API_ROOT.replace(/\/api\/?$/, '/api/health');
  const res = await fetch(healthUrl).then((r) => r.json()).catch(() => null);
  record('system', 'API health', Boolean(res?.ok || res?.mode), `mode=${res?.mode || 'unknown'} url=${healthUrl}`);
  return res;
}

async function testRoleLogins() {
  const tokens = {};
  for (const [role, email] of Object.entries(USERS)) {
    try {
      const { token, user } = await login(email, PASSWORD);
      tokens[role] = token;
      record(role, 'Login', true, `${user?.fullName || email} (${user?.role})`);
    } catch (err) {
      record(role, 'Login', false, err.message);
    }
  }
  return tokens;
}

async function testPortalState(role, token) {
  const r = await api('GET', '/portal/state', token);
  if (!r.ok) {
    record(role, 'Portal state', false, `${r.status}: ${r.data?.error || r.text}`);
    return null;
  }
  const s = r.data || {};
  record(role, 'Portal state', true, `reqs=${(s.requisitions || []).length} inv=${(s.invoices || []).length} stock=${(s.stockItems || []).length}`);
  return s;
}

async function testInternalWorkflow(tokens) {
  const { clerk: clerkTok, supervisor: superTok, supplier: supTok, accountant: acctTok } = tokens;
  if (!clerkTok || !superTok || !supTok || !acctTok) {
    record('workflow', 'Internal supplier flow', false, 'Missing role tokens');
    return;
  }

  const stamp = `DEMO-E2E-${Date.now()}`;
  let r = await api('POST', '/requisitions', clerkTok, {
    title: `Demo internal test ${stamp}`,
    priority: 'normal',
    location: 'Warehouse',
    requestingDepartment: 'Testing',
    lines: [{ description: 'Demo consumable', quantity: 2, unit: 'units', estimatedCost: 500 }],
  });
  if (!r.ok) {
    record('workflow', 'Clerk create requisition', false, r.data?.error || r.text);
    return;
  }
  const reqId = r.data?.requisition?._id || r.data?.requisition?.id;
  record('workflow', 'Clerk create requisition', Boolean(reqId), reqId);

  const supProfile = (await api('GET', '/portal/state', supTok)).data;
  const supplierUserId = String(
    (await login(USERS.supplier, PASSWORD)).user?.id ||
    (await login(USERS.supplier, PASSWORD)).user?._id ||
    ''
  ).trim();

  r = await api('PATCH', `/requisitions/${encodeURIComponent(reqId)}/review`, superTok, {
    decision: 'approved',
    note: 'Demo auto-approve internal',
    supplierId: supplierUserId,
  });
  record('workflow', 'Supervisor approve + assign supplier', r.ok, r.data?.requisition?.status || r.data?.error);

  r = await api('POST', `/requisitions/${encodeURIComponent(reqId)}/supplier-proforma`, supTok, {
    reference: `PRO-${stamp}`,
    amount: 12000,
    currency: 'RWF',
    attachmentUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/demo-proforma.pdf',
    notes: 'Demo proforma',
  });
  const invoiceId = r.data?.invoice?._id || r.data?.invoice?.id;
  if (!r.ok || !invoiceId) {
    record('workflow', 'Supplier upload proforma', false, r.data?.error || r.text);
    return;
  }
  record('workflow', 'Supplier upload proforma', true, invoiceId);

  r = await api('POST', `/requisitions/${encodeURIComponent(reqId)}/clerk-proforma-review`, clerkTok, {
    decision: 'accepted',
    note: 'Demo accept',
  });
  record('workflow', 'Clerk accept proforma', r.ok, r.data?.requisition?.status || r.data?.error);

  r = await api('POST', `/invoices/${encodeURIComponent(invoiceId)}/accountant-review`, acctTok, {
    decision: 'approved',
  });
  record('workflow', 'Accountant approve proforma', r.ok, r.data?.invoice?.status || r.data?.error);

  r = await api('POST', `/invoices/${encodeURIComponent(invoiceId)}/mark-paid`, acctTok, {});
  record('workflow', 'Accountant mark paid', r.ok, r.data?.invoice?.status || r.data?.error);

  r = await api('POST', `/invoices/${encodeURIComponent(invoiceId)}/final-invoice`, supTok, {
    finalInvoiceUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/demo-final.pdf',
  });
  record('workflow', 'Supplier upload final invoice', r.ok, r.data?.invoice?.status || r.data?.error);

  r = await api('POST', `/invoices/${encodeURIComponent(invoiceId)}/delivery-note`, clerkTok, {
    deliveryNoteUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/demo-delivery.pdf',
  });
  record('workflow', 'Clerk delivery note', r.ok, r.data?.invoice?.status || r.data?.error);

  return { reqId, invoiceId };
}

async function testExternalWorkflow(tokens) {
  const { clerk: clerkTok, supervisor: superTok, accountant: acctTok } = tokens;
  if (!clerkTok || !superTok || !acctTok) {
    record('workflow', 'External supplier flow', false, 'Missing role tokens');
    return;
  }

  const stamp = `DEMO-EXT-${Date.now()}`;
  let r = await api('POST', '/requisitions', clerkTok, {
    title: `Demo external test ${stamp}`,
    priority: 'normal',
    location: 'Warehouse',
    requestingDepartment: 'Testing',
    lines: [{ description: 'External demo item', quantity: 1, unit: 'units', estimatedCost: 800 }],
  });
  if (!r.ok) {
    record('workflow', 'External: clerk create', false, r.data?.error || r.text);
    return;
  }
  const reqId = r.data?.requisition?._id || r.data?.requisition?.id;
  record('workflow', 'External: clerk create', Boolean(reqId), reqId);

  r = await api('PATCH', `/requisitions/${encodeURIComponent(reqId)}/review`, superTok, {
    decision: 'approved',
    note: 'Demo external approve',
    supplierId: '',
  });
  record('workflow', 'External: supervisor approve (no supplier)', r.ok, r.data?.requisition?.status || r.data?.error);

  r = await api('PATCH', `/requisitions/${encodeURIComponent(reqId)}/clerk-upload-external`, clerkTok, {
    type: 'proforma',
    reference: `EXT-PRO-${stamp}`,
    amount: 9500,
    currency: 'RWF',
    attachmentUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/demo-ext-proforma.pdf',
    notes: 'External proforma demo',
  });
  const proformaInvId = r.data?.invoice?._id || r.data?.invoice?.id;
  record('workflow', 'External: clerk upload proforma', r.ok, `${r.data?.requisition?.status || ''} inv=${proformaInvId || r.data?.error}`);

  if (proformaInvId) {
    r = await api('POST', `/invoices/${encodeURIComponent(proformaInvId)}/accountant-review`, acctTok, {
      decision: 'approved',
    });
    record('workflow', 'External: accountant approve (skipped by design)', !r.ok && r.status === 403, r.data?.error || 'external clerk-managed flow');

    r = await api('POST', `/invoices/${encodeURIComponent(proformaInvId)}/mark-paid`, acctTok, {});
    record('workflow', 'External: accountant mark paid (skipped by design)', !r.ok && (r.status === 403 || r.status === 400), r.data?.error || 'external clerk-managed flow');
  }

  r = await api('PATCH', `/requisitions/${encodeURIComponent(reqId)}/clerk-upload-external`, clerkTok, {
    type: 'final',
    reference: `EXT-FIN-${stamp}`,
    amount: 9500,
    currency: 'RWF',
    attachmentUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/demo-ext-final.pdf',
    notes: 'External final invoice demo',
  });
  record('workflow', 'External: clerk upload final invoice', r.ok, `${r.data?.requisition?.status || ''} ${r.data?.error || r.data?.details || ''}`);

  if (proformaInvId) {
    r = await api('POST', `/invoices/${encodeURIComponent(proformaInvId)}/delivery-note`, clerkTok, {
      deliveryNoteUrl: 'https://res.cloudinary.com/demo/raw/upload/v1/demo-ext-delivery.pdf',
    });
    record('workflow', 'External: clerk delivery note', r.ok, r.data?.invoice?.status || r.data?.error);
  }
}

async function testRoleEndpoints(tokens) {
  for (const role of ['clerk', 'supervisor', 'accountant', 'supplier']) {
    const token = tokens[role];
    if (!token) continue;

    const notif = await api('GET', '/notifications', token);
    record(role, 'Notifications list', notif.ok, notif.ok ? `${(notif.data?.notifications || []).length} items` : notif.data?.error);

    const msgs = await api('GET', '/messages', token);
    record(role, 'Messages list', msgs.ok, msgs.ok ? `${(msgs.data?.messages || []).length} items` : msgs.data?.error);

    const activity = await api('GET', '/activity', token);
    const activityExpected = role === 'admin';
    record(role, 'Activity log', activityExpected ? activity.ok : !activity.ok || activity.status === 403, activity.ok ? `${(activity.data?.activities || activity.data?.items || []).length} items` : activityExpected ? activity.data?.error : 'restricted (expected)');

    const reqs = await api('GET', '/requisitions', token);
    record(role, 'Requisitions list', reqs.ok, reqs.ok ? `${(reqs.data?.requisitions || []).length} items` : reqs.data?.error);

    const inv = await api('GET', '/invoices', token);
    record(role, 'Invoices list', inv.ok, inv.ok ? `${(inv.data?.invoices || []).length} items` : inv.data?.error);
  }

  if (tokens.clerk) {
    const stock = await api('GET', '/stock', tokens.clerk);
    record('clerk', 'Stock inventory', stock.ok, stock.ok ? `${(stock.data?.items || stock.data?.stockItems || []).length} SKUs` : stock.data?.error);
  }

  if (tokens.supervisor) {
    const suppliers = await api('GET', '/supplier-directory', tokens.supervisor);
    record('supervisor', 'Supplier directory', suppliers.ok, suppliers.ok ? `${(suppliers.data?.suppliers || []).length} suppliers` : suppliers.data?.error);
  }
}

async function main() {
  console.log(`\n=== e-Cunga Demo Credentials Test ===`);
  console.log(`API: ${API_ROOT}\n`);

  await testHealth();
  const tokens = await testRoleLogins();

  console.log('\n--- Portal state per role ---');
  for (const role of Object.keys(USERS)) {
    if (tokens[role]) await testPortalState(role, tokens[role]);
  }

  console.log('\n--- Role endpoint access ---');
  await testRoleEndpoints(tokens);

  console.log('\n--- Internal supplier workflow ---');
  await testInternalWorkflow(tokens);

  console.log('\n--- External supplier workflow ---');
  await testExternalWorkflow(tokens);

  console.log('\n=== Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${results.length}`);

  if (failed > 0) {
    console.log('\nFailed steps:');
    results.filter((r) => !r.ok).forEach((r) => console.log(`  - [${r.role}] ${r.step}: ${r.detail}`));
    process.exit(1);
  }
  console.log('\nAll demo credential tests passed.');
}

main().catch((err) => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
