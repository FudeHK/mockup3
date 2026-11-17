// 写真を端末側で縮小し、EXIF（位置情報など）を含まない JPEG に再エンコードする。
// canvas へ描画して書き出すため、元ファイルのメタデータは引き継がれない。
export const MAX_EDGE = 1280;

export async function shrinkImage(file: File, maxEdge = MAX_EDGE, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('画像ファイルを選んでください');
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('画像を処理できませんでした');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
  if (!blob) throw new Error('画像を処理できませんでした');
  return blob;
}
