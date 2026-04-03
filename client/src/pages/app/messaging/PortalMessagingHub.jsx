import { useCallback, useEffect, useMemo, useState } from 'react';
import ListPageControls from '../../../components/ListPageControls.jsx';
import { usePagedList } from '../../../hooks/usePagedList.js';
import { messagesForRole, notificationsForRole, usePortalData } from '../../../context/PortalStateContext.jsx';
import { useAuth } from '../../../context/AuthContext.jsx';
import { usePortalChat } from '../../../hooks/usePortalChat.js';
import { apiFetch } from '../../../api/client.js';
import { DIRECTORY, getPortalAttachments, getPortalThreads } from '../../../data/messagingMock.js';
import LiveMessagingPanel from './LiveMessagingPanel.jsx';
import styles from './PortalMessagingHub.module.css';

const ROLE_COPY = {
  clerk: {
    eyebrow: 'Communications',
    title: 'Messages & alerts',
    lead: 'Coordinate with supervisors and finance, review system notices, and share files without leaving the inventory workspace.',
  },
  supervisor: {
    eyebrow: 'Communications',
    title: 'Desk messaging',
    lead: 'Align clerks and finance after approvals, track shared documents, and respond to escalations in one thread.',
  },
  accountant: {
    eyebrow: 'Communications',
    title: 'Finance messages',
    lead: 'Clarify proformas with suppliers, close audit loops, and keep payment context next to every conversation.',
  },
  admin: {
    eyebrow: 'Communications',
    title: 'Admin messaging',
    lead: 'Security notices, tenant decisions, and leadership threads—centralised next to reports and user management.',
  },
};

function initialsFrom(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
}

const DIRECTORY_RECIPIENT_ROLE = {
  supervisors: 'supervisor',
  clerks: 'clerk',
  accountants: 'accountant',
  suppliers: 'supplier',
};

function PaginatedDirectoryBlock({
  label,
  entries,
  compact,
  supplier,
  dirQuery,
  directoryKey,
  onOpenChatForRole,
  onOpenChatUser,
}) {
  const pager = usePagedList(entries, { resetKey: `${label}|${dirQuery}|${entries.length}` });
  const recipientRole = DIRECTORY_RECIPIENT_ROLE[directoryKey];
  if (!entries.length) return null;
  function handleOpen(person) {
    if (onOpenChatUser) {
      onOpenChatUser(person.id);
      return;
    }
    if (recipientRole) onOpenChatForRole?.(recipientRole);
  }
  return (
    <section className={styles.dirSection}>
      <h2 className={styles.dirHeading}>{label}</h2>
      <div className={styles.dirGrid}>
        {pager.pageSlice.map((person) => (
          <article key={person.id} className={compact ? styles.dirCardCompact : styles.dirCard}>
            <span className={styles.avatar}>{person.initials}</span>
            <div className={styles.dirBody}>
              <p className={styles.dirName}>{person.name}</p>
              <p className={styles.dirRole}>{person.role}</p>
            </div>
            {compact ? (
              <button type="button" className={styles.dirLink} onClick={() => handleOpen(person)}>
                Open chat
              </button>
            ) : (
              <button type="button" className={styles.dirBtn} onClick={() => handleOpen(person)}>
                {supplier ? 'Start chat' : 'Start conversation'}
              </button>
            )}
          </article>
        ))}
      </div>
      <ListPageControls
        variant="feed"
        rangeFrom={pager.rangeFrom}
        rangeTo={pager.rangeTo}
        total={pager.total}
        page={pager.page}
        pageCount={pager.pageCount}
        pagerNums={pager.pagerNums}
        onPrev={pager.goPrev}
        onNext={pager.goNext}
        onSelectPage={pager.setPage}
        canPrev={pager.canPrev}
        canNext={pager.canNext}
      />
    </section>
  );
}

