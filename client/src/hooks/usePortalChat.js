import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, getToken } from '../api/client.js';

export function usePortalChat(enabled) {
  const [threads, setThreads] = useState([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const pollRef = useRef(null);

  const loadThreads = useCallback(async () => {
    if (!enabled || !getToken()) return;
    setThreadsLoading(true);
    try {
      const data = await apiFetch('/chat/threads');
      setThreads(data.threads || []);
    } catch {
      setThreads([]);
    } finally {
      setThreadsLoading(false);
    }
  }, [enabled]);

  const loadMessages = useCallback(
    async (threadId) => {
      if (!enabled || !getToken() || !threadId) return;
      setMessagesLoading(true);
      try {
        const data = await apiFetch(`/chat/threads/${encodeURIComponent(threadId)}/messages`);
        setMessages(data.messages || []);
      } catch {
        setMessages([]);
      } finally {
        setMessagesLoading(false);
      }
    },
    [enabled]
  );

  useEffect(() => {
    if (!enabled) {
      setThreads([]);
      setActiveThreadId(null);
      setMessages([]);
      return;
    }
    loadThreads();
  }, [enabled, loadThreads]);

  useEffect(() => {
    if (!enabled) return;
    if (threadsLoading) return;
    if (!threads.length) {
      setActiveThreadId(null);
      setMessages([]);
      return;
    }
    setActiveThreadId((prev) => {
      if (prev && threads.some((t) => t.id === prev)) return prev;
      return threads[0].id;
    });
  }, [enabled, threadsLoading, threads]);

  useEffect(() => {
    if (!enabled || !activeThreadId) {
      setMessages([]);
      return;
    }
    loadMessages(activeThreadId);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => loadMessages(activeThreadId), 12000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [enabled, activeThreadId, loadMessages]);

  const openThreadWithPeer = useCallback(
    async (peerUserId) => {
      const data = await apiFetch('/chat/threads/open', {
        method: 'POST',
        body: JSON.stringify({ peerUserId }),
      });
      await loadThreads();
      setActiveThreadId(data.threadId);
      return data;
    },
    [loadThreads]
  );

  const sendChatMessage = useCallback(
    async ({ body, replyToId, media }) => {
      if (!activeThreadId) throw new Error('No thread selected.');
      await apiFetch(`/chat/threads/${encodeURIComponent(activeThreadId)}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body, replyToId, media }),
      });
      await loadMessages(activeThreadId);
      await loadThreads();
    },
    [activeThreadId, loadMessages, loadThreads]
  );

  const editChatMessage = useCallback(
    async (messageId, body) => {
      await apiFetch(`/chat/messages/${encodeURIComponent(messageId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ body }),
      });
      if (activeThreadId) await loadMessages(activeThreadId);
    },
    [activeThreadId, loadMessages]
  );

  const toggleReaction = useCallback(async (messageId, emoji) => {
    const data = await apiFetch(`/chat/messages/${encodeURIComponent(messageId)}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions: data.reactions } : m)));
  }, []);

  return {
    threads,
    threadsLoading,
    activeThreadId,
    setActiveThreadId,
    messages,
    messagesLoading,
    loadThreads,
    loadMessages,
    openThreadWithPeer,
    sendChatMessage,
    editChatMessage,
    toggleReaction,
  };
}
