import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ListPageControls from '../../../components/ListPageControls.jsx';
import { usePagedList } from '../../../hooks/usePagedList.js';
import { apiFetch, apiUploadMedia } from '../../../api/client.js';
import styles from './PortalMessagingHub.module.css';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '🙏'];
const EDIT_MS = 15 * 60 * 1000;

function roleLabel(role) {
  if (!role) return '';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatMsgTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function canEditMessage(m, currentUserId) {
  if (!m || m.senderId !== currentUserId) return false;
  const t = new Date(m.createdAt).getTime();
  return Date.now() - t <= EDIT_MS;
}

export default function LiveMessagingPanel({
  chat,
  currentUserId,
  chatQuery,
  setChatQuery,
  onAfterSend,
}) {
  const {
    threads,
    threadsLoading,
    activeThreadId,
    setActiveThreadId,
    messages,
    messagesLoading,
    sendChatMessage,
    editChatMessage,
    toggleReaction,
  } = chat;

  const [composer, setComposer] = useState('');
  const [sendBusy, setSendBusy] = useState(false);
  const [sendError, setSendError] = useState('');
  const [pendingMedia, setPendingMedia] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [cloudinaryReady, setCloudinaryReady] = useState(false);
  const fileRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/health')
      .then((h) => {
        if (!cancelled) setCloudinaryReady(h?.cloudinary === 'ready');
      })
      .catch(() => {
        if (!cancelled) setCloudinaryReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeThreadId]);

  useEffect(() => {
    setSendError('');
    setReplyingTo(null);
    setEditingMessage(null);
    setComposer('');
    setPendingMedia([]);
  }, [activeThreadId]);

  const activeMeta = useMemo(
    () => threads.find((t) => t.id === activeThreadId) || null,
    [threads, activeThreadId]
  );

  const q = chatQuery.trim().toLowerCase();
  const filteredThreads = threads.filter(
    (t) => !q || t.peerName.toLowerCase().includes(q) || (t.lastPreview || '').toLowerCase().includes(q)
  );
  const threadPager = usePagedList(filteredThreads, { resetKey: `${chatQuery}|threads` });

  const removePending = useCallback((idx) => {
    setPendingMedia((p) => p.filter((_, i) => i !== idx));
  }, []);

  const onPickFile = useCallback(
    async (e) => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (!f) return;
      if (!cloudinaryReady) {
        setSendError('Cloudinary is not configured on the server — uploads are disabled.');
        return;
      }
      try {
        const up = await apiUploadMedia(f);
        setPendingMedia((p) => [
          ...p,
          {
            url: up.url,
            publicId: up.publicId,
            resourceType: up.resourceType,
            format: up.format || '',
            bytes: up.bytes,
            originalName: up.originalName,
          },
        ]);
        setSendError('');
      } catch (err) {
        setSendError(err?.message || 'Upload failed.');
      }
    },
    [cloudinaryReady]
  );

  async function handleSend() {
    const text = editingMessage ? composer.trim() : composer.trim();
    if (editingMessage) {
      if (!text) return;
      setSendBusy(true);
      setSendError('');
      try {
        await editChatMessage(editingMessage.id, text);
        setEditingMessage(null);
        setComposer('');
        await onAfterSend?.();
      } catch (e) {
        setSendError(e?.message || 'Could not save edit.');
      } finally {
        setSendBusy(false);
      }
      return;
    }

    if (!text && !pendingMedia.length) return;
    setSendBusy(true);
    setSendError('');
    try {
      await sendChatMessage({
        body: text,
        replyToId: replyingTo?.id || null,
        media: pendingMedia,
      });
      setComposer('');
      setPendingMedia([]);
      setReplyingTo(null);
      await onAfterSend?.();
    } catch (e) {
      setSendError(e?.message || 'Send failed.');
    } finally {
      setSendBusy(false);
    }
  }

  function startReply(m) {
    setEditingMessage(null);
    setReplyingTo({
      id: m.id,
      label: `${m.senderName}: ${(m.body || '').slice(0, 80)}${(m.body || '').length > 80 ? '…' : ''}`,
    });
  }

  function startEdit(m) {
    setReplyingTo(null);
    setEditingMessage({ id: m.id });
    setComposer(m.body || '');
  }

  return (
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
          {threadsLoading && !threads.length ? (
            <p className={styles.emptyHint} style={{ padding: '1rem' }}>
              Loading conversations…
            </p>
          ) : null}
          {threadPager.pageSlice.map((t) => (
            <button
              key={t.id}
              type="button"
              className={t.id === activeThreadId ? styles.threadItemActive : styles.threadItem}
              onClick={() => setActiveThreadId(t.id)}
            >
              <span className={styles.avatar}>{t.peerName?.slice(0, 2).toUpperCase() || '?'}</span>
              <div className={styles.threadItemBody}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.35rem' }}>
                  <p className={styles.threadPeer}>{t.peerName}</p>
                  <span className={styles.threadTime}>{formatMsgTime(t.lastMessageAt)}</span>
                </div>
                <p className={styles.threadMeta}>{roleLabel(t.peerRole)}</p>
                <p className={styles.threadSnippet}>{t.lastPreview || 'No messages yet'}</p>
              </div>
            </button>
          ))}
        </div>
        {!threadsLoading && !threads.length ? (
          <p className={styles.emptyHint} style={{ padding: '0.75rem' }}>
            No chats yet — open <strong>Contacts</strong> and message a teammate.
          </p>
        ) : null}
        {threads.length > 0 ? (
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
        ) : null}
      </div>

      <div className={styles.threadCol}>
        {!activeMeta ? (
          <p className={styles.emptyHint} style={{ padding: '1.5rem' }}>
            Select a conversation or start one from Contacts.
          </p>
        ) : (
          <>
            <div className={styles.threadHead}>
              <div className={styles.threadHeadMain}>
                <span className={styles.avatar}>{activeMeta.peerName?.slice(0, 2).toUpperCase() || '?'}</span>
                <div>
                  <p className={styles.threadTitle}>{activeMeta.peerName}</p>
                  <p className={styles.threadSub}>{roleLabel(activeMeta.peerRole)}</p>
                </div>
              </div>
            </div>
            <div className={styles.bubbleStack}>
              {messagesLoading && !messages.length ? (
                <p className={styles.emptyHint}>Loading messages…</p>
              ) : null}
              {messages.map((m) => {
                const mine = m.senderId === currentUserId;
                const cls = mine ? styles.bubbleMe : styles.bubbleThem;
                return (
                  <div key={m.id} className={`${styles.liveMsgWrap} ${mine ? styles.liveMsgMine : ''}`}>
                    <div className={`${cls} ${styles.liveBubble}`}>
                      {m.replyToSnapshot?.bodySnippet ? (
                        <div className={styles.replyStrip}>
                          <span className={styles.replyStripName}>{m.replyToSnapshot.senderName}</span>
                          <span className={styles.replyStripText}>{m.replyToSnapshot.bodySnippet}</span>
                        </div>
                      ) : null}
                      {m.media?.length
                        ? m.media.map((med, idx) => (
                            <div key={`${m.id}_m_${idx}`} className={styles.chatMedia}>
                              {med.resourceType === 'video' ? (
                                <video className={styles.chatMediaVisual} src={med.url} controls playsInline />
                              ) : med.resourceType === 'image' || med.resourceType === 'auto' ? (
                                <img className={styles.chatMediaVisual} src={med.url} alt="" loading="lazy" />
                              ) : (
                                <a href={med.url} target="_blank" rel="noopener noreferrer" className={styles.chatMediaLink}>
                                  {med.originalName || 'Open file'}
                                </a>
                              )}
                            </div>
                          ))
                        : null}
                      {m.body ? <div className={styles.liveBubbleText}>{m.body}</div> : null}
                      <div className={styles.liveBubbleMeta}>
                        <span className={styles.bubbleTime}>{formatMsgTime(m.createdAt)}</span>
                        {m.editedAt ? <span className={styles.editedTag}>edited</span> : null}
                      </div>
                    </div>
                    {(m.reactions || []).length > 0 ? (
                      <div className={styles.reactionBar}>
                        {(m.reactions || []).map((r, i) => (
                          <span key={`${r.userId}_${i}`} className={styles.reactionChip} title={r.userId}>
                            {r.emoji}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className={styles.msgActionRow}>
                      <button type="button" className={styles.msgActionBtn} onClick={() => startReply(m)}>
                        Reply
                      </button>
                      {canEditMessage(m, currentUserId) ? (
                        <button type="button" className={styles.msgActionBtn} onClick={() => startEdit(m)}>
                          Edit
                        </button>
                      ) : null}
                      <span className={styles.msgActionLabel}>React</span>
                      {QUICK_REACTIONS.map((em) => (
                        <button
                          key={em}
                          type="button"
                          className={styles.msgReactBtn}
                          aria-label={`React ${em}`}
                          onClick={() => toggleReaction(m.id, em)}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className={styles.composerColumn}>
              {replyingTo ? (
                <div className={styles.composerReplyBar}>
                  <div>
                    <span className={styles.composerReplyLabel}>Replying to</span>
                    <p className={styles.composerReplyText}>{replyingTo.label}</p>
                  </div>
                  <button type="button" className={styles.msgActionBtn} onClick={() => setReplyingTo(null)}>
                    Cancel
                  </button>
                </div>
              ) : null}
              {editingMessage ? (
                <div className={styles.composerReplyBar}>
                  <span className={styles.composerReplyLabel}>Editing message</span>
                  <button type="button" className={styles.msgActionBtn} onClick={() => { setEditingMessage(null); setComposer(''); }}>
                    Cancel edit
                  </button>
                </div>
              ) : null}
              {pendingMedia.length > 0 ? (
                <div className={styles.pendingMediaRow}>
                  {pendingMedia.map((pm, i) => (
                    <span key={`${pm.publicId}_${i}`} className={styles.pendingMediaChip}>
                      {pm.resourceType === 'image' ? '📷' : pm.resourceType === 'video' ? '🎬' : '📎'}{' '}
                      {(pm.originalName || 'file').slice(0, 24)}
                      <button type="button" className={styles.pendingMediaRemove} onClick={() => removePending(i)} aria-label="Remove">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              <div className={styles.composer}>
                <input ref={fileRef} type="file" accept="image/*,video/*,application/pdf" className={styles.fileInputHidden} onChange={onPickFile} />
                <button
                  type="button"
                  className={styles.iconGhost}
                  aria-label="Attach media"
                  disabled={!cloudinaryReady || editingMessage !== null}
                  title={cloudinaryReady ? 'Upload image, video, or PDF' : 'Enable Cloudinary on the server to upload'}
                  onClick={() => fileRef.current?.click()}
                >
                  +
                </button>
                <input
                  placeholder={editingMessage ? 'Edit your message…' : 'Write a message…'}
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
                  {sendBusy ? '…' : editingMessage ? 'Save' : 'Send'}
                </button>
              </div>
              {sendError ? <p className={styles.sendError}>{sendError}</p> : null}
              {!cloudinaryReady ? (
                <p className={styles.sendHint}>Set CLOUDINARY_* env vars on the server to enable attachments (stored in your Cloudinary folder).</p>
              ) : null}
            </div>
          </>
        )}
      </div>

      <aside className={styles.detailCol}>
        <div className={styles.detailInner}>
          <div className={styles.detailHero}>
            <span className={styles.avatar}>{activeMeta?.peerName?.slice(0, 2).toUpperCase() || '?'}</span>
            <p className={styles.detailName}>{activeMeta?.peerName || '—'}</p>
            <p className={styles.detailRole}>{activeMeta ? roleLabel(activeMeta.peerRole) : ''}</p>
          </div>
          <p className={styles.sectionLabel}>About this chat</p>
          <p className={styles.emptyHint} style={{ fontSize: '0.78rem', lineHeight: 1.45 }}>
            One-to-one workspace chat. Replies quote the original message; reactions toggle like in WhatsApp; you can edit your own messages for 15 minutes. Media is stored in Cloudinary.
          </p>
          <p className={styles.sectionLabel}>Design preview threads</p>
          <p className={styles.emptyHint} style={{ fontSize: '0.75rem' }}>
            Demo story threads are hidden in live mode — use real teammates from Contacts.
          </p>
        </div>
      </aside>
    </div>
  );
}
