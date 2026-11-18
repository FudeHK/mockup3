'use client';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { useFeatures, type Feature } from '@/lib/features';

export default function MorePage() {
  return (
    <Shell role="admin">
      <More />
    </Shell>
  );
}

const ITEMS: { f: Feature; href: string; title: string; desc: string }[] = [
  { f: 'promo_image', href: '/admin/promo', title: '広報画像をつくる', desc: 'お店の写真1枚に、店名・メニュー・一言を載せた画像を3案つくります' },
  { f: 'menu_i18n', href: '/admin/menu', title: 'メニュー表（多言語・アレルゲン）', desc: 'メニューに英語・中国語・韓国語の表示とアレルゲンの表示をつけます' },
  { f: 'staff_profile', href: '/admin/profiles', title: 'スタッフの希望（自己申告）', desc: 'スタッフ本人が公開に同意した項目だけを見られます' },
  { f: 'template_share', href: '/admin/share', title: 'テンプレートの共有', desc: 'マニュアルを写真・個人情報を除いたテンプレートとして書き出し・取り込み' },
  { f: 'invite', href: '/admin/share#invite', title: '招待リンク', desc: '知り合いのお店を招待し、新しい店舗として始めてもらえます' },
];

function More() {
  const { has, ready } = useFeatures();
  const list = ITEMS.filter((i) => has(i.f));
  return (
    <>
      <h1>その他の機能</h1>
      <p className="lead">お試し中の機能です。この店舗で有効になっているものだけを表示しています。</p>
      {has('voice_input') && <div className="card"><strong>🎤 音声でマニュアル作成</strong><p className="muted">マニュアルの編集画面で、工程ごとに「音声で入力」ボタンが使えます。</p></div>}
      {!ready && <p className="muted">読み込み中…</p>}
      {ready && list.length === 0 && !has('voice_input') && <p className="muted">この店舗で有効な機能はありません。</p>}
      <div className="grid two">
        {list.map((i) => (
          <Link key={i.href} href={i.href} className="card" style={{ textDecoration: 'none' }}>
            <h3>{i.title}</h3>
            <p className="muted">{i.desc}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
