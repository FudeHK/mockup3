'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Shell } from '@/components/Shell';
import { sb } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { useFeatures } from '@/lib/features';
import { fmtShort } from '@/lib/format';

type Row = { id: string; title: string; version: number; published_at: string; status: string };
type Item = Row & { reconfirm: boolean; reconfirmNote: string; unseen: boolean };

export default function StaffHome() {
  return (
    <Shell role="staff">
      <StaffList />
    </Shell>
  );
}

function StaffList() {
  const { me } = useSession();
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    if (!me?.aliasId) return;
    const c = sb();
    void Promise.all([
      c.from('manuals').select('id,title,version,published_at,status').eq('status', 'published').order('published_at', { ascending: false }),
      c.from('reconfirm_requests').select('manual_id,version,note'),
      c.from('manual_acks').select('manual_id,version').eq('alias_id', me.aliasId),
    ]).then(([m, r, a]) => {
      const acks = new Map<string, number>();
      for (const x of (a.data ?? []) as { manual_id: string; version: number }[]) {
        acks.set(x.manual_id, Math.max(acks.get(x.manual_id) ?? 0, x.version));
      }
      const reqs = (r.data ?? []) as { manual_id: string; version: number; note: string }[];
      const list = ((m.data ?? []) as Row[]).map((row) => {
        const acked = acks.get(row.id) ?? 0;
        const req = reqs.find((q) => q.manual_id === row.id && q.version === row.version);
        return { ...row, reconfirm: Boolean(req) && acked < row.version, reconfirmNote: req?.note ?? '', unseen: acked === 0 && !req };
      });
      list.sort((x, y) => Number(y.reconfirm) - Number(x.reconfirm));
      setItems(list);
    });
  }, [me?.aliasId]);

  const pending = items?.filter((i) => i.reconfirm).length ?? 0;
  const features = useFeatures();

  return (
    <>
      <h1>マニュアル</h1>
      <p className="lead">{me?.aliasName}さん、見たいマニュアルを選んでください。</p>
      {pending > 0 && (
        <div className="card alert" role="alert">
          <strong>🔔 再確認のお願いが {pending} 件あります</strong>
          <p>内容が更新されました。もう一度最後まで確認してください。</p>
        </div>
      )}
      {items === null && <p className="muted">読み込み中…</p>}
      {items?.length === 0 && <p className="muted">公開されたマニュアルはまだありません。</p>}
      {(features.has('menu_i18n') || features.has('staff_profile')) && (
        <div className="row wrap" style={{ marginBottom: 12 }}>
          {features.has('menu_i18n') && <Link href="/staff/menu" className="btn ghost small">🍽 メニュー表 / Menu</Link>}
          {features.has('staff_profile') && <Link href="/staff/profile" className="btn ghost small" data-testid="link-profile">🙂 わたしのプロフィール</Link>}
        </div>
      )}
      <div className="grid two">
        {items?.map((m) => (
          <Link key={m.id} href={`/staff/manuals/${m.id}`} className={`card list-item ${m.reconfirm ? 'alert' : ''}`} style={{ textDecoration: 'none' }} data-testid="staff-manual">
            <div className="grow">
              <h3 style={{ fontSize: '1.2rem' }}>{m.title}</h3>
              <p className="muted">第{m.version}版・{fmtShort(m.published_at)} 更新</p>
              {m.reconfirm && m.reconfirmNote && <p className="muted">変更点：{m.reconfirmNote}</p>}
            </div>
            {m.reconfirm ? <span className="tag r">再確認のお願い</span> : m.unseen ? <span className="tag y">未確認</span> : <span className="tag g">確認済み</span>}
          </Link>
        ))}
      </div>
    </>
  );
}
