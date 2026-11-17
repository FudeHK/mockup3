'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Shell } from '@/components/Shell';
import { sb } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { fmtDateTime } from '@/lib/format';
import type { Confusion } from '@/lib/types';

const POLL_MS = 10000;

export default function ConfusionsPage() {
  return (
    <Shell role="admin">
      <ConfusionList />
    </Shell>
  );
}

function ConfusionList() {
  const { me } = useSession();
  const [rows, setRows] = useState<Confusion[] | null>(null);
  const [live, setLive] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const known = useRef<Set<string>>(new Set());
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!me) return;
    let q = sb().from('confusions').select('*').eq('store_id', me.storeId).order('created_at', { ascending: false }).limit(200);
    if (!showResolved) q = q.is('resolved_at', null);
    const { data } = await q;
    const list = (data as Confusion[]) ?? [];
    if (known.current.size) setFresh(new Set(list.filter((r) => !known.current.has(r.id)).map((r) => r.id)));
    list.forEach((r) => known.current.add(r.id));
    setRows(list);
  }, [me, showResolved]);

  useEffect(() => {
    if (!me) return;
    void load();
    // Realtime で即時更新。接続できない環境でも一定間隔で再取得する
    const ch = sb()
      .channel(`confusions-${me.storeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'confusions', filter: `store_id=eq.${me.storeId}` }, () => void load())
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));
    const t = window.setInterval(() => void load(), POLL_MS);
    return () => {
      window.clearInterval(t);
      void sb().removeChannel(ch);
    };
  }, [me, load]);

  const resolve = async (id: string) => {
    await sb().from('confusions').update({ resolved_at: new Date().toISOString() }).eq('id', id);
    await load();
  };

  return (
    <>
      <div className="row between wrap">
        <h1>「わからない」一覧</h1>
        <span className={`tag ${live ? 'g' : 'y'}`} role="status">{live ? '● リアルタイム更新中' : `自動更新（${POLL_MS / 1000}秒ごと）`}</span>
      </div>
      <p className="lead">スタッフが押した「わからない」が届きます。説明したら「対応済み」にしてください。</p>
      <label className="row" style={{ fontWeight: 400 }}>
        <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} style={{ width: 22, height: 22 }} />
        対応済みも表示
      </label>
      {rows === null ? <p className="muted">読み込み中…</p> : rows.length === 0 ? (
        <p className="card">未対応の「わからない」はありません。</p>
      ) : (
        <div className="table-wrap">
          <table data-testid="confusion-table">
            <thead><tr><th>日時</th><th>マニュアル</th><th>工程</th><th>スタッフ</th><th>工程の内容</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={fresh.has(r.id) ? 'new-flash' : ''}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(r.created_at)}</td>
                  <td>{r.manual_title}<br /><span className="muted">第{r.manual_version}版</span></td>
                  <td className="nw">工程{r.step_no}</td>
                  <td className="nw">{r.alias_name || '—'}</td>
                  <td>{r.step_text}</td>
                  <td className="nw">{r.resolved_at ? <span className="tag g">対応済み</span> : <button className="btn small" onClick={() => resolve(r.id)}>対応済み</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
