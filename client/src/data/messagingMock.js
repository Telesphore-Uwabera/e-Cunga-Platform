/**
 * Rich mock data for the internal messaging hub (all roles except supplier).
 * Threads, attachments, and directory are static demos aligned to the design spec.
 */

const sharedAttachments = [
  { id: 'att_1', name: 'INV-2026-002.pdf', type: 'doc', date: '2026-03-28', size: '240 KB' },
  { id: 'att_2', name: 'REQ-2841_pack.zip', type: 'project', date: '2026-03-27', size: '1.2 MB' },
  { id: 'att_3', name: 'Cold_chain_photo.jpg', type: 'image', date: '2026-03-26', size: '890 KB' },
  { id: 'att_4', name: 'Quarterly_recon.xlsx', type: 'doc', date: '2026-03-25', size: '412 KB' },
  { id: 'att_5', name: 'Delivery_map.png', type: 'image', date: '2026-03-24', size: '320 KB' },
  { id: 'att_6', name: 'Vendor_master_list.pdf', type: 'doc', date: '2026-03-22', size: '180 KB' },
];

function thread(id, peerName, peerTitle, online, lastTime, snippet, messages, sharedFiles, sharedLinks) {
  return {
    id,
    peerName,
    peerTitle,
    online,
    lastTime,
    snippet,
    messages,
    sharedFiles: sharedFiles || [],
    sharedLinks: sharedLinks || [],
  };
}

const clerkThreads = [
  thread(
    'ct_1',
    'Elena Vanev',
    'Supervisor · Approvals',
    true,
    '10:42',
    'Please attach ward allocation notes before I release to supplier.',
    [
      { id: 'm1', side: 'them', text: 'Can you confirm disinfectant counts for Gasabo vs Kicukiro?', time: '10:38' },
      { id: 'm2', side: 'me', text: 'Gasabo 30 bottles, Kicukiro 20 — updated in the requisition comment.', time: '10:40' },
      { id: 'm3', side: 'them', text: 'Perfect. Please attach ward allocation notes before I release to supplier.', time: '10:42' },
    ],
    [sharedAttachments[0], sharedAttachments[2]],
    [{ label: 'REQ-2841', href: '#' }]
  ),
  thread(
    'ct_2',
    'Nikolas Chen',
    'Finance liaison',
    false,
    'Yesterday',
    'We need the delivery note scan for the theatre pack.',
    [
      { id: 'm4', side: 'them', text: 'Theatre consumables batch — do you have the signed handoff?', time: 'Yesterday' },
      { id: 'm5', side: 'me', text: 'Uploading the scan now; it is on the loading dock tablet.', time: 'Yesterday' },
    ],
    [sharedAttachments[3]],
    []
  ),
  thread(
    'ct_3',
    'Logistics Bot',
    'System',
    false,
    'Mon',
    'Shipment SHP-2026-4412 ETA revised to Thu 14:00.',
    [{ id: 'm6', side: 'system', text: 'Shipment SHP-2026-4412 is 2 days behind. Revised ETA: Thursday 14:00 (Kigali).', time: 'Mon' }],
    [],
    [{ label: 'Track shipment', href: '#' }]
  ),
];

const supervisorThreads = [
  thread(
    'st_1',
    'Didier Nsengiyumva',
    'Inventory clerk · Gasabo',
    true,
    '09:18',
    'Cold chain box still below min — can we fast-track supplier release?',
    [
      { id: 's1', side: 'them', text: 'Cold chain vaccine box is still below minimum in Warehouse B.', time: '09:05' },
      { id: 's2', side: 'me', text: 'I approved the emergency line; finance should see it in the next queue.', time: '09:18' },
    ],
    [sharedAttachments[2], sharedAttachments[1]],
    [{ label: 'REQ cold chain', href: '#' }]
  ),
  thread(
    'st_2',
    'Claudine Mukeshimana',
    'Accountant',
    true,
    '08:55',
    'Need your sign-off comment on the lubricant escalation.',
    [
      { id: 's3', side: 'them', text: 'Lubricant requisition — engineering escalation needs your supervisor note.', time: '08:50' },
      { id: 's4', side: 'me', text: 'Added approval comment with maintenance ticket ref MT-9921.', time: '08:55' },
    ],
    [sharedAttachments[0]],
    []
  ),
  thread(
    'st_3',
    'Marija Pher',
    'Regional procurement',
    false,
    'Sun',
    'Weekly digest: 4 open, 2 critical.',
    [{ id: 's5', side: 'them', text: 'Weekly digest attached — prioritise Gasabo sanitation lines first.', time: 'Sun' }],
    [sharedAttachments[5]],
    []
  ),
];

