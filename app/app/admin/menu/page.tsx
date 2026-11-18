'use client';
import { useCallback, useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useToast } from '@/components/Toast';
import { AllergenBadges, MenuBoard } from '@/components/MenuBoard';
import { sb } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { useFeatures } from '@/lib/features';
import { fmtShort } from '@/lib/format';
import { ALLERGENS, DISCLAIMER, LANGS, TRANSLATED, type MenuItem, type Translation } from '@/lib/v2/allergens';

export default function MenuAdminPage() {
  return (
    <Shell role="admin">
      <MenuAdmin />
    </Shell>
  );
}

const EMPTY = { name_ja: '', description_ja: '', price: '' };

function MenuAdmin() {
  const { me } = useSession();
  const { has, ready } = useFeatures();
  const toast = useToast();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tab, setTab] = useState<'edit' | 'board'>('edit');
  const [add, setAdd] = useState(EMPTY);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data } = await sb().from('menu_items').select('*').order('sort').order('created_at');
    setItems((data as MenuItem[]) ?? []);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初回読み込み
    if (ready && has('menu_i18n')) void load();
  }, [ready, has, load]);

  if (!me) return null;
  if (ready && !has('menu_i18n')) return <p className="muted">この店舗では使えない機能です。</p>;

  const create = async () => {
    setErr('');
    if (!add.name_ja.trim()) return setErr('料理名を入力してください');
    const price = add.price === '' ? null : Number(add.price);
    if (price !== null && (!Number.isInteger(price) || price < 0)) return setErr('価格は0以上の整数で入力してください');
    const { error } = await sb().from('menu_items').insert({ store_id: me.storeId, name_ja: add.name_ja.trim(), description_ja: add.description_ja.trim(), price, sort: items.length + 1 });
    if (error) return setErr('追加できませんでした（料理名40文字・説明120文字まで）');
    setAdd(EMPTY);
    toast.show('メニューを追加しました。アレルゲンと翻訳を入力してください');
    await load();
  };

  return (
    <>
      <h1>メニュー表（多言語・アレルゲン）</h1>
      <p className="disclaimer" role="note">⚠ {DISCLAIMER.ja} アレルゲンは店主の入力のみで表示します（自動判定はしません）。翻訳は店主が確認して「確定」したものだけをお客様向けに表示します。</p>
      <div className="chips" role="tablist" style={{ margin: '10px 0' }}>
        <button role="tab" aria-selected={tab === 'edit'} className={`chip ${tab === 'edit' ? 'on' : ''}`} onClick={() => setTab('edit')}>編集</button>
        <button role="tab" aria-selected={tab === 'board'} className={`chip ${tab === 'board' ? 'on' : ''}`} onClick={() => setTab('board')} data-testid="menu-board-tab">お客様向けの表示</button>
      </div>
      {tab === 'board' ? <MenuBoard /> : (
        <>
          <div className="card">
            <h3>メニューを追加</h3>
            <div className="grid three">
              <div><label htmlFor="add-name">料理名</label><input id="add-name" type="text" maxLength={40} value={add.name_ja} onChange={(e) => setAdd({ ...add, name_ja: e.target.value })} /></div>
              <div><label htmlFor="add-desc">説明（任意）</label><input id="add-desc" type="text" maxLength={120} value={add.description_ja} onChange={(e) => setAdd({ ...add, description_ja: e.target.value })} /></div>
              <div><label htmlFor="add-price">価格（円・税込）</label><input id="add-price" type="text" inputMode="numeric" value={add.price} onChange={(e) => setAdd({ ...add, price: e.target.value.replace(/\D/g, '') })} /></div>
            </div>
            {err && <p className="err" role="alert">{err}</p>}
            <button className="btn block" style={{ marginTop: 10 }} onClick={create} data-testid="menu-add">＋ 追加</button>
          </div>
          {items.map((m) => <ItemEditor key={`${m.id}-${m.updated_at}`} item={m} onSaved={load} toast={toast.show} />)}
        </>
      )}
      {toast.node}
    </>
  );
}

