'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { sb, supabaseConfigured } from './supabase';
import type { Me } from './types';

type Ctx = {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<Me | null>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<Ctx | null>(null);

export async function loadMe(): Promise<Me | null> {
  const client = sb();
  const { data } = await client.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  const { data: m } = await client
    .from('store_members')
    .select('store_id,role,alias_id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!m) return null;
  const [{ data: store }, alias] = await Promise.all([
    client.from('stores').select('name').eq('id', m.store_id).maybeSingle(),
    m.alias_id
      ? client.from('staff_aliases').select('name').eq('id', m.alias_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    userId: user.id,
    role: m.role,
    storeId: m.store_id,
    storeName: store?.name ?? '',
    aliasId: m.alias_id,
    aliasName: (alias.data as { name: string } | null)?.name ?? null,
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!supabaseConfigured()) {
      setLoading(false);
      return null;
    }
    try {
      const v = await loadMe();
      setMe(v);
      return v;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await sb().rpc('leave_store');
    } catch {
      /* 通信できなくてもローカルのセッションは破棄する */
    }
    await sb().auth.signOut({ scope: 'local' });
    setMe(null);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初回にセッションを読み込む
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ me, loading, refresh, logout }), [me, loading, refresh, logout]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Ctx {
  const c = useContext(SessionContext);
  if (!c) throw new Error('SessionProvider がありません');
  return c;
}
