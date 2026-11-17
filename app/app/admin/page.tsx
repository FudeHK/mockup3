'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { sb } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { fmtDuration, fmtShort } from '@/lib/format';
import type { Manual } from '@/lib/types';

export default function AdminHome() {
  return (
    <Shell role="admin">
      <ManualList />
    </Shell>
  );
}

function ManualList() {
  const { me } = useSession();
  const [list, setList] = useState<Manual[] | null>(null);
  const [open, setOpen] = useState(0);

  useEffect(() => {
    if (!me) return;
    const c = sb();
    void c.from('manuals').select('*').eq('store_id', me.storeId).order('updated_at', { ascending: false })
      .then(({ data }) => setList((data as Manual[]) ?? []));
    void c.from('confusions').select('id').eq('store_id', me.storeId).is('resolved_at', null)
      .then(({ data }) => setOpen(data?.length ?? 0));
  }, [me]);

  return (
    <>
      <div className="row between wrap">
        <h1>マニュアル</h1>
        <Link className="btn" href="/admin/manuals/new">＋ 新しく作る</Link>
      </div>
      {open > 0 && (
        <Link href="/admin/confusions" className="card alert list-item" style={{ textDecoration: 'none' }}>
          <strong>🙋 未対応の「わからない」が {open} 件あります</strong>
          <span className="tag r">確認する</span>
        </Link>
      )}
      {list === null && <p className="muted">読み込み中…</p>}
      {list?.length === 0 && <p className="card">まだマニュアルがありません。「新しく作る」から始めましょう。</p>}
      <div className="grid two">
        {list?.map((m) => (
          <div key={m.id} className="card" data-testid="admin-manual">
            <div className="row between">
              <h3 className="grow" style={{ fontSize: '1.1rem' }}>{m.title}</h3>
              {m.status === 'published' ? <span className="tag g">公開中 第{m.version}版</span> : <span className="tag y">下書き</span>}
            </div>
            <p className="muted">
              {m.published_at ? `公開 ${fmtShort(m.published_at)}` : `作成開始 ${fmtShort(m.draft_started_at)}`}
              {' ・ 作成時間 '}{fmtDuration(m.creation_seconds)}
              {m.status === 'published' && m.has_unpublished_changes && ' ・ 未公開の変更あり'}
            </p>
            <div className="row wrap" style={{ marginTop: 8 }}>
              <Link className="btn small" href={`/admin/manuals/${m.id}`}>編集</Link>
              <Link className="btn ghost small" href={`/admin/manuals/${m.id}/quiz`}>クイズ</Link>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
