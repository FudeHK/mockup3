'use client';
import Link from 'next/link';
import { Shell } from '@/components/Shell';
import { MenuBoard } from '@/components/MenuBoard';
import { useFeatures } from '@/lib/features';

export default function StaffMenuPage() {
  return (
    <Shell role="staff">
      <Inner />
    </Shell>
  );
}

function Inner() {
  const { has, ready } = useFeatures();
  if (ready && !has('menu_i18n')) return <p className="muted">この店舗では使えない機能です。</p>;
  return (
    <>
      <p><Link href="/staff">← マニュアル一覧へ</Link></p>
      <h1>メニュー表 / Menu</h1>
      <MenuBoard />
    </>
  );
}
