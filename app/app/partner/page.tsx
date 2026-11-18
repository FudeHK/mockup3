'use client';
import { useCallback, useEffect, useState } from 'react';
import { sb, supabaseConfigured } from '@/lib/supabase';
import { deviceId } from '@/lib/device';
import { fmtDateTime } from '@/lib/format';

// D. パートナー（卸・酒屋）向け: 取引先の店舗の「集計」だけを表示する（デモ用・架空のデータ）
type Total = { stores?: number; manuals?: number; confusions_30d?: number; retention_pct?: number; avg_manuals?: number; stores_lt_min?: boolean };
type Group = { category: string; stores: number; manuals: number; confusions_30d: number; retention_pct: number };
type Summary = { ok: boolean; partner_name: string; is_demo: boolean; min_group: number; total: Total; groups: Group[]; hidden_groups: number; generated_at: string };

export default function PartnerPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [checking, setChecking] = useState(true);
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: s } = await sb().auth.getSession();
      if (!s.session) return;
      const { data, error } = await sb().rpc('partner_summary');
      if (!error && data?.ok) setSummary(data as Summary);
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    if (!supabaseConfigured()) return;
    void load().finally(() => setChecking(false));
  }, [load]);

  if (!supabaseConfigured()) return <div className="login"><p>設定が必要です。</p></div>;

  const login = async () => {
    setErr('');
    setBusy(true);
    try {
      const c = sb();
      const { data: s } = await c.auth.getSession();
      if (!s.session) {
        const { error } = await c.auth.signInAnonymously();
        if (error) throw error;
      }
      const { data, error } = await c.rpc('join_partner', { p_code: code.trim().toLowerCase(), p_pin: pin, p_device_id: deviceId() });
      if (error) throw error;
      if (!data?.ok) {
        setPin('');
        return setErr(data?.reason === 'locked' ? '5回まちがえたため、15分間入力できません' : `コードかPINがちがいます（あと${data?.remaining ?? 0}回）`);
      }
      await load();
    } catch (e) {
      setErr(`通信エラー：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    const { data } = await sb().auth.getUser();
    if (data.user) await sb().from('partner_members').delete().eq('user_id', data.user.id);
    setSummary(null);
  };

  if (checking) return <div className="center-msg" role="status">読み込み中…</div>;

  if (!summary) {
    return (
      <div className="login" style={{ display: 'block', maxWidth: 520 }}>
        <div className="row" style={{ marginBottom: 8 }}><span className="logo" aria-hidden>SN</span><h1 style={{ margin: 0 }}>パートナー管理画面</h1></div>
        <p className="lead">取引先のお店の導入状況を、集計で確認できます（店舗ごとのデータは表示しません）。</p>
        <div className="card">
          <label htmlFor="pcode">パートナーコード</label>
          <input id="pcode" type="text" autoCapitalize="none" value={code} onChange={(e) => setCode(e.target.value)} placeholder="例：demo-partner" />
          <label htmlFor="ppin">PIN</label>
          <input id="ppin" type="password" inputMode="numeric" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
          {err && <p className="err" role="alert">{err}</p>}
          <button className="btn block big" style={{ marginTop: 12 }} onClick={login} disabled={busy} data-testid="partner-login">{busy ? '確認中…' : '入る'}</button>
        </div>
      </div>
    );
  }

  const t = summary.total;
  return (
    <div className="main" style={{ maxWidth: 1000 }}>
      {summary.is_demo && <div className="fake-banner" data-testid="fake-banner">この画面はデモです。表示しているのはすべて架空のデータです（実在の店舗・企業・数値ではありません）</div>}
      <div className="row between wrap">
        <h1>{summary.partner_name} の取引先の状況</h1>
        <button className="btn ghost small" onClick={logout}>退出</button>
      </div>
      <p className="muted">集計日時 {fmtDateTime(summary.generated_at)}。集計への参加に同意した店舗だけを数えています。店舗ごとの値は表示しません。{summary.min_group}店舗未満の集計は表示しません。</p>
      {t.stores_lt_min ? (
        <div className="card">集計対象の店舗が{summary.min_group}店舗未満のため、表示できません。</div>
      ) : (
        <div className="grid three" data-testid="partner-totals">
          <div className="card"><p className="muted">導入店舗数</p><p className="stat">{t.stores}店</p></div>
          <div className="card"><p className="muted">公開マニュアル数（合計／1店あたり）</p><p className="stat">{t.manuals}本</p><p className="muted">平均 {t.avg_manuals}本</p></div>
          <div className="card"><p className="muted">「わからない」件数（直近30日）</p><p className="stat">{t.confusions_30d}件</p></div>
          <div className="card"><p className="muted">継続率（直近30日に利用のある店舗の割合）</p><p className="stat">{t.retention_pct}%</p></div>
        </div>
      )}
      <h2>業態別</h2>
      <div className="table-wrap">
        <table data-testid="partner-groups">
          <thead><tr><th>業態</th><th>店舗数</th><th>公開マニュアル</th><th>わからない（30日）</th><th>継続率</th></tr></thead>
          <tbody>
            {summary.groups.map((g) => (
              <tr key={g.category}><td>{g.category}</td><td>{g.stores}店</td><td>{g.manuals}本</td><td>{g.confusions_30d}件</td><td>{g.retention_pct}%</td></tr>
            ))}
            {summary.groups.length === 0 && <tr><td colSpan={5} className="muted">表示できる区分はありません</td></tr>}
          </tbody>
        </table>
      </div>
      {summary.hidden_groups > 0 && <p className="muted" data-testid="partner-hidden">{summary.min_group}店舗未満の業態が{summary.hidden_groups}区分あるため、表示していません（合計には含まれます）。</p>}
    </div>
  );
}
