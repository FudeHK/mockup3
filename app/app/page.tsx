'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sb, supabaseConfigured } from '@/lib/supabase';
import { deviceId } from '@/lib/device';
import { useSession } from '@/lib/session';

type JoinResult = { ok: boolean; role?: 'admin' | 'staff'; reason?: string; remaining?: number; locked_until?: string };

export default function LoginPage() {
  const router = useRouter();
  const { me, loading, refresh } = useSession();
  const [code, setCode] = useState(process.env.NEXT_PUBLIC_DEFAULT_STORE_CODE || '');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const last = localStorage.getItem('shopnavi-store-code');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 前回の店舗コードを復元
    if (last) setCode(last);
  }, []);

  useEffect(() => {
    if (!loading && me) router.replace(me.role === 'admin' ? '/admin' : me.aliasId ? '/staff' : '/staff/alias');
  }, [loading, me, router]);

  if (!supabaseConfigured()) {
    return (
      <div className="login">
        <div className="card alert">
          <h1>設定が必要です</h1>
          <p>環境変数 NEXT_PUBLIC_SUPABASE_URL と NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください（README 参照）。</p>
        </div>
      </div>
    );
  }

  const press = (d: string) => {
    setMsg('');
    setPin((p) => (p.length >= 8 ? p : p + d));
  };

  const submit = async () => {
    if (busy) return;
    if (!code.trim()) return setMsg('店舗コードを入力してください');
    if (pin.length < 4) return setMsg('PINを入力してください');
    setBusy(true);
    setMsg('');
    try {
      const client = sb();
      const { data: s } = await client.auth.getSession();
      if (!s.session) {
        const { error } = await client.auth.signInAnonymously();
        if (error) throw error;
      }
      const { data, error } = await client.rpc('join_store', {
        p_store_code: code.trim().toLowerCase(),
        p_pin: pin,
        p_device_id: deviceId(),
      });
      if (error) throw error;
      const r = data as JoinResult;
      if (!r.ok) {
        setPin('');
        if (r.reason === 'locked' || r.reason === 'store_locked') {
          const t = r.locked_until ? new Date(r.locked_until).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '';
          setMsg(`入力を5回まちがえたため、${t ? `${t}まで` : '15分間'}入力できません。`);
        } else {
          setMsg(`店舗コードかPINがちがいます（あと${r.remaining ?? 0}回まちがえると15分ロック）`);
        }
        return;
      }
      localStorage.setItem('shopnavi-store-code', code.trim().toLowerCase());
      const m = await refresh();
      router.replace(m?.role === 'admin' ? '/admin' : '/staff/alias');
    } catch (e) {
      setMsg(`通信エラー：${(e as Error).message || '時間をおいて再度お試しください'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div>
        <div className="row" style={{ marginBottom: 8 }}>
          <span className="logo" aria-hidden>SN</span>
          <h1 style={{ margin: 0 }}>ShopNavi</h1>
        </div>
        <p className="lead">お店の作業マニュアル。店舗コードと PIN で入室します。</p>
        <div className="card">
          <label htmlFor="code">店舗コード</label>
          <input id="code" type="text" autoCapitalize="none" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} placeholder="例：demo" />
          <p className="muted">管理者PIN・スタッフPINのどちらでも入れます。名前や電話番号は保存しません。</p>
        </div>
      </div>
      <div className="card">
        <label htmlFor="pin">PIN（数字）</label>
        <input
          id="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          aria-describedby="pin-msg"
        />
        <div className="pin-dots" aria-hidden>
          {Array.from({ length: Math.max(6, pin.length) }).map((_, i) => (
            <span key={i} className={i < pin.length ? 'on' : ''} />
          ))}
        </div>
        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button key={d} type="button" onClick={() => press(d)} aria-label={`数字${d}`}>{d}</button>
          ))}
          <button type="button" onClick={() => setPin('')} aria-label="全部消す" style={{ fontSize: '1rem' }}>クリア</button>
          <button type="button" onClick={() => press('0')} aria-label="数字0">0</button>
          <button type="button" onClick={() => setPin((p) => p.slice(0, -1))} aria-label="1文字消す" style={{ fontSize: '1rem' }}>←</button>
        </div>
        <p id="pin-msg" className="err" role="alert" style={{ minHeight: '1.6em' }}>{msg}</p>
        <button className="btn big block" onClick={submit} disabled={busy}>{busy ? '確認中…' : '入室する'}</button>
      </div>
    </div>
  );
}
