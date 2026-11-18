'use client';
import { useEffect, useRef, useState } from 'react';
import { Shell } from '@/components/Shell';
import { useSession } from '@/lib/session';
import { useFeatures } from '@/lib/features';
import { shrinkImage } from '@/lib/image';
import { SIZES, TEMPLATES, expressionWarnings, type PromoText } from '@/lib/v2/promo';
import { drawPromo } from '@/lib/v2/promoDraw';

export default function PromoPage() {
  return (
    <Shell role="admin">
      <Promo />
    </Shell>
  );
}

function Promo() {
  const { me } = useSession();
  const { has, ready } = useFeatures();
  const [img, setImg] = useState<ImageBitmap | null>(null);
  const [text, setText] = useState<PromoText>({ shop: me?.storeName ?? '', menu: '', copy: '' });
  const [size, setSize] = useState(SIZES[0].key);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const canvases = useRef<(HTMLCanvasElement | null)[]>([]);
  const S = SIZES.find((s) => s.key === size)!;

  useEffect(() => {
    TEMPLATES.forEach((t, i) => {
      const c = canvases.current[i];
      if (c) drawPromo(c, img, t.key, S.w, S.h, text);
    });
  }, [img, text, S.w, S.h]);

  useEffect(() => () => img?.close(), [img]);

  if (ready && !has('promo_image')) return <p className="muted">この店舗では使えない機能です。</p>;

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setErr('');
    setBusy(true);
    try {
      // 端末で再エンコードして EXIF（位置情報など）を取り除く。サーバーには送らない
      const blob = await shrinkImage(file, 2048, 0.9);
      setImg(await createImageBitmap(blob));
    } catch (e) {
      setErr((e as Error).message || '写真を読み込めませんでした');
    } finally {
      setBusy(false);
    }
  };

  const download = (i: number) => {
    const c = canvases.current[i];
    if (!c) return;
    c.toBlob((b) => {
      if (!b) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `promo_${'ABC'[i]}_${S.w}x${S.h}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, 'image/jpeg', 0.9);
  };

  const warns = expressionWarnings(`${text.shop} ${text.menu} ${text.copy}`);
  const field = (k: keyof PromoText, label: string, max: number, ph: string) => (
    <div>
      <label htmlFor={`p-${k}`}>{label} <span className="muted">{text[k].length}/{max}</span></label>
      <input id={`p-${k}`} type="text" maxLength={max} value={text[k]} placeholder={ph} onChange={(e) => setText((t) => ({ ...t, [k]: e.target.value }))} />
    </div>
  );

  return (
    <>
      <h1>広報画像をつくる</h1>
      <p className="lead">お店の写真1枚に、店名・メニュー・一言を載せた画像を3案つくります。</p>
      <div className="card">
        <ul className="muted" style={{ margin: 0, paddingLeft: '1.2em' }}>
          <li>AIによる画像生成は使いません。写真はそのまま使い、文字は決まった型（テンプレート）に流し込みます。</li>
          <li>写真は端末の中で縮小・再保存し、位置情報などの EXIF を取り除きます。写真はサーバーに送信・保存しません。</li>
          <li>文字は端末に入っている標準の書体で描きます（ライセンス不明のフォントや素材は使いません）。</li>
          <li>公開前に、内容（価格・表現など）を必ずご自身で確認してください。</li>
        </ul>
      </div>
      <div className="card">
        <label className="btn ghost file-btn" style={{ position: 'relative' }}>
          📷 {img ? '写真を変える' : 'お店の写真を1枚選ぶ'}
          <input type="file" accept="image/*" data-testid="promo-photo" onChange={(e) => onPhoto(e.target.files?.[0])} />
        </label>
        {busy && <span className="muted" role="status"> 読み込み中…</span>}
        {img && <span className="tag g" data-testid="promo-photo-ok" style={{ marginLeft: 8 }}>写真OK（位置情報は削除済み）</span>}
        {err && <p className="err" role="alert">{err}</p>}
        <div className="grid three" style={{ marginTop: 8 }}>
          {field('shop', '店名', 20, '例：デモ食堂')}
          {field('menu', 'メニュー', 24, '例：旬の刺身盛り合わせ')}
          {field('copy', '一言', 40, '例：今週だけの限定です')}
        </div>
        {warns.length > 0 && (
          <div className="card alert" role="alert" data-testid="promo-warn" style={{ marginTop: 10 }}>
            <strong>表現にご注意ください：{warns.join('、')}</strong>
            <p>根拠を示せない「日本一」「絶対」「最安」などの言い切りは、景品表示法（優良誤認・有利誤認）に触れるおそれがあります。根拠のある表現に言い換えるか、削除してください。</p>
            <p className="muted">参考表示です。最終判断はご自身で行ってください。</p>
          </div>
        )}
        <label htmlFor="p-size">サイズ</label>
        <select id="p-size" value={size} onChange={(e) => setSize(e.target.value)}>
          {SIZES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </div>
      <div className="grid three">
        {TEMPLATES.map((t, i) => (
          <div key={t.key} className="card" data-testid="promo-candidate">
            <h3>{t.name}</h3>
            <canvas ref={(el) => { canvases.current[i] = el; }} className="promo-canvas" aria-label={`${t.name}のプレビュー`} />
            <button className="btn block" style={{ marginTop: 8 }} onClick={() => download(i)} disabled={!img} data-testid={`promo-download-${i}`}>
              ⬇ 画像を保存（JPEG）
            </button>
          </div>
        ))}
      </div>
      {!img && <p className="muted">写真を選ぶと保存できるようになります。</p>}
    </>
  );
}