function ItemEditor({ item, onSaved, toast }: { item: MenuItem; onSaved: () => Promise<void>; toast: (s: string) => void }) {
  const [v, setV] = useState(item);
  const [dirty, setDirty] = useState(false);
  const [err, setErr] = useState('');
  const set = (p: Partial<MenuItem>) => { setV((x) => ({ ...x, ...p })); setDirty(true); };
  const setTr = (l: (typeof TRANSLATED)[number], p: Partial<Translation>) =>
    set({ translations: { ...v.translations, [l]: { ...v.translations[l], ...p, confirmed: p.confirmed ?? false } } });
  const toggle = (k: string) => set({ allergens: v.allergens.includes(k) ? v.allergens.filter((x) => x !== k) : [...v.allergens, k], allergens_confirmed_at: null });

  const save = async (extra: Partial<MenuItem> = {}) => {
    setErr('');
    const next = { ...v, ...extra };
    const { error } = await sb().from('menu_items').update({
      name_ja: next.name_ja.trim(), description_ja: next.description_ja.trim(), price: next.price, allergens: next.allergens,
      allergens_confirmed_at: next.allergens_confirmed_at, translations: next.translations, active: next.active,
    }).eq('id', item.id);
    if (error) return setErr('保存できませんでした');
    setDirty(false);
    toast('保存しました');
    await onSaved();
  };
  const del = async () => {
    if (!confirm(`「${item.name_ja}」を削除しますか？`)) return;
    await sb().from('menu_items').delete().eq('id', item.id);
    await onSaved();
  };

  return (
    <div className="card step-edit" data-testid="menu-item">
      <div className="grid three">
        <div><label htmlFor={`n-${item.id}`}>料理名（日本語）</label><input id={`n-${item.id}`} type="text" maxLength={40} value={v.name_ja} onChange={(e) => set({ name_ja: e.target.value })} /></div>
        <div><label htmlFor={`d-${item.id}`}>説明（日本語）</label><input id={`d-${item.id}`} type="text" maxLength={120} value={v.description_ja} onChange={(e) => set({ description_ja: e.target.value })} /></div>
        <div><label htmlFor={`p-${item.id}`}>価格（円）</label><input id={`p-${item.id}`} type="text" inputMode="numeric" value={v.price ?? ''} onChange={(e) => set({ price: e.target.value === '' ? null : Number(e.target.value.replace(/\D/g, '')) })} /></div>
      </div>
      <p className="muted">日本語を変えると、翻訳の「確定」は外れます（古い翻訳が表示されないようにするため）。</p>

      <h3 style={{ marginTop: 12 }}>アレルゲン（店主が入力）</h3>
      {[true, false].map((mand) => (
        <fieldset key={String(mand)} style={{ border: 0, padding: 0, margin: '6px 0' }}>
          <legend className="muted">{mand ? '特定原材料（表示義務）8品目' : '特定原材料に準ずるもの（表示推奨）20品目'}</legend>
          <div className="chips">
            {ALLERGENS.filter((a) => a.mandatory === mand).map((a) => (
              <label key={a.key} className={`chip ${v.allergens.includes(a.key) ? 'on' : ''}`} style={{ margin: 0 }}>
                <input type="checkbox" checked={v.allergens.includes(a.key)} onChange={() => toggle(a.key)} data-testid={`al-${a.key}`} />{a.ja}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="row wrap" style={{ marginTop: 6 }}>
        <AllergenBadges keys={v.allergens} lang="ja" />
        {v.allergens_confirmed_at
          ? <span className="tag g">確認済み {fmtShort(v.allergens_confirmed_at)}</span>
          : <button className="btn ghost small" onClick={() => save({ allergens_confirmed_at: new Date().toISOString() })} data-testid="allergen-confirm">この内容で確認した（お客様に表示）</button>}
      </div>

      <h3 style={{ marginTop: 12 }}>翻訳（店主が入力して確定）</h3>
      <div className="grid three">
        {TRANSLATED.map((l) => {
          const t = v.translations[l] ?? {};
          const label = LANGS.find((x) => x.key === l)!.label;
          return (
            <div key={l} className="card" style={{ background: 'var(--bg)' }}>
              <div className="row between"><strong>{label}</strong>{t.confirmed ? <span className="tag g">確定</span> : <span className="tag y">未確定</span>}</div>
              <label htmlFor={`tn-${l}-${item.id}`}>料理名</label>
              <input id={`tn-${l}-${item.id}`} type="text" maxLength={80} value={t.name ?? ''} onChange={(e) => setTr(l, { name: e.target.value })} data-testid={`tr-name-${l}`} />
              <label htmlFor={`td-${l}-${item.id}`}>説明</label>
              <input id={`td-${l}-${item.id}`} type="text" maxLength={200} value={t.description ?? ''} onChange={(e) => setTr(l, { description: e.target.value })} />
              {!t.confirmed && (
                <button className="btn ghost small block" style={{ marginTop: 6 }} disabled={!t.name?.trim()} onClick={() => save({ translations: { ...v.translations, [l]: { ...t, confirmed: true } } })} data-testid={`tr-confirm-${l}`}>
                  内容を確認して確定
                </button>
              )}
            </div>
          );
        })}
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row wrap" style={{ marginTop: 10 }}>
        <label className="chip" style={{ margin: 0 }}><input type="checkbox" checked={v.active} onChange={(e) => set({ active: e.target.checked })} />お客様向けに表示する</label>
        <button className="btn" onClick={() => save()} disabled={!dirty} data-testid="menu-save">保存</button>
        <button className="btn ghost small" onClick={del}>削除</button>
      </div>
    </div>
  );
}
