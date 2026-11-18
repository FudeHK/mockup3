'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useSession } from '@/lib/session';
import { useFeatures } from '@/lib/features';
import type { Role } from '@/lib/types';

const ADMIN_NAV = [
  { href: '/admin', label: 'マニュアル', icon: '📘' },
  { href: '/admin/confusions', label: 'わからない', icon: '🙋' },
  { href: '/admin/logs', label: 'ログ・CSV', icon: '📊' },
  { href: '/admin/settings', label: '設定', icon: '⚙️' },
];

export function Shell({ role, children, wide = false }: { role: Role; children: ReactNode; wide?: boolean }) {
  const { me, loading, logout } = useSession();
  const router = useRouter();
  const path = usePathname();
  const features = useFeatures();
  // v2: 機能フラグが1つでも ON の店舗だけ「その他」を出す（OFF の店舗は従来どおり）
  const v2 = (['voice_input', 'promo_image', 'template_share', 'invite', 'menu_i18n', 'staff_profile'] as const).some((f) => features.has(f));
  const nav = v2 ? [...ADMIN_NAV, { href: '/admin/more', label: 'その他', icon: '✨' }] : ADMIN_NAV;

  useEffect(() => {
    if (loading) return;
    if (!me) router.replace('/');
    else if (me.role !== role) router.replace(me.role === 'admin' ? '/admin' : '/staff');
    else if (role === 'staff' && !me.aliasId && path !== '/staff/alias') router.replace('/staff/alias');
  }, [loading, me, role, router, path]);

  if (loading || !me || me.role !== role) {
    return <div className="center-msg" role="status">読み込み中…</div>;
  }

  const onLogout = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <div className={`shell ${role}`}>
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>SN</span>
          <span className="store">{me.storeName}</span>
          <span className={`tag ${role === 'admin' ? 'b' : 'g'}`}>{role === 'admin' ? '管理者' : me.aliasName ?? 'スタッフ'}</span>
        </div>
        <button className="btn ghost small" onClick={onLogout}>退出</button>
      </header>
      <div className="body">
        {role === 'admin' && (
          <nav className="side" aria-label="管理メニュー">
            {nav.map((n) => {
              const more = ['/admin/more', '/admin/promo', '/admin/share', '/admin/menu', '/admin/profiles'];
              const on = n.href === '/admin' ? path === '/admin' || path.startsWith('/admin/manuals') : n.href === '/admin/more' ? more.some((m) => path.startsWith(m)) : path.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
                  <span aria-hidden>{n.icon}</span>
                  {n.label}
                </Link>
              );
            })}
          </nav>
        )}
        <main className={wide ? 'main wide' : 'main'}>{children}</main>
      </div>
    </div>
  );
}
