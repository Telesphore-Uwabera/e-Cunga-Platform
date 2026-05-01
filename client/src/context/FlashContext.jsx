import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FlashMessage } from '../components/FlashMessage.jsx';

const FlashContext = createContext(null);

/** Map legacy / alternate tone names to canonical toasts. */
export function normalizeFlashTone(tone) {
  const t = String(tone || 'ok').toLowerCase();
  if (t === 'bad' || t === 'danger' || t === 'failed' || t === 'failure') return 'error';
  if (t === 'success') return 'ok';
  if (t === 'loading' || t === 'pending' || t === 'wait' || t === 'working') return 'loading';
  if (t === 'error' || t === 'warn' || t === 'ok' || t === 'loading') return t;
  return 'ok';
}

export function FlashProvider({ children }) {
  const [state, setState] = useState({ message: '', tone: 'ok' });
  const timerRef = useRef(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setState({ message: '', tone: 'ok' });
  }, []);

  const showFlash = useCallback((message, tone = 'ok') => {
    const normalized = normalizeFlashTone(tone);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setState({ message: String(message || '').trim() || ' ', tone: normalized });
  }, []);

  useEffect(() => {
    if (!state.message) return undefined;
    const ms = state.tone === 'loading' ? 14000 : 5200;
    timerRef.current = setTimeout(dismiss, ms);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state.message, state.tone, dismiss]);

  const value = useMemo(
    () => ({
      showFlash,
      flash: showFlash,
      dismiss,
      message: state.message,
      tone: state.tone,
      /** @deprecated Mount `<GlobalFlashBanner />` once in AppShell; this is a no-op to avoid duplicate toasts. */
      FlashBanner: function FlashBannerNoop() {
        return null;
      },
    }),
    [showFlash, dismiss, state.message, state.tone]
  );

  return <FlashContext.Provider value={value}>{children}</FlashContext.Provider>;
}

export function useFlash() {
  const ctx = useContext(FlashContext);
  if (!ctx) {
    if (import.meta.env?.DEV) {
      console.warn('[useFlash] FlashProvider missing — toasts disabled for this subtree.');
    }
    const noop = () => {};
    return {
      showFlash: noop,
      flash: noop,
      dismiss: noop,
      FlashBanner: () => null,
      message: '',
      tone: 'ok',
    };
  }
  return ctx;
}

/** Single fixed toast mount for the authenticated app shell. */
export function GlobalFlashBanner() {
  const { message, tone, dismiss } = useFlash();
  return <FlashMessage message={message} tone={tone} onDismiss={dismiss} />;
}
