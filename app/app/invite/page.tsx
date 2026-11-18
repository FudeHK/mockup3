'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sb, supabaseConfigured } from '@/lib/supabase';
import { useSession } from '@/lib/session';
import { resetFeatureCache } from '@/lib/features';
import { STORE_CODE_RE, tokenFromHash, weakPin } from '@/lib/v2/invite';

const REASON: Record<string, string> = {
  invalid_token: 'この招待リンクは使えません（期限切れ・使用済み・取り消し）。招待した方に新しいリンクをお願いしてください',
  code_format: '店舗コードは半角の小文字英数字とハイフンで3〜32文字にしてください',
  name_format: '店舗名は1〜40文字にしてください',
  pin_format: 'PINは6〜8桁の数字にしてください',
  same_pin: '管理者PINとスタッフPINは別の番号にしてください',
  code_taken: 'この店舗コードはすでに使われています。別のコードにしてください',
};

export default function InvitePage() {
  const router = useRouter();
  const { refresh } = useSession();
  const [token, setToken] = useState('');
  const [f, setF] = useState({ name: '', code: '', admin: '', admin2: '', staff: '', staff2: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- URL の # からトークンを読む
    setToken(tokenFromHash(location.hash));
    // トークンを履歴・画面共有に残さない
    history.replaceState(null, '', '/invite');
  }, []);

  const submit = async () => {
    setErr('');
    if (!STORE_CODE_RE.test(f.code)) return setErr(REASON.code_format);
    if (!f.name.trim()) return setErr(REASON.name_format);
    if (f.admin !== f.admin2 || f.staff !== f.staff2) return setErr('確認用のPINが一致しません');
    if (weakPin(f.admin) || weakPin(f.staff)) return setErr('PINは6〜8桁で、同じ数字の繰り返しや連番（123456 など）は避けてください');
    if (f.admin === f.staff) return setErr(REASON.same_pin);
    setBusy(true);
    try {
      const c = sb();
      const { data: s } = await c.auth.getSession();
      if (!s.session) {
        const { error } = await c.auth.signInAnonymously();
        if (error) throw error;
      }
      const { data, error } = await c.rpc('create_store_from_invite', {
        p_token: token, p_store_code: f.code, p_store_name: f.name.trim(), p_admin_pin: f.admin, p_staff_pin: f.staff,
      });
      if (error) throw error;
      if (!data?.ok) return setErr(REASON[data?.reason] ?? '作成できませんでした');
      localStorage.setItem('shopnavi-store-code', f.code);
      resetFeatureCache();
      await refresh();
      router.replace('/admin');
    } catch (e) {
      setErr(`通信エラー：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (!supabaseConfigured()) return <div className="login"><p>設定が必要です。</p></div>;
  const inp = (k: keyof typeof f, label: string, type = 'text', extra: Record<string, string | number> = {}) => (
    <div>
      <label htmlFor={`i-${k}`}>{label}</label>
      <input id={`i-${k}`} type={type} value={f[k]} onChange={(e) => setF((v) => ({ ...v, [k]: type === 'password' ? e.target.value.replace(/\D/g, '') : e.target.value }))} {...extra} />
    </div>
  );

  return (
    <div className="login" style={{ display: 'block', maxWidth: 640 }}>
      <div className="row" style={{ marginBottom: 8 }}><span className="logo" aria-hidden>SN</span><h1 style={{ margin: 0 }}>ShopNavi に招待されました</h1></div>
      {!token ? (
        <div className="card alert" role="alert">招待リンクが正しくありません。届いたリンクをそのまま開いてください。</div>
      ) : (
        <div className="card">
          <p className="lead">新しい店舗を作ります。名前や電話番号は入力しません。</p>
          {inp('name', '店舗名（40文字まで）', 'text', { maxLength: 40 })}
          {inp('code', '店舗コード（ログインで使います。半角小文字英数字とハイフン）', 'text', { maxLength: 32, autoCapitalize: 'none', autoComplete: 'off' })}
          <div className="grid two">
            {inp('admin', '管理者PIN（6〜8桁）', 'password', { inputMode: 'numeric', maxLength: 8, autoComplete: 'new-password' })}
            {inp('admin2', '管理者PIN（確認）', 'password', { inputMode: 'numeric', maxLength: 8, autoComplete: 'new-password' })}
            {inp('staff', 'スタッフPIN（6〜8桁）', 'password', { inputMode: 'numeric', maxLength: 8, autoComplete: 'new-password' })}
            {inp('staff2', 'スタッフPIN（確認）', 'password', { inputMode: 'numeric', maxLength: 8, autoComplete: 'new-password' })}
          </div>
          {err && <p className="err" role="alert">{err}</p>}
          <button className="btn big block green" style={{ marginTop: 14 }} onClick={submit} disabled={busy} data-testid="invite-submit">{busy ? '作成中…' : '店舗を作って始める'}</button>
          <p className="muted">PINは暗号化（ハッシュ化）して保存され、元の番号はだれにも表示されません。忘れないよう控えてください。</p>
        </div>
      )}
    </div>
  );
}