function workspaceDirectoryBlocks(users, currentUserId) {
  const list = (users || []).filter((u) => u.id !== currentUserId && u.isActive !== false);
  const g = (r) =>
    list
      .filter((u) => u.role === r)
      .map((u) => ({
        id: u.id,
        name: u.fullName || u.email || u.id,
        role: `${u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : ''}${u.team ? ` · ${u.team}` : ''}${u.location ? ` · ${u.location}` : ''}`,
        initials: initialsFrom(u.fullName || u.email || '?'),
      }));
  return [
    { key: 'supervisors', label: 'Supervisors', entries: g('supervisor'), compact: false, supplier: false },
    { key: 'clerks', label: 'Inventory clerks', entries: g('clerk'), compact: true, supplier: false },
    { key: 'accountants', label: 'Accountants', entries: g('accountant'), compact: false, supplier: false },
    { key: 'suppliers', label: 'Suppliers', entries: g('supplier'), compact: false, supplier: true },
    { key: 'admins', label: 'Administrators', entries: g('admin'), compact: false, supplier: false },
  ];
}

export default function PortalMessagingHub({ role }) {
  const { state, portalUsesLive, sendPortalMessage, refreshPortalState } = usePortalData();
  const { user } = useAuth();
  const chat = usePortalChat(portalUsesLive);
  const copy = ROLE_COPY[role] || ROLE_COPY.clerk;
  const threads = useMemo(() => getPortalThreads(role), [role]);
  const attachments = useMemo(() => getPortalAttachments(), []);
  const notifications = notificationsForRole(state, role);
  const portalMessages = messagesForRole(state, role);

  const [tab, setTab] = useState('chat');
  const [activeThreadId, setActiveThreadId] = useState(threads[0]?.id ?? '');
  const [chatQuery, setChatQuery] = useState('');
  const [libQuery, setLibQuery] = useState('');
  const [libFilter, setLibFilter] = useState('all');
  const [composer, setComposer] = useState('');
  const [dirQuery, setDirQuery] = useState('');
  const [sendBusy, setSendBusy] = useState(false);
  const [sendError, setSendError] = useState('');
  const [dirHint, setDirHint] = useState('');
  const [threadDemoHint, setThreadDemoHint] = useState('');
  const [libRemoteItems, setLibRemoteItems] = useState([]);
  const [libRemoteLoading, setLibRemoteLoading] = useState(false);

  const liveDirBlocks = useMemo(
    () => workspaceDirectoryBlocks(state?.users, user?.id),
    [state?.users, user?.id]
  );

  useEffect(() => {
    if (!portalUsesLive || tab !== 'library') return;
    let cancelled = false;
    setLibRemoteLoading(true);
    apiFetch('/media/library')
      .then((d) => {
        if (!cancelled) setLibRemoteItems(d.items || []);
      })
      .catch(() => {
        if (!cancelled) setLibRemoteItems([]);
      })
      .finally(() => {
        if (!cancelled) setLibRemoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [portalUsesLive, tab]);

  useEffect(() => {
    const first = threads[0]?.id ?? '';
    setActiveThreadId(first);
  }, [role, threads]);

  useEffect(() => {
    setSendError('');
    setThreadDemoHint('');
  }, [activeThreadId]);

  const openChatForRecipientRole = useCallback(
    (toRole) => {
      setDirHint('');
      setSendError('');
      setTab('chat');
      const match = threads.find((t) => t.toRole === toRole);
      if (match) setActiveThreadId(match.id);
    },
    [threads]
  );

  const openChatForWorkspaceUser = useCallback(
    async (peerUserId) => {
      setDirHint('');
      setSendError('');
      setTab('chat');
      try {
        await chat.openThreadWithPeer(peerUserId);
        await refreshPortalState?.();
      } catch (e) {
        setDirHint(e?.message || 'Could not open chat.');
      }
    },
    [chat, refreshPortalState]
  );

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) || threads[0],
    [threads, activeThreadId]
  );

  const q = chatQuery.trim().toLowerCase();
  const filteredThreads = threads.filter(
    (t) => !q || t.peerName.toLowerCase().includes(q) || t.snippet.toLowerCase().includes(q)
  );
  const threadPager = usePagedList(filteredThreads, { resetKey: `${chatQuery}|${role}` });

  const sentCount = threads.reduce((acc, th) => acc + th.messages.filter((m) => m.side === 'me').length, 0);
  const recvCount = threads.reduce((acc, th) => acc + th.messages.filter((m) => m.side !== 'me').length, 0);

  const libQ = libQuery.trim().toLowerCase();
  const filteredAttachments = attachments.filter((a) => {
    if (libFilter === 'docs' && a.type !== 'doc') return false;
    if (libFilter === 'images' && a.type !== 'image') return false;
    if (libFilter === 'projects' && a.type !== 'project') return false;
    if (!libQ) return true;
    return a.name.toLowerCase().includes(libQ);
  });
  const filePager = usePagedList(filteredAttachments, { resetKey: `${libFilter}|${libQuery}` });

  const dirQ = dirQuery.trim().toLowerCase();
  function dirMatches(entry) {
    if (!dirQ) return true;
    return entry.name.toLowerCase().includes(dirQ) || entry.role.toLowerCase().includes(dirQ);
  }

  const overlayNotifs = useMemo(() => {
    const fromPortal = portalMessages.map((m) => ({
      id: m.id,
      title: m.from || 'Message',
      body: m.title,
      sub: m.body,
      kind: 'message',
    }));
    const fromN = notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      sub: '',
      kind: n.title.toLowerCase().includes('bot') || n.title.toLowerCase().includes('system') ? 'system' : 'alert',
    }));
    return [...fromPortal, ...fromN];
  }, [portalMessages, notifications]);
  const overlayPager = usePagedList(overlayNotifs, { resetKey: role });
  const portalInboxPager = usePagedList(portalMessages, { resetKey: role });

  async function handleSend() {
    const text = composer.trim();
    if (!text || sendBusy || !activeThread) return;
    setSendError('');
    const toRole = activeThread.toRole;
    if (!toRole) {
      setSendError('This thread has no recipient role.');
      return;
    }
    if (!portalUsesLive) {
      setSendError('Database mode is off — messages are not delivered. Run the API with MongoDB to send.');
      return;
    }
    setSendBusy(true);
    try {
      await sendPortalMessage({
        toRole,
        title: `To ${activeThread.peerName}`,
        body: text,
      });
      setComposer('');
    } catch (e) {
      setSendError(e?.message || 'Send failed.');
    } finally {
      setSendBusy(false);
    }
  }

  return (
    <div className={styles.hub}>
      <header className={styles.topBar}>
        <div className={styles.titleBlock}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h1 className={styles.title}>{copy.title}</h1>
          <p className={styles.lead}>{copy.lead}</p>
        </div>
        <nav className={styles.tabRow} aria-label="Messaging sections">
          {[
            { id: 'chat', label: 'Conversations' },
            { id: 'library', label: 'Digital repository' },
            { id: 'alerts', label: 'Notifications' },
            { id: 'contacts', label: 'Contacts & directory' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? styles.tabActive : styles.tab}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {tab === 'chat' && portalUsesLive && user?.id ? (
        <LiveMessagingPanel
          chat={chat}
          currentUserId={user.id}
          chatQuery={chatQuery}
          setChatQuery={setChatQuery}
          onAfterSend={refreshPortalState}
        />
      ) : null}

      {tab === 'chat' && portalUsesLive && !user?.id ? (
        <p className={styles.emptyHint} style={{ padding: '1.5rem' }}>
          Loading your session…
        </p>
      ) : null}

      {tab === 'chat' && (!portalUsesLive || !user?.id) && activeThread ? (
        <div className={styles.chatShell}>
          <div className={styles.inboxCol}>
            <div className={styles.inboxSearch}>
              <input
                type="search"
                placeholder="Search conversations…"
                value={chatQuery}
                onChange={(e) => setChatQuery(e.target.value)}
                aria-label="Search conversations"
              />
            </div>
            <div className={styles.threadList}>
              {threadPager.pageSlice.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={t.id === activeThread.id ? styles.threadItemActive : styles.threadItem}
                  onClick={() => setActiveThreadId(t.id)}
                >
                  <span className={`${styles.avatar} ${t.online ? styles.avatarOnline : ''}`}>{initialsFrom(t.peerName)}</span>
                  <div className={styles.threadItemBody}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.35rem' }}>
                      <p className={styles.threadPeer}>{t.peerName}</p>
                      <span className={styles.threadTime}>{t.lastTime}</span>
                    </div>
                    <p className={styles.threadMeta}>{t.peerTitle}</p>
                    <p className={styles.threadSnippet}>{t.snippet}</p>
                  </div>
                </button>
              ))}
            </div>
            <ListPageControls
              variant="feed"
              rangeFrom={threadPager.rangeFrom}
              rangeTo={threadPager.rangeTo}
              total={threadPager.total}
              page={threadPager.page}
              pageCount={threadPager.pageCount}
              pagerNums={threadPager.pagerNums}
              onPrev={threadPager.goPrev}
              onNext={threadPager.goNext}
              onSelectPage={threadPager.setPage}
              canPrev={threadPager.canPrev}
              canNext={threadPager.canNext}
            />
          </div>

          <div className={styles.threadCol}>
            <div className={styles.threadHead}>
              <div className={styles.threadHeadMain}>
                <span className={`${styles.avatar} ${activeThread.online ? styles.avatarOnline : ''}`}>
                  {initialsFrom(activeThread.peerName)}
                </span>
                <div>
                  <p className={styles.threadTitle}>{activeThread.peerName}</p>
                  <p className={styles.threadSub}>{activeThread.online ? 'Online · ' : ''}{activeThread.peerTitle}</p>
                </div>
              </div>
              <div className={styles.threadActions}>
                <button
                  type="button"
                  className={styles.iconGhost}
                  aria-label="Voice call"
                  title="Not available in demo mode"
                  onClick={() =>
                    setThreadDemoHint('Voice calls are not enabled in this build. Use database mode and teammate chat for messaging.')
                  }
                >
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 4h4l2 5-2 1a12 12 0 0 0 5 5l1-2 5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 5 6a2 2 0 0 1 2-2Z"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  className={styles.iconGhost}
                  aria-label="Video call"
                  title="Not available in demo mode"
                  onClick={() =>
                    setThreadDemoHint('Video calls are not enabled in this build. Use database mode and teammate chat for messaging.')
                  }
                >
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="6" width="11" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
                    <path d="m15 10 5-3v10l-5-3" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  className={styles.iconGhost}
                  aria-label="Search in thread"
                  title="Filter this preview"
                  onClick={() => {
                    const q = window.prompt('Filter messages in this preview (contains):', chatQuery);
                    if (q != null) setChatQuery(q);
                  }}
                >
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.6" />
                    <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
            {threadDemoHint ? <p className={styles.sendHint} style={{ padding: '0.5rem 0.75rem 0' }}>{threadDemoHint}</p> : null}
            <div className={styles.bubbleStack}>
              {activeThread.messages.map((m) => {
                const cls = m.side === 'me' ? styles.bubbleMe : m.side === 'system' ? styles.bubbleSystem : styles.bubbleThem;
                return (
                  <div key={m.id} className={cls}>
                    {m.text}
                    <span className={styles.bubbleTime}>{m.time}</span>
                  </div>
                );
              })}
            </div>
            <div className={styles.composerColumn}>
              <div className={styles.composer}>
                <button
                  type="button"
                  className={styles.iconGhost}
                  aria-label="Attach file"
                  title="Attachments in live mode"
                  onClick={() =>
                    setThreadDemoHint('Attachments are available in database mode with Cloudinary configured — open the live Conversations tab after sign-in.')
                  }
                >
                  +
                </button>
                <input
                  placeholder="Write a message…"
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  aria-label="Message text"
                />
                <button type="button" className={styles.sendBtn} onClick={handleSend} disabled={sendBusy}>
                  {sendBusy ? 'Sending…' : 'Send'}
                </button>
              </div>
              {sendError ? <p className={styles.sendError}>{sendError}</p> : null}
              {!sendError && !portalUsesLive ? (
                <p className={styles.sendHint}>Turn on database mode on the server to deliver messages to the selected role inbox.</p>
              ) : null}
            </div>
          </div>

          <aside className={styles.detailCol}>
            <div className={styles.detailInner}>
              <div className={styles.detailHero}>
                <span className={`${styles.avatar} ${activeThread.online ? styles.avatarOnline : ''}`}>
                  {initialsFrom(activeThread.peerName)}
                </span>
                <p className={styles.detailName}>{activeThread.peerName}</p>
                <p className={styles.detailRole}>{activeThread.peerTitle}</p>
              </div>
              <p className={styles.sectionLabel}>Shared files</p>
              {activeThread.sharedFiles?.length ? (
                activeThread.sharedFiles.map((f) => (
                  <div key={f.id} className={styles.fileRow}>
                    <span className={styles.fileIcon}>{f.type === 'image' ? 'IMG' : f.type === 'project' ? 'ZIP' : 'PDF'}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.78rem' }}>{f.name}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--ec-muted)' }}>{f.date}</div>
                    </div>
                  </div>
                ))
              ) : (
                <p className={styles.emptyHint}>No files in this thread yet.</p>
              )}
              <p className={styles.sectionLabel}>Shared links</p>
              {activeThread.sharedLinks?.length ? (
                activeThread.sharedLinks.map((l) => (
                  <a key={l.label} href={l.href} className={styles.linkRow}>
                    {l.label}
                  </a>
                ))
              ) : (
                <p className={styles.emptyHint}>No links pinned.</p>
              )}
            </div>
          </aside>
        </div>
      ) : null}

      {tab === 'library' && portalUsesLive ? (
        <div className={styles.libShell}>
          <section className={styles.libMain}>
            <div className={styles.libToolbar}>
              <span className={styles.kpiLabel} style={{ margin: 0 }}>
                Media from your chats (Cloudinary)
              </span>
            </div>
            {libRemoteLoading ? <p className={styles.emptyHint}>Loading…</p> : null}
            <div className={styles.fileGrid}>
              {(libRemoteItems || []).map((item) => (
                <article key={`${item.messageId}_${item.url}`} className={styles.fileCard}>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.fileCardThumb}>
                    {item.resourceType === 'video' ? 'VID' : item.resourceType === 'image' ? 'IMG' : 'FILE'}
                  </a>
                  <p className={styles.fileCardName}>{item.originalName || item.resourceType || 'Media'}</p>
                  <p className={styles.fileCardDate}>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}</p>
                </article>
              ))}
            </div>
            {!libRemoteLoading && (!libRemoteItems || !libRemoteItems.length) ? (
              <p className={styles.emptyHint}>No shared media yet — send a photo or file in a chat (requires Cloudinary).</p>
            ) : null}
          </section>
          <aside className={styles.libAside}>
            <div>
              <p className={styles.kpiLabel}>Cloudinary</p>
              <p className={styles.kpiMeta}>
                Files upload to your configured Cloudinary folder (e.g. ecunga/&lt;company&gt;/&lt;user&gt;). This grid lists media attached in conversations you participate in.
              </p>
            </div>
            <div>
              <p className={styles.kpiLabel}>Recent portal messages</p>
              {portalMessages.slice(0, 4).length ? (
                portalMessages.slice(0, 4).map((m) => (
                  <div key={m.id} className={styles.activityItem}>
                    {m.title}: {m.body}
                  </div>
                ))
              ) : (
                <p className={styles.activityItem} style={{ opacity: 0.75 }}>
                  No portal messages yet for this role.
                </p>
              )}
            </div>
          </aside>
        </div>
      ) : null}

      {tab === 'library' && !portalUsesLive ? (
        <div className={styles.libShell}>
          <section className={styles.libMain}>
            <div className={styles.libToolbar}>
              <input
                type="search"
                placeholder="Search repository…"
                value={libQuery}
                onChange={(e) => setLibQuery(e.target.value)}
                aria-label="Search files"
              />
              <span className={styles.tab} style={{ cursor: 'default' }}>
                Filter
              </span>
            </div>
            <div className={styles.libTabs} role="tablist" aria-label="Attachment type">
              {[
                { id: 'all', label: 'All attachments' },
                { id: 'docs', label: 'Docs' },
                { id: 'images', label: 'Images' },
                { id: 'projects', label: 'Projects' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={libFilter === t.id}
                  className={libFilter === t.id ? styles.libTabActive : styles.libTab}
                  onClick={() => setLibFilter(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className={styles.fileGrid}>
              {filePager.pageSlice.map((a) => (
                <article key={a.id} className={styles.fileCard}>
                  <div className={styles.fileCardThumb}>{a.type === 'image' ? 'IMG' : a.type === 'project' ? 'PRJ' : 'DOC'}</div>
                  <p className={styles.fileCardName}>{a.name}</p>
                  <p className={styles.fileCardDate}>
                    {a.date} · {a.size}
                  </p>
                </article>
              ))}
            </div>
            <ListPageControls
              variant="feed"
              rangeFrom={filePager.rangeFrom}
              rangeTo={filePager.rangeTo}
              total={filePager.total}
              page={filePager.page}
              pageCount={filePager.pageCount}
              pagerNums={filePager.pagerNums}
              onPrev={filePager.goPrev}
              onNext={filePager.goNext}
              onSelectPage={filePager.setPage}
              canPrev={filePager.canPrev}
              canNext={filePager.canNext}
            />
          </section>
          <aside className={styles.libAside}>
            <div>
              <p className={styles.kpiLabel}>Total storage</p>
              <p className={styles.kpiValue} style={{ fontSize: '1.25rem', marginTop: '0.35rem' }}>
                6.4 GB <span style={{ fontWeight: 600, opacity: 0.7 }}>of 10 GB</span>
              </p>
              <div className={styles.storageBar}>
                <div className={styles.storageFill} />
              </div>
              <p className={styles.kpiMeta}>Illustrative quota · file repository is not wired to storage yet</p>
            </div>
            <div>
              <p className={styles.kpiLabel}>Recent portal messages</p>
              {portalMessages.slice(0, 4).length ? (
                portalMessages.slice(0, 4).map((m) => (
                  <div key={m.id} className={styles.activityItem}>
                    {m.title}: {m.body}
                  </div>
                ))
              ) : (
                <p className={styles.activityItem} style={{ opacity: 0.75 }}>
                  No portal messages yet for this role.
                </p>
              )}
            </div>
          </aside>
        </div>
      ) : null}

      {tab === 'alerts' ? (
        <div className={styles.alertShell}>
          <div className={styles.kpiRow}>
            <article className={styles.kpiCard}>
              <p className={styles.kpiLabel}>Messages sent</p>
              <p className={styles.kpiValue}>{sentCount}</p>
              <p className={styles.kpiMeta}>
                {portalUsesLive
                  ? 'Counts reflect demo story threads; real sends use Conversations (1:1 chat + Cloudinary media).'
                  : 'Demo preview only until database mode is on.'}
              </p>
            </article>
            <article className={styles.kpiCard}>
              <p className={styles.kpiLabel}>Messages received</p>
              <p className={styles.kpiValue}>{recvCount}</p>
              <p className={styles.kpiMeta}>
                {portalUsesLive
                  ? 'Use Conversations for teammate replies; the inbox below lists legacy role notices when present.'
                  : 'Demo preview; live inbox appears with MongoDB.'}
              </p>
            </article>
          </div>
          <div className={styles.alertGrid}>
            <section className={styles.inboxCard}>
              <p className={styles.kpiLabel} style={{ marginBottom: '0.65rem' }}>
                System inbox · recent requests
              </p>
              {portalMessages.length ? (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {portalInboxPager.pageSlice.map((m) => (
                    <li key={m.id} className={styles.activityItem}>
                      <strong style={{ display: 'block', fontSize: '0.82rem' }}>{m.title}</strong>
                      <span style={{ fontSize: '0.74rem', color: 'var(--ec-muted)' }}>{m.from}</span>
                      <p style={{ margin: '0.35rem 0 0', fontSize: '0.78rem' }}>{m.body}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.emptyHint}>No portal messages for this role yet—alerts on the right stay live from notifications.</p>
              )}
              {portalMessages.length > 0 ? (
                <ListPageControls
                  variant="feed"
                  rangeFrom={portalInboxPager.rangeFrom}
                  rangeTo={portalInboxPager.rangeTo}
                  total={portalInboxPager.total}
                  page={portalInboxPager.page}
                  pageCount={portalInboxPager.pageCount}
                  pagerNums={portalInboxPager.pagerNums}
                  onPrev={portalInboxPager.goPrev}
                  onNext={portalInboxPager.goNext}
                  onSelectPage={portalInboxPager.setPage}
                  canPrev={portalInboxPager.canPrev}
                  canNext={portalInboxPager.canNext}
                />
              ) : null}
            </section>
            <div className={styles.notifStack} aria-label="Recent alerts">
              <p className={styles.kpiLabel}>Live feed</p>
              {overlayPager.pageSlice.map((n) => (
                <article key={n.id} className={styles.notifItem}>
                  <div className={styles.notifTop}>
                    <p className={styles.notifTitle}>{n.title}</p>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--ec-muted)', textTransform: 'uppercase' }}>
                      {n.kind}
                    </span>
                  </div>
                  <p className={styles.notifBody}>{n.body}</p>
                  {n.sub ? <p className={styles.notifBody}>{n.sub}</p> : null}
                  {n.kind === 'message' ? (
                    <button type="button" className={styles.replyBtn} onClick={() => setTab('chat')}>
                      Open chat
                    </button>
                  ) : null}
                </article>
              ))}
              {overlayNotifs.length > 0 ? (
                <ListPageControls
                  variant="feed"
                  rangeFrom={overlayPager.rangeFrom}
                  rangeTo={overlayPager.rangeTo}
                  total={overlayPager.total}
                  page={overlayPager.page}
                  pageCount={overlayPager.pageCount}
                  pagerNums={overlayPager.pagerNums}
                  onPrev={overlayPager.goPrev}
                  onNext={overlayPager.goNext}
                  onSelectPage={overlayPager.setPage}
                  canPrev={overlayPager.canPrev}
                  canNext={overlayPager.canNext}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'contacts' ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
            <input
              type="search"
              placeholder="Search directory…"
              value={dirQuery}
              onChange={(e) => setDirQuery(e.target.value)}
              aria-label="Search directory"
              style={{
                maxWidth: '280px',
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.75rem',
                border: '1px solid rgb(186 210 232 / 0.65)',
                fontSize: '0.82rem',
              }}
            />
          </div>
          {(portalUsesLive && user?.id ? liveDirBlocks : [
            { key: 'supervisors', label: 'Supervisors', entries: DIRECTORY.supervisors, compact: false, supplier: false },
            { key: 'clerks', label: 'Inventory clerks', entries: DIRECTORY.clerks, compact: true, supplier: false },
            { key: 'accountants', label: 'Accountants', entries: DIRECTORY.accountants, compact: false, supplier: false },
            { key: 'suppliers', label: 'Suppliers', entries: DIRECTORY.suppliers, compact: false, supplier: true },
          ]).map((block) => {
            const list = block.entries.filter(dirMatches);
            if (!list.length) return null;
            return (
              <PaginatedDirectoryBlock
                key={block.key}
                label={block.label}
                entries={list}
                compact={block.compact}
                supplier={block.supplier}
                dirQuery={dirQuery}
                directoryKey={block.key}
                onOpenChatForRole={openChatForRecipientRole}
                onOpenChatUser={portalUsesLive && user?.id ? openChatForWorkspaceUser : undefined}
              />
            );
          })}
          <div className={styles.fabCard}>
            <p className={styles.fabTitle}>Need a new group?</p>
            <p className={styles.fabText}>Create a group chat for a project lane or ward cluster. Members inherit file permissions from their roles.</p>
            <button
              type="button"
              className={styles.fabBtn}
              onClick={() =>
                setDirHint(
                  portalUsesLive
                    ? 'Group inboxes are not implemented yet — use one-to-one chats with teammates from the directory above.'
                    : 'Separate group threads are not stored yet. Use Conversations and Send — with MongoDB, each role gets inbox messages and notifications.'
                )
              }
            >
              Create group chat
            </button>
            {dirHint ? <p className={styles.emptyHint} style={{ marginTop: '0.75rem' }}>{dirHint}</p> : null}
          </div>
        </>
      ) : null}

      {tab === 'chat' && !portalUsesLive && !activeThread ? (
        <p className={styles.emptyHint}>No conversations available.</p>
      ) : null}
    </div>
  );
}