const accountantThreads = [
  thread(
    'at_1',
    'Apex Manufacturing',
    'Supplier',
    true,
    '09:12',
    'Please confirm whether the revised settlement can still run today.',
    [
      { id: 'a1', side: 'them', text: 'We uploaded the corrected banking letter and revised shipping surcharge for PO-2841.', time: '08:45' },
      { id: 'a2', side: 'me', text: 'Received. Reviewing revised total against the approved batch before release.', time: '08:58' },
      { id: 'a3', side: 'them', text: 'Please confirm whether the revised settlement can still run in today’s cycle.', time: '09:12' },
    ],
    [sharedAttachments[0], sharedAttachments[3]],
    [{ label: 'PO-2841', href: '#' }]
  ),
  thread(
    'at_2',
    'Supervisor desk',
    'Internal',
    false,
    '08:30',
    'Priority review for lubricant requisition before 14:00.',
    [
      { id: 'a4', side: 'them', text: 'Please prioritise lubricant requisition — engineering needs confirmation before 14:00.', time: '08:30' },
      { id: 'a5', side: 'me', text: 'Validating vendor rate against rolling average before final sign-off.', time: '08:42' },
    ],
    [],
    []
  ),
  thread(
    'at_3',
    'Audit Office',
    'Internal audit',
    false,
    'Yesterday',
    'Quarter-close: delivery notes for last three closed batches.',
    [
      { id: 'a6', side: 'them', text: 'Please share delivery notes and approval comments for the last three closed vendor batches.', time: 'Yesterday' },
      { id: 'a7', side: 'me', text: 'Files compiled — will attach batch references with the payment trail.', time: 'Yesterday' },
    ],
    [sharedAttachments[4]],
    []
  ),
];

const adminThreads = [
  thread(
    'adt_1',
    'Security desk',
    'IAM',
    true,
    '11:02',
    'Kyiv login attempt cleared — enable MFA reminder for admin seats?',
    [
      { id: 'd1', side: 'them', text: 'Unauthorized login attempt from Kyiv flagged — was this you?', time: '10:58' },
      { id: 'd2', side: 'me', text: 'Not me — rotated session. Please enforce MFA on all admin accounts.', time: '11:02' },
    ],
    [],
    [{ label: 'Audit log', href: '#' }]
  ),
  thread(
    'adt_2',
    'Aline Uwimana',
    'Operations lead',
    false,
    'Yesterday',
    'User limit vs active seats — need decision before billing sync.',
    [
      { id: 'd3', side: 'them', text: 'We are at 9/10 seats — should we block invites or upgrade plan?', time: 'Yesterday' },
      { id: 'd4', side: 'me', text: 'Hold invites until Q2 budget sign-off — document in settings note.', time: 'Yesterday' },
    ],
    [sharedAttachments[5]],
    []
  ),
  thread(
    'adt_3',
    'Curator',
    'AI assistant',
    false,
    'Mon',
    'Digest: 3 open requisitions, 1 paid, 2 SKUs need restock attention.',
    [{ id: 'd5', side: 'system', text: 'Weekly executive digest: 3 requisitions open, 1 paid, 2 items below threshold.', time: 'Mon' }],
    [],
    []
  ),
];

const THREADS_BY_ROLE = {
  clerk: clerkThreads,
  supervisor: supervisorThreads,
  accountant: accountantThreads,
  admin: adminThreads,
};

export function getPortalThreads(role) {
  return THREADS_BY_ROLE[role] || clerkThreads;
}

export function getPortalAttachments() {
  return sharedAttachments;
}

export const DIRECTORY = {
  supervisors: [
    { id: 'dir_s1', name: 'Dina Sahagun', role: 'Lead supervisor', initials: 'DS' },
    { id: 'dir_s2', name: 'Marius Treve', role: 'Night operations', initials: 'MT' },
  ],
  clerks: [
    { id: 'dir_c1', name: 'Didier Nsengiyumva', role: 'Clerk · Gasabo', initials: 'DN' },
    { id: 'dir_c2', name: 'Josiane Mukamana', role: 'Clerk · Kicukiro', initials: 'JM' },
  ],
  accountants: [
    { id: 'dir_a1', name: 'Claudine Mukeshimana', role: 'Senior accountant', initials: 'CM' },
    { id: 'dir_a2', name: 'Eric Habimana', role: 'Payables', initials: 'EH' },
  ],
  suppliers: [
    { id: 'dir_v1', name: 'MediSupply Rwanda', role: 'Medical consumables', initials: 'MR' },
    { id: 'dir_v2', name: 'Galan Logistics Co.', role: 'Freight partner', initials: 'GL' },
  ],
};
