'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { sb } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import type { Template } from '@/lib/types';

const ICON: Record<string, string> = { open: '🌅', close: '🌙', clean: '🧹', service: '🙇', cook: '🍳', hygiene: '🧼' };

export default function NewManualPage() {
  return (
    <Shell role="admin">
      <NewManual />
    </Shell>
  );
}

function NewManual() {
  const { me } = useSession();
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    void sb().from('templates').select('*').order('sort').then(({ data }) => setTemplates((data as Template[]) ?? []));
  }, []);

  const create = async (t: Template) => {
    if (!me || busy) return;
    setBusy(true);
    setErr('');
    const c = sb();
    const id = crypto.randomUUID();
    // 作成開始時刻（draft_started_at）はサーバー側の now() で記録される
    const { error } = await c.from('manuals').insert({ id, store_id: me.storeId, template_key: t.key, title: `${t.name}の手順` });
    if (error) {
      setBusy(false);
      return setErr('作成できませんでした');
    }
    const steps = t.questions.map((q, i) => ({ id: crypto.randomUUID(), manual_id: id, store_id: me.storeId, position: i + 1, question: q, body: '' }));
    await c.from('manual_steps').insert(steps);
    router.push(`/admin/manuals/${id}`);
  };

  return (
    <>
      <h1>テンプレートを選ぶ</h1>
      <p className="lead">質問に答えるだけで、工程ごとのマニュアルができます。</p>
      <div className="grid three">
        {templates.map((t) => (
          <button key={t.key} className="card" style={{ textAlign: 'left', border: '2px solid var(--line)', cursor: 'pointer', font: 'inherit', color: 'inherit' }} onClick={() => create(t)} disabled={busy} data-testid={`tpl-${t.key}`}>
            <div style={{ fontSize: '2rem' }} aria-hidden>{ICON[t.key] ?? '📘'}</div>
            <h3 style={{ fontSize: '1.2rem' }}>{t.name}</h3>
            <p className="muted">{t.description}（質問{t.questions.length}つ）</p>
          </button>
        ))}
      </div>
      {err && <p className="err">{err}</p>}
    </>
  );
}
