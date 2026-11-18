'use client';
import { useCallback, useEffect, useState } from 'react';
import { sb } from './supabase';
import { useSession } from './session';

// v2 機能フラグ。行が無い・テーブルが無い（v2 未適用の DB）・通信失敗はすべて OFF として扱う
export type Feature = 'voice_input' | 'promo_image' | 'template_share' | 'invite' | 'menu_i18n' | 'staff_profile' | 'partner_share';

let cache: { storeId: string; set: Set<Feature> } | null = null;

export async function loadFeatures(storeId: string): Promise<Set<Feature>> {
  if (cache && cache.storeId === storeId) return cache.set;
  const set = new Set<Feature>();
  try {
    const { data, error } = await sb().from('store_features').select('feature,enabled').eq('store_id', storeId);
    if (!error) for (const r of (data as { feature: Feature; enabled: boolean }[]) ?? []) if (r.enabled) set.add(r.feature);
  } catch {
    /* OFF のまま */
  }
  cache = { storeId, set };
  return set;
}

export function resetFeatureCache() {
  cache = null;
}

/** ready=false の間は「OFF」として描画する */
export function useFeatures(): { has: (f: Feature) => boolean; ready: boolean } {
  const { me } = useSession();
  const [state, setState] = useState<{ storeId: string; set: Set<Feature> } | null>(null);
  useEffect(() => {
    if (!me) return;
    let alive = true;
    void loadFeatures(me.storeId).then((set) => alive && setState({ storeId: me.storeId, set }));
    return () => {
      alive = false;
    };
  }, [me]);
  const set = state && me && state.storeId === me.storeId ? state.set : null;
  // has は set が変わらない限り同じ関数（useEffect の依存に入れても再実行が続かないように）
  const has = useCallback((f: Feature) => Boolean(set?.has(f)), [set]);
  return { has, ready: Boolean(set) };
}
