import { NAV_BY_ROLE, ROLE_LABELS } from '../constants/rbac.js';

function daysUntilExpiry(iso) {
  if (!iso) return 9999;
  return (new Date(iso).getTime() - Date.now()) / 86400000;
}

function navSegments(role) {
  return new Set((NAV_BY_ROLE[role] || []).map((item) => item.segment));
}

function pickShortcuts(role, preferred) {
  const allowed = navSegments(role);
  return preferred.filter((s) => allowed.has(s)).slice(0, 6);
}

function actorId(portalState, user) {
  return portalState.users.find((u) => u.email === user?.email)?.id;
}

/**
 * Page-specific quick rail: metrics, shortcuts, actions, and notify copy change per route.
 */
export function getWorkspaceRail({
  role,
  segment,
  language,
  portalState,
  user,
  notificationCount,
  messageCount,
  t,
}) {
  const k = language === 'kiny';
  const actor = actorId(portalState, user);
  const reqs = portalState.requisitions;
  const invs = portalState.invoices;
  const stock = portalState.stockItems;
  const users = portalState.users;
  const company = portalState.company;

  /** Clerk sees only their assigned stock; other roles use full company stock. */
  const stockScope = role === 'clerk' && actor ? stock.filter((s) => s.ownerId === actor) : stock;

  const consumptionScope =
    role === 'clerk' && actor
      ? (portalState.consumptions || []).filter((c) => c.clerkId === actor)
      : portalState.consumptions || [];

  const lowStock = stockScope.filter((s) => Number(s.quantity) <= Number(s.minThreshold || 0)).length;
  const expiring30 = stockScope.filter((s) => {
    const d = daysUntilExpiry(s.expiryDate);
    return d >= 0 && d <= 30;
  }).length;
  const openReqs = reqs.filter((r) => !['closed', 'rejected'].includes(r.status)).length;
  const submitted = reqs.filter((r) => r.status === 'submitted').length;
  const invProformaRecv = invs.filter((i) => i.status === 'proformaReceived').length;
  const invProformaOk = invs.filter((i) => i.status === 'proformaApproved').length;
  const invPaid = invs.filter((i) => i.status === 'paid' || i.status === 'deliveryNoteAttached').length;

  const defaultNotify = {
    kind: 'bell',
    title: k ? 'Amatangazo' : 'Notifications',
    meta: notificationCount
      ? k
        ? `${notificationCount} mu murongo wawe`
        : `${notificationCount} in your notification list`
      : k
        ? 'Nta matangazo'
        : 'You are caught up on alerts',
  };

  const msgNotify = {
    kind: 'chat',
    title: k ? 'Ubutumwa' : 'Messages',
    meta: messageCount
      ? k
        ? `${messageCount} butumwa mu murongo`
        : `${messageCount} threads in your inbox`
      : k
        ? 'Nta butumwa bushya'
        : 'No new threads',
  };

  /** Clerk */
  if (role === 'clerk') {
    const myActive = reqs.filter((r) => r.clerkId === actor && !['closed', 'rejected'].includes(r.status)).length;
    const mySubmitted = reqs.filter((r) => r.clerkId === actor && r.status === 'submitted').length;

    if (segment === 'dashboard') {
      return {
        eyebrow: k ? 'Incamake' : 'On dashboard',
        title: k ? 'Uburambe bw\'ububiko' : 'Inventory pulse',
        metrics: [
          { label: k ? 'Ibyo nkora' : 'My active reqs', value: myActive },
          { label: k ? 'SKU ziciriritse' : 'SKUs at/below min', value: lowStock },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['inventory', 'requests', 'materials', 'expiry', 'messages']),
        actions: [
          { segment: 'requests', label: k ? 'Kora kosora' : 'Stock operations', variant: 'primary' },
          { segment: 'materials', label: k ? 'Gusaba' : 'Request materials', variant: 'ghost' },
        ],
        tip: k
          ? 'Koresha urutonde rw\'ibikoresho kugira ngo ubone ubu buso bwihuse.'
          : 'Start from Inventory list when you need fast quantity checks before issuing stock.',
      };
    }
    if (segment === 'inventory') {
      return {
        eyebrow: k ? 'Urutonde' : 'On inventory list',
        title: k ? 'Imitiwere & ububiko' : 'SKU coverage',
        metrics: [
          { label: k ? 'Ibintu byose' : 'Total SKUs', value: stockScope.length },
          { label: k ? 'Hasi ya min' : 'At/below min', value: lowStock },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['expiry', 'requests', 'alerts', 'materials']),
        actions: [
          { segment: 'expiry', label: k ? 'Igenzura ry\'itariki' : 'Expiry tracking', variant: 'primary' },
          { segment: 'usage', label: k ? 'Ikoreshwa' : 'Usage log', variant: 'ghost' },
        ],
        tip: k
          ? 'Sakana ku rwego kugira ngo ubone ibintu bigomba kuvugururwa vuba.'
          : 'Sort by level to prioritise replenishment before creating a requisition.',
      };
    }
    if (segment === 'expiry') {
      return {
        eyebrow: k ? 'Itariki' : 'On expiry',
        title: k ? 'Kuri uyu munsi' : 'Date risk window',
        metrics: [
          { label: k ? 'Iminsi 30' : 'Due ≤ 30 days', value: expiring30 },
          { label: k ? 'Hasi ya min' : 'Low stock now', value: lowStock },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['inventory', 'requests', 'alerts']),
        actions: [{ segment: 'inventory', label: k ? 'Urutonde' : 'Open inventory', variant: 'primary' }],
        tip: k
          ? 'Fata ingingo ziri hafi y\'itariki mbere yo kuzisangiza abandi.'
          : 'Rotate batches with the nearest expiry first when issuing to wards.',
      };
    }
    if (segment === 'materials') {
      return {
        eyebrow: k ? 'Gusaba' : 'On materials request',
        title: k ? 'Gutanga ibisabwa' : 'Raise clean lines',
        metrics: [
          { label: k ? 'Zoherejwe' : 'My submitted', value: mySubmitted },
          { label: k ? 'Zifunguye' : 'My active reqs', value: myActive },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['requests', 'dashboard', 'messages']),
        actions: [{ segment: 'requests', label: k ? 'Ibikorwa' : 'Stock operations', variant: 'primary' }],
        tip: k
          ? 'Gerageza kugaragaza umubare w\'ukuri n\'ingengo y\'agaciro kugira ngo isuzuma rikore neza.'
          : 'Add realistic quantities and estimated cost so supervisors can approve in one pass.',
      };
    }
    if (segment === 'requests') {
      return {
        eyebrow: k ? 'Ibikorwa' : 'On stock operations',
        title: k ? 'Kohereza no gukoresha' : 'Issue & consume',
        metrics: [
          { label: k ? 'Zifunguye' : 'My active reqs', value: myActive },
          { label: k ? 'Zanzuye' : 'Awaiting supervisor', value: mySubmitted },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['materials', 'inventory', 'documents']),
        actions: [{ segment: 'materials', label: k ? 'Gusaba ibindi' : 'New material request', variant: 'primary' }],
        tip: k
          ? 'Bika impapuro z\'uko wakoresheje ibikoresho kugira ngo isesengura rikore neza.'
          : 'Link each consumption to a ward or cost centre for month-end traceability.',
      };
    }
    if (segment === 'alerts') {
      return {
        eyebrow: k ? 'Isesengura' : 'On analytics',
        title: k ? 'Imiterere y\'ikoreshwa' : 'Usage signals',
        metrics: [
          { label: k ? 'Ibikoreshwa' : 'My SKUs', value: stockScope.length },
          { label: k ? 'Ibikoreshwa' : 'My consumptions', value: consumptionScope.length },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['inventory', 'expiry', 'dashboard']),
        actions: [],
        tip: k
          ? 'Gereranya n\'imibare yo mu cyumweru gisanzwe kugira ngo ubone impinduka.'
          : 'Compare week-over-week movement before escalating a stock risk to supervisors.',
      };
    }
    if (segment === 'documents') {
      return {
        eyebrow: k ? 'Inyemezabuguzi' : 'On billing items',
        title: k ? 'Inyandiko zo kwishyura' : 'Billing trail',
        metrics: [
          { label: k ? 'Inyemezabuguzi' : 'Invoices', value: invs.length },
          { label: k ? 'Zifunguye' : 'Open reqs', value: openReqs },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['requests', 'messages', 'dashboard']),
        actions: [],
        tip: k
          ? 'Reba uko isaba rigenda kugeza ku kwishyura.'
          : 'Follow the requisition ID through to invoice status when reconciling charges.',
      };
    }
    if (segment === 'messages') {
      return {
        eyebrow: k ? 'Ubutumwa' : 'On messages',
        title: k ? 'Koresha uyu murongo' : 'Stay in the loop',
        metrics: [
          { label: k ? 'Ubutumwa' : 'Message threads', value: messageCount },
          { label: k ? 'Amatangazo' : 'Alerts queue', value: notificationCount },
        ],
        notify: msgNotify,
        shortcuts: pickShortcuts(role, ['dashboard', 'approvals', 'requests']),
        actions: [{ segment: 'dashboard', label: k ? 'Imbonerahamwe' : 'Back to dashboard', variant: 'primary' }],
        tip: k
          ? 'Inzira: Biganiro → Ububiko → Amatangazo → Abantu.'
          : 'Flow: Conversations → Digital repository → Notifications → Contacts & directory.',
      };
    }
    if (segment === 'usage') {
      return {
        eyebrow: k ? 'Ikoreshwa' : 'On usage',
        title: k ? 'Amateka yo gukoresha' : 'Consumption log',
        metrics: [
          { label: k ? 'Ibikorwa' : 'Logged events', value: consumptionScope.length },
          { label: k ? 'SKU' : 'Tracked SKUs', value: stockScope.length },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['inventory', 'requests']),
        actions: [{ segment: 'inventory', label: k ? 'Urutonde' : 'Inventory list', variant: 'primary' }],
        tip: k
          ? 'Impuzandengo zitunganya neza n\'ibikoresho byo mu bubiko.'
          : 'Cross-check spikes in usage against ward census or theatre lists.',
      };
    }
    return {
      eyebrow: k ? 'Urupapuro' : 'Clerk page',
      title: k ? 'Incamake y\'ububiko' : 'Inventory helper',
      metrics: [
        { label: k ? 'Ibyo nkora' : 'My active reqs', value: myActive },
        { label: k ? 'SKU ziciriritse' : 'SKUs at/below min', value: lowStock },
      ],
      notify: defaultNotify,
      shortcuts: pickShortcuts(role, ['dashboard', 'inventory', 'requests', 'messages']),
      actions: [{ segment: 'dashboard', label: k ? 'Imbonerahamwe' : 'Dashboard', variant: 'primary' }],
      tip: k
        ? 'Koresha inzira ngufi hepfo kugira ngo uhabwe urundi rupapuro rwihuse.'
        : 'Use related pages below for one-click navigation alongside the sidebar.',
    };
  }

  /** Supervisor */
  if (role === 'supervisor') {
    if (segment === 'dashboard') {
      return {
        eyebrow: k ? 'Incamake' : 'On dashboard',
        title: k ? 'Isuzuma n\'igenzura' : 'Approvals overview',
        metrics: [
          { label: k ? 'Zitegereje' : 'Needs approval', value: submitted },
          { label: k ? 'Zifunguye' : 'Open workflows', value: openReqs },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['approvals', 'visibility', 'reports']),
        actions: [{ segment: 'approvals', label: k ? 'Isuzuma' : 'Open approvals', variant: 'primary' }],
        tip: k
          ? 'Emera ibisabwa bihuze mu manota imwe kugira ngo ubucometso burusheho.'
          : 'Batch similar requisitions in one sitting to keep supplier SLA healthy.',
      };
    }
    if (segment === 'visibility') {
      return {
        eyebrow: k ? 'Ububiko' : 'On inventory',
        title: k ? 'Kureba idaraja' : 'Read-only levels',
        metrics: [
          { label: k ? 'SKU' : 'SKUs visible', value: stock.length },
          { label: k ? 'Hasi ya min' : 'Below minimum', value: lowStock },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['approvals', 'invoices', 'dashboard']),
        actions: [{ segment: 'approvals', label: k ? 'Isuzuma' : 'Jump to approvals', variant: 'primary' }],
        tip: k
          ? 'Koresha iki nkaho kugira ngo usuzume mbere yo kwemera ibindi bisabwa.'
          : 'Use visibility to sanity-check stock before approving large requisitions.',
      };
    }
    if (segment === 'approvals') {
      return {
        eyebrow: k ? 'Isuzuma' : 'On approvals',
        title: k ? 'Guhitamo' : 'Decision queue',
        metrics: [
          { label: k ? 'Zitegereje' : 'Submitted', value: submitted },
          { label: k ? 'Zifunguye' : 'All open', value: openReqs },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['invoices', 'visibility', 'messages']),
        actions: [{ segment: 'invoices', label: k ? 'Kureba' : 'Monitoring view', variant: 'ghost' }],
        tip: k
          ? 'Andika impamvu mu makuru yawe kugira ngo umutangabuhamya uri buhoro.'
          : 'Leave a supervisor note—clerks and suppliers see it downstream.',
      };
    }
    if (segment === 'invoices') {
      return {
        eyebrow: k ? 'Kureba' : 'On monitoring',
        title: k ? 'Inzira y\'inyemezabuguzi' : 'Invoice pipeline',
        metrics: [
          { label: k ? 'Zifite proforma' : 'Proforma stage', value: invProformaRecv + invProformaOk },
          { label: k ? 'Zishyuwe' : 'Paid / dispatch', value: invPaid },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['approvals', 'reports', 'dashboard']),
        actions: [],
        tip: k
          ? 'Reba uko amafaranga ahagaze atagomba kuba ahari.'
          : 'Watch for stuck proformas—nudge finance if a supplier is waiting too long.',
      };
    }
    if (segment === 'reports') {
      return {
        eyebrow: k ? 'Raporo' : 'On reports',
        title: k ? 'Imiterere y\'ikigo' : 'Operational read',
        metrics: [
          { label: k ? 'Isaba' : 'Requisitions', value: reqs.length },
          { label: k ? 'Zarangiye' : 'Closed', value: reqs.filter((r) => r.status === 'closed').length },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['dashboard', 'approvals', 'messages']),
        actions: [],
        tip: k
          ? 'Gereranya raporo n\'ibyo ubona mu bubiko.'
          : 'Cross-check report totals with inventory visibility for leadership reviews.',
      };
    }
    if (segment === 'messages') {
      return {
        eyebrow: k ? 'Ubutumwa' : 'On messages',
        title: k ? 'Amakuru y\'ikigo' : 'Desk comms',
        metrics: [
          { label: k ? 'Ubutumwa' : 'Threads', value: messageCount },
          { label: k ? 'Amatangazo' : 'Alerts', value: notificationCount },
        ],
        notify: msgNotify,
        shortcuts: pickShortcuts(role, ['approvals', 'dashboard']),
        actions: [],
        tip: k
          ? 'Inzira: Biganiro → Ububiko → Amatangazo → Abantu.'
          : 'Flow: Conversations → Repository → Notifications → Directory.',
      };
    }
    return {
      eyebrow: k ? 'Urupapuro' : 'Supervisor page',
      title: k ? 'Isuzuma' : 'Operations helper',
      metrics: [
        { label: k ? 'Zitegereje' : 'Needs approval', value: submitted },
        { label: k ? 'Zifunguye' : 'Open workflows', value: openReqs },
      ],
      notify: defaultNotify,
      shortcuts: pickShortcuts(role, ['dashboard', 'approvals', 'visibility', 'messages']),
      actions: [{ segment: 'approvals', label: k ? 'Isuzuma' : 'Approvals', variant: 'primary' }],
      tip: k
        ? 'Imbonerahamwe igufasha kureba uko urucometso ruhora mu nzira.'
        : 'Dashboard plus approvals cover most daily supervisor loops.',
    };
  }

  /** Accountant */
  if (role === 'accountant') {
    if (segment === 'dashboard') {
      return {
        eyebrow: k ? 'Incamake' : 'On dashboard',
        title: k ? 'Imari n\'inyemezabuguzi' : 'Finance cockpit',
        metrics: [
          { label: k ? 'Proforma' : 'Proformas to review', value: invProformaRecv },
          { label: k ? 'Zemejwe' : 'Approved · pay next', value: invProformaOk },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['invoices', 'payments', 'approvals']),
        actions: [{ segment: 'invoices', label: k ? 'Inyemezabuguzi' : 'Invoice desk', variant: 'primary' }],
        tip: k
          ? 'Tangira ku proforma zigeze vuba kugira ngo ubucometso bw’ubucuruzi burusheho.'
          : 'Clear the oldest proformas first to unblock supplier fulfilment.',
      };
    }
    if (segment === 'approvals') {
      return {
        eyebrow: k ? 'Isaba' : 'On pending requests',
        title: k ? 'Mbere y’inyemezabuguzi' : 'Pre-invoice gate',
        metrics: [
          { label: k ? 'Zitegereje' : 'Submitted reqs', value: submitted },
          { label: k ? 'Ku bisabwa' : 'Open workflows', value: openReqs },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['invoices', 'payments', 'dashboard']),
        actions: [{ segment: 'invoices', label: k ? 'Inyemezabuguzi' : 'Open invoices', variant: 'primary' }],
        tip: k
          ? 'Reba ko isaba ryemejwe na supaviseri mbere yo kwemeza kwishyura.'
          : 'Confirm supervisor approval is on record before releasing funds.',
      };
    }
    if (segment === 'invoices') {
      return {
        eyebrow: k ? 'Inyemezabuguzi' : 'On invoices',
        title: k ? 'Isuzuma rya proforma' : 'Proforma review',
        metrics: [
          { label: k ? 'Zitegereje' : 'Awaiting decision', value: invProformaRecv },
          { label: k ? 'Zemejwe' : 'Approved queue', value: invProformaOk },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['payments', 'reports', 'messages']),
        actions: [{ segment: 'payments', label: k ? 'Kwishyura' : 'Payment run', variant: 'primary' }],
        tip: k
          ? 'Kana na makuru—abagenerwabikorwa babona impamvu mu rubuga rwabo.'
          : 'Reject with a note so suppliers can revise without a brand-new requisition.',
      };
    }
    if (segment === 'payments') {
      return {
        eyebrow: k ? 'Kwishyura' : 'On payments',
        title: k ? 'Kohereza amafaranga' : 'Release funds',
        metrics: [
          { label: k ? 'Zitegereje kwishyura' : 'Ready to pay', value: invProformaOk },
          { label: k ? 'Zishyuwe' : 'Marked paid', value: invs.filter((i) => i.status === 'paid' || i.status === 'closed').length },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['invoices', 'reports', 'dashboard']),
        actions: [{ segment: 'invoices', label: k ? 'Inyemezabuguzi' : 'Back to invoices', variant: 'ghost' }],
        tip: k
          ? 'Nyuma yo kwishyura, umutanga serivisi ahabwa itangazo ryo kohereza inyandiko.'
          : 'After pay, suppliers get a signal to upload delivery and final invoice.',
      };
    }
    if (segment === 'reports') {
      return {
        eyebrow: k ? 'Raporo' : 'On supplier transactions',
        title: k ? 'Imiturire' : 'Ledger-style view',
        metrics: [
          { label: k ? 'Inyemezabuguzi' : 'Invoices', value: invs.length },
          { label: k ? 'Zarangiye' : 'Closed', value: invs.filter((i) => i.status === 'closed').length },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['payments', 'invoices', 'messages']),
        actions: [],
        tip: k
          ? 'Gereranya amafaranga yishyuwe n’ibisabwa byarangiye.'
          : 'Match paid totals to closed requisitions for audit readiness.',
      };
    }
    if (segment === 'messages') {
      return {
        eyebrow: k ? 'Ubutumwa' : 'On messages',
        title: k ? 'Imari & abatanga serivisi' : 'Finance inbox',
        metrics: [
          { label: k ? 'Ubutumwa' : 'Threads', value: messageCount },
          { label: k ? 'Amatangazo' : 'Alerts', value: notificationCount },
        ],
        notify: msgNotify,
        shortcuts: pickShortcuts(role, ['invoices', 'payments']),
        actions: [],
        tip: k
          ? 'Inzira: Biganiro → Ububiko → Amatangazo → Abantu.'
          : 'Conversations for supplier threads; Repository for PDFs; Notifications for payment signals.',
      };
    }
    return {
      eyebrow: k ? 'Urupapuro' : 'Finance page',
      title: k ? 'Imari' : 'Finance helper',
      metrics: [
        { label: k ? 'Proforma' : 'Proformas to review', value: invProformaRecv },
        { label: k ? 'Zemejwe' : 'Approved · pay next', value: invProformaOk },
      ],
      notify: defaultNotify,
      shortcuts: pickShortcuts(role, ['dashboard', 'invoices', 'payments', 'messages']),
      actions: [{ segment: 'invoices', label: k ? 'Inyemezabuguzi' : 'Invoices', variant: 'primary' }],
      tip: k
        ? 'Imari ikurikira inzira: isuzuma → kwishyura → gusohoka.'
        : 'Follow the rail: review → pay → let suppliers close documents.',
    };
  }

  /** Admin */
  if (role === 'admin') {
    const critNotes = portalState.notifications?.filter((n) => n.severity === 'bad' && n.role === 'admin').length ?? 0;

    if (segment === 'dashboard') {
      return {
        eyebrow: k ? 'Incamake' : 'On dashboard',
        title: k ? 'Ubuyobozi' : 'Executive pulse',
        metrics: [
          { label: k ? 'Abakoresha' : 'Users', value: users.length },
          { label: k ? 'Akazi gafunguye' : 'Open workflows', value: openReqs },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['users', 'reports', 'activity']),
        actions: [{ segment: 'users', label: k ? 'Abakoresha' : 'User management', variant: 'primary' }],
        tip: k
          ? 'Reba imibare y’ingenzi mbere yo guhindura imiterere.'
          : 'Scan KPIs before changing limits in company settings.',
      };
    }
    if (segment === 'users') {
      return {
        eyebrow: k ? 'Abakoresha' : 'On users',
        title: k ? 'Kwinjiza no gukoresha' : 'Provisioning',
        metrics: [
          { label: k ? 'Bose' : 'Total seats', value: users.length },
          { label: k ? 'Limit' : 'Plan limit', value: company?.usersLimit ?? '—' },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['rbac', 'settings', 'activity']),
        actions: [{ segment: 'rbac', label: k ? 'Uruhare' : 'Roles & access', variant: 'ghost' }],
        tip: k
          ? 'Emeza imeri mbere yo gutanga uruhare rwa supaviseri cyangwa umutunzi.'
          : 'Invite with the correct role—downstream workflows depend on it.',
      };
    }
    if (segment === 'rbac') {
      const roleKinds = new Set((users || []).map((u) => u.role).filter(Boolean)).size;
      return {
        eyebrow: k ? 'Uruhare' : 'On roles & access',
        title: k ? 'Urukurikirane rwa RBAC' : 'Permission map',
        metrics: [
          { label: k ? 'Uruhare rusange' : 'Roles in use', value: roleKinds },
          { label: k ? 'Abakoresha' : 'Users', value: users.length },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['users', 'settings', 'help']),
        actions: [{ segment: 'users', label: k ? 'Abakoresha' : 'Manage users', variant: 'primary' }],
        tip: k
          ? 'Koresha iyi shusho mu biganiro n’abigenzura.'
          : 'Export this mental model for auditors—each cell is intentional.',
      };
    }
    if (segment === 'settings') {
      return {
        eyebrow: k ? 'Amagenamiterere' : 'On settings',
        title: k ? 'Imiterere y’ikigo' : 'Tenant controls',
        metrics: [
          { label: k ? 'Izina ry’ikigo' : 'Company', value: company?.name?.slice(0, 12) || '—' },
          { label: k ? 'Ifaranga' : 'Currency', value: company?.currency || '—' },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['users', 'reports', 'activity']),
        actions: [{ segment: 'activity', label: k ? 'Amatangazo' : 'Notifications center', variant: 'primary' }],
        tip: k
          ? 'Bika impinduka—hagarika ibisanzwe niba utarakwemeza.'
          : 'Save company defaults after dry runs—thresholds affect clerk nudges.',
      };
    }
    if (segment === 'reports') {
      return {
        eyebrow: k ? 'Raporo' : 'On reports',
        title: k ? 'Isesengura' : 'Analytics board',
        metrics: [
          { label: k ? 'Isaba' : 'Requisitions', value: reqs.length },
          { label: k ? 'Inyemezabuguzi' : 'Invoices', value: invs.length },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['dashboard', 'activity', 'users']),
        actions: [],
        tip: k
          ? 'Gereranya n’amakuru avuye mu bubiko n’ubw’abakoresha.'
          : 'Pair quantitative tiles with qualitative alerts from the notifications center.',
      };
    }
    if (segment === 'activity') {
      return {
        eyebrow: k ? 'Amatangazo' : 'On notifications',
        title: k ? 'Gucunga ibyago' : 'Alert triage',
        metrics: [
          { label: k ? 'Amatangazo' : 'Admin notes', value: portalState.notifications?.filter((n) => n.role === 'admin').length ?? 0 },
          { label: k ? 'Bikomeye' : 'Critical-ish', value: critNotes },
        ],
        notify: {
          kind: 'spark',
          title: k ? 'Imiterere' : 'Triage tip',
          meta: k
            ? 'Tangira ku bikomeye, hanyuma usukure amakuru.'
            : 'Filter Critical first, then clear informational noise after stand-up.',
        },
        shortcuts: pickShortcuts(role, ['settings', 'users', 'help']),
        actions: [{ segment: 'reports', label: k ? 'Raporo' : 'Open reports', variant: 'ghost' }],
        tip: k
          ? 'Koresha AI insights kugira ngo uhindure ibikorwa bya buri munsi.'
          : 'AI insight cards summarise velocity—pair them with manual spot checks.',
      };
    }
    if (segment === 'messages') {
      return {
        eyebrow: k ? 'Ubutumwa' : 'On messages',
        title: k ? 'Itumanaho' : 'Communications hub',
        metrics: [
          { label: k ? 'Ubutumwa' : 'Portal threads', value: messageCount },
          { label: k ? 'Amatangazo' : 'Alerts', value: notificationCount },
        ],
        notify: msgNotify,
        shortcuts: pickShortcuts(role, ['activity', 'users', 'reports', 'settings']),
        actions: [{ segment: 'activity', label: k ? 'Amatangazo' : 'Notifications center', variant: 'ghost' }],
        tip: k
          ? 'Tangira ku biganiro, hanyuma ukoresha ububiko bw’idosiye.'
          : 'Start in Conversations, then use Digital repository for shared files—Notifications aggregates system signals.',
      };
    }
    if (segment === 'help') {
      return {
        eyebrow: k ? 'Ubufasha' : 'On help',
        title: k ? 'Inkunga & amakuru' : 'Guidance hub',
        metrics: [
          { label: k ? 'Verisiyo' : 'Portal version', value: portalState.version ?? '—' },
          { label: k ? 'Abakoresha' : 'Users', value: users.length },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['users', 'settings', 'activity']),
        actions: [{ segment: 'users', label: k ? 'Abakoresha' : 'Invite flow', variant: 'primary' }],
        tip: k
          ? 'Koresha ifishi ya FAQ kugira ngo wongere ubumenyi bw’ikoresha.'
          : 'Search help articles—shortcuts deep-link into each admin surface.',
      };
    }
    return {
      eyebrow: k ? 'Urupapuro' : 'Admin page',
      title: k ? 'Ubuyobozi' : 'Admin helper',
      metrics: [
        { label: k ? 'Abakoresha' : 'Users', value: users.length },
        { label: k ? 'Akazi gafunguye' : 'Open workflows', value: openReqs },
      ],
      notify: defaultNotify,
      shortcuts: pickShortcuts(role, ['dashboard', 'users', 'activity', 'settings']),
      actions: [{ segment: 'dashboard', label: k ? 'Imbonerahamwe' : 'Dashboard', variant: 'primary' }],
      tip: k
        ? 'Reba amatangazo n’abakoresha buri gihe ugerageza impinduka.'
        : 'Check notifications and users whenever you change tenant settings.',
    };
  }

  /** Supplier */
  if (role === 'supplier') {
    const mineR = (r) => !r.supplierId || r.supplierId === actor;
    const rMine = reqs.filter(mineR);
    const iMine = invs.filter((i) => !i.supplierId || i.supplierId === actor);
    const awaiting = rMine.filter((r) => r.status === 'sentToSupplier').length;
    const finance = iMine.filter((i) => i.status === 'proformaReceived').length;
    const approved = iMine.filter((i) => i.status === 'proformaApproved').length;
    const rejected = iMine.filter((i) => i.status === 'rejected').length;
    const paidStage = iMine.filter((i) => ['paid', 'deliveryNoteAttached'].includes(i.status)).length;
    const closed = iMine.filter((i) => i.status === 'closed').length;

    if (segment === 'dashboard') {
      return {
        eyebrow: k ? 'Incamake' : 'On dashboard',
        title: k ? 'Urukurikirane rw’ubucuruzi' : 'Order rail',
        metrics: [
          { label: k ? 'Proforma' : 'Awaiting proforma', value: awaiting },
          { label: k ? 'Imari' : 'With finance', value: finance },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['inbox', 'approved-proforma', 'documents']),
        actions: [{ segment: 'inbox', label: k ? 'Inbox' : 'Open inbox', variant: 'primary' }],
        tip: k
          ? 'Imbere yo kwishyura, tegura inyandiko zawe za proforma.'
          : 'Keep proforma filenames consistent—finance matches them to requisitions.',
      };
    }
    if (segment === 'inbox') {
      return {
        eyebrow: k ? 'Inbox' : 'On inbox',
        title: k ? 'Ibysabwe' : 'Supplier requests',
        metrics: [
          { label: k ? 'Zitegereje' : 'Need proforma', value: awaiting },
          { label: k ? 'Zisuzumwa' : 'Submitted to finance', value: finance },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['approved-proforma', 'rejected-proforma', 'documents']),
        actions: [
          { segment: 'approved-proforma', label: k ? 'Zemejwe' : 'Approved list', variant: 'ghost' },
          { segment: 'documents', label: k ? 'Inyandiko' : 'After pay · docs', variant: 'primary' },
        ],
        tip: k
          ? 'Ohereza indangakintu, agaciro, n’idosiye imburira rimwe.'
          : 'Reference + amount + attachment are required before Send proforma succeeds.',
      };
    }
    if (segment === 'approved-proforma') {
      return {
        eyebrow: k ? 'Zemejwe' : 'On approved proformas',
        title: k ? 'Tegeza kwishyura' : 'Awaiting payment',
        metrics: [
          { label: k ? 'Zemejwe' : 'Approved', value: approved },
          { label: k ? 'Byishyuwe' : 'Paid / dispatch', value: paidStage },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['inbox', 'documents', 'products']),
        actions: [{ segment: 'documents', label: k ? 'Inyandiko' : 'Upload delivery docs', variant: 'primary' }],
        tip: k
          ? 'Ntukohereze inyandiko z’urubanza kugeza imari itarakwemeza.'
          : 'Do not dispatch official invoices until payment is marked in the portal.',
      };
    }
    if (segment === 'rejected-proforma') {
      return {
        eyebrow: k ? 'Zakinzwe' : 'On rejected',
        title: k ? 'Subiramo' : 'Revise & resend',
        metrics: [
          { label: k ? 'Zakinzwe' : 'Rejected files', value: rejected },
          { label: k ? 'Inbox' : 'Open orders', value: awaiting + finance },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['inbox', 'messages', 'dashboard']),
        actions: [{ segment: 'inbox', label: k ? 'Inbox' : 'Back to inbox', variant: 'primary' }],
        tip: k
          ? 'Soma impamvu mu makuru—hindura agaciro cyangwa dosiye.'
          : 'Read finance notes carefully—often it is tariff or VAT alignment.',
      };
    }
    if (segment === 'documents') {
      return {
        eyebrow: k ? 'Inyandiko' : 'On delivery & invoice',
        title: k ? 'Imibare y’urubanza' : 'Proof then official invoice',
        metrics: [
          { label: k ? 'Byishyuwe' : 'Paid · attach docs', value: paidStage },
          { label: k ? 'Zarangiye' : 'Closed cycles', value: closed },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['delivery', 'payments', 'products', 'inbox']),
        actions: [
          { segment: 'delivery', label: k ? 'Kohereza' : 'Delivery', variant: 'ghost' },
          { segment: 'payments', label: k ? 'Kwishyura' : 'Payments', variant: 'ghost' },
        ],
        tip: k
          ? 'Banza delivery note, hanyuma inyemezabuguzi ya nyuma.'
          : 'Delivery note first, official tax invoice second—closes the audit loop.',
      };
    }
    if (segment === 'delivery') {
      const pendingPaid = iMine.filter((i) => i.status === 'paid').length;
      const withDeliveryNote = iMine.filter((i) => i.deliveryNoteUrl || i.status === 'deliveryNoteAttached').length;
      return {
        eyebrow: k ? 'Ibikorwa' : 'On delivery',
        title: k ? 'Kwemeza kohereza' : 'Delivery confirmation',
        metrics: [
          { label: k ? 'Zitegereje' : 'Pending delivery', value: pendingPaid },
          { label: k ? 'Inyandiko zashyizweho' : 'Delivery notes filed', value: withDeliveryNote },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['documents', 'payments', 'products', 'inbox']),
        actions: [{ segment: 'documents', label: k ? 'Inyandiko' : 'Attach documents', variant: 'primary' }],
        tip: k
          ? 'Andika inyandiko z’urubanza hanyuma wemeze kugira ngo imari ibone ingingo.'
          : 'Add delivery notes, then confirm so finance sees proof before the final invoice.',
      };
    }
    if (segment === 'product-edit') {
      const myListings =
        portalState.supplierCatalog?.filter((c) => !c.supplierId || c.supplierId === actor).length ?? 0;
      return {
        eyebrow: k ? 'Ibicuruzwa' : 'On products',
        title: k ? 'Guhindura ibicuruzwa' : 'Edit listing',
        metrics: [
          { label: k ? 'Ibicuruzwa byawe' : 'Your listings', value: myListings },
          { label: k ? 'Inyemezabuguzi' : 'Tracked invoices', value: iMine.length },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['products', 'delivery', 'payments', 'dashboard']),
        actions: [{ segment: 'products', label: k ? 'Subira ku bikusanyije' : 'Back to inventory', variant: 'primary' }],
        tip: k
          ? 'Bika inyandiko n’ibiciro mbere yo kohereza kugira ngo Curator ashyireho inama.'
          : 'Save copy and pricing before publishing—Curator tips react to category demand signals.',
      };
    }
    if (segment === 'products') {
      const listings = portalState.supplierCatalog?.length ?? 0;
      return {
        eyebrow: k ? 'Ibicuruzwa' : 'On products',
        title: k ? 'Ububiko bw’ibicuruzwa' : 'Product inventory',
        metrics: [
          { label: k ? 'Ibicuruzwa' : 'Listings', value: String(listings) },
          { label: k ? 'Inyemezabuguzi' : 'Your invoices', value: iMine.length },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['documents', 'delivery', 'payments', 'dashboard']),
        actions: [{ segment: 'product-edit', label: k ? 'Ongeraho' : 'Add product', variant: 'primary' }],
        tip: k
          ? 'Hindura ibiciro n’ububiko kugira ngo ubashe gukurikirana ibyifuzo by’ibitaro.'
          : 'Adjust pricing and stock levels so requisitions and the ledger stay accurate.',
      };
    }
    if (segment === 'payments') {
      const pendingPayout = iMine
        .filter((i) => ['proformaReceived', 'proformaApproved'].includes(i.status))
        .reduce((s, i) => s + Number(i.amount || 0), 0);
      const cur = company?.currency || 'RWF';
      const payoutLabel = `${pendingPayout.toLocaleString()} ${cur}`;
      return {
        eyebrow: k ? 'Kwishyura' : 'On payments',
        title: k ? 'Amafaranga' : 'Payment ledger',
        metrics: [
          { label: k ? 'Ayakiriye kwishyurwa' : 'Pending payouts', value: payoutLabel },
          { label: k ? 'Inyemezabuguzi' : 'Invoices tracked', value: iMine.length },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['products', 'delivery', 'documents', 'dashboard']),
        actions: [{ segment: 'messages', label: k ? 'Ubutumwa' : 'Finance messages', variant: 'primary' }],
        tip: k
          ? 'Gerageza Mobile Money kugira ngo uhabwe vuba.'
          : 'Compare pending approvals to settled rows—Mobile Money often clears ahead of card batches.',
      };
    }
    if (segment === 'messages') {
      return {
        eyebrow: k ? 'Ubutumwa' : 'On messages',
        title: k ? 'Imari n’ikigo' : 'Finance + facility',
        metrics: [
          { label: k ? 'Ubutumwa' : 'Threads', value: messageCount },
          { label: k ? 'Amatangazo' : 'Alerts', value: notificationCount },
        ],
        notify: msgNotify,
        shortcuts: pickShortcuts(role, ['inbox', 'documents', 'payments', 'dashboard']),
        actions: [],
        tip: k
          ? 'Reba hano ubutumwa bw’imari bw’ibanze ku kwishyura.'
          : 'Payment released notices arrive here—jump straight to documents.',
      };
    }
    if (segment === 'settings') {
      return {
        eyebrow: k ? 'Igenamiterere' : 'On settings',
        title: k ? 'Konti y’umutunzi' : 'Partner account',
        metrics: [
          { label: k ? 'Ikigo' : 'Tenant', value: company?.name?.slice(0, 14) || '—' },
          { label: k ? 'Ifaranga' : 'Currency', value: company?.currency || '—' },
        ],
        notify: defaultNotify,
        shortcuts: pickShortcuts(role, ['dashboard', 'inbox', 'messages']),
        actions: [{ segment: 'documents', label: k ? 'Inyandiko' : 'Document standards', variant: 'primary' }],
        tip: k
          ? 'Imbaruta z’imari zikeneye izina ryihariye ku dosiye.'
          : 'Use filenames your finance counterpart expects on PDF attachments.',
      };
    }
    return {
      eyebrow: k ? 'Urupapuro' : 'Supplier page',
      title: k ? 'Umutunzi' : 'Supply helper',
      metrics: [
        { label: k ? 'Proforma' : 'Awaiting proforma', value: awaiting },
        { label: k ? 'Imari' : 'With finance', value: finance },
      ],
      notify: defaultNotify,
      shortcuts: pickShortcuts(role, ['dashboard', 'inbox', 'documents', 'products', 'delivery', 'payments']),
      actions: [{ segment: 'inbox', label: k ? 'Inbox' : 'Orders inbox', variant: 'primary' }],
      tip: k
        ? 'Inzira ni: proforma → kwemera → kwishyura → inyandiko.'
        : 'Your rail is proforma → approval → pay → delivery & official invoice.',
    };
  }

  /** Fallback */
  return {
    eyebrow: k ? 'Incamake' : 'Quick glance',
    title: (typeof t === 'function' ? t(`roles.${role}`) : null) || ROLE_LABELS[role] || 'Workspace',
    metrics: [
      { label: k ? 'Isaba' : 'Requisitions', value: reqs.length },
      { label: k ? 'Inyemezabuguzi' : 'Invoices', value: invs.length },
    ],
    notify: defaultNotify,
    shortcuts: pickShortcuts(
      role,
      (NAV_BY_ROLE[role] || []).map((i) => i.segment).filter((s) => s !== 'dashboard')
    ).slice(0, 5),
    actions: [],
    tip: k
      ? 'Reba amakuru avuye ku murima w’ububiko n’isaba.'
      : 'Figures reflect the loaded workspace snapshot (stock, requisitions, invoices).',
  };
}
