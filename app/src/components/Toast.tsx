'use client';
import { useCallback, useRef, useState } from 'react';

export function useToast() {
  const [msg, setMsg] = useState('');
  const t = useRef<number | undefined>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setMsg(''), 3000);
  }, []);
  const node = (
    <div className={`toast ${msg ? 'show' : ''}`} role="status" aria-live="polite">
      {msg}
    </div>
  );
  return { show, node };
}
