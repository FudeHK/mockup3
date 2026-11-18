'use client';
import { FONT_STACK, TEMPLATES, coverCrop, layout, wrapLines, type PromoText, type Rect, type TemplateKey } from './promo';

function roundRect(ctx: CanvasRenderingContext2D, r: Rect, rad: number) {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, rad);
}

function drawPhoto(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, box: Rect, rad: number) {
  ctx.save();
  roundRect(ctx, box, rad);
  ctx.clip();
  const c = coverCrop(img.width, img.height, box);
  ctx.drawImage(img, c.x, c.y, c.w, c.h, box.x, box.y, box.w, box.h);
  ctx.restore();
}

/** 文字ブロック（メニュー名を大きく、一言・店名を続ける）。枠からはみ出さないよう縮小する */
function drawText(ctx: CanvasRenderingContext2D, box: Rect, t: PromoText, ink: string, accent: string, onDark: boolean) {
  const base = Math.min(box.w / 9, box.h / 4.2);
  const items: { text: string; size: number; weight: number; color: string; lines: number; gap: number }[] = [
    { text: t.menu, size: base * 1.25, weight: 800, color: onDark ? '#ffffff' : accent, lines: 2, gap: 0.35 },
    { text: t.copy, size: base * 0.72, weight: 700, color: ink, lines: 3, gap: 0.45 },
    { text: t.shop, size: base * 0.62, weight: 700, color: ink, lines: 1, gap: 0 },
  ].filter((i) => i.text.trim());
  let scale = 1;
  let blocks: { lines: string[]; size: number; weight: number; color: string; gap: number }[] = [];
  for (let k = 0; k < 8; k++) {
    blocks = items.map((i) => {
      const size = i.size * scale;
      ctx.font = `${i.weight} ${size}px ${FONT_STACK}`;
      return { lines: wrapLines(i.text, box.w, (s) => ctx.measureText(s).width, i.lines), size, weight: i.weight, color: i.color, gap: i.gap };
    });
    const h = blocks.reduce((a, b) => a + b.lines.length * b.size * 1.3 + b.gap * b.size, 0);
    if (h <= box.h) break;
    scale *= 0.88;
  }
  const total = blocks.reduce((a, b) => a + b.lines.length * b.size * 1.3 + b.gap * b.size, 0);
  let y = box.y + Math.max(0, (box.h - total) / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const b of blocks) {
    ctx.font = `${b.weight} ${b.size}px ${FONT_STACK}`;
    ctx.fillStyle = b.color;
    for (const line of b.lines) {
      ctx.fillText(line, box.x + box.w / 2, y + b.size * 0.12);
      y += b.size * 1.3;
    }
    y += b.gap * b.size;
  }
}

/** 1案を描く */
export function drawPromo(canvas: HTMLCanvasElement, img: (CanvasImageSource & { width: number; height: number }) | null, key: TemplateKey, W: number, H: number, text: PromoText) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const tpl = TEMPLATES.find((t) => t.key === key)!;
  const l = layout(key, W, H);
  ctx.fillStyle = tpl.bg;
  ctx.fillRect(0, 0, W, H);
  const rad = Math.min(W, H) * 0.03;
  if (img) drawPhoto(ctx, img, l.photo, key === 'frame' ? rad : 0);
  else {
    ctx.fillStyle = '#d9c4a0';
    ctx.fillRect(l.photo.x, l.photo.y, l.photo.w, l.photo.h);
  }
  if (key === 'frame') {
    ctx.strokeStyle = tpl.accent;
    ctx.lineWidth = Math.max(4, W * 0.008);
    roundRect(ctx, l.photo, rad);
    ctx.stroke();
    drawText(ctx, l.text, text, tpl.ink, tpl.accent, false);
  } else if (key === 'band') {
    ctx.fillStyle = tpl.accent;
    ctx.fillRect(l.panel!.x, l.panel!.y, l.panel!.w, l.panel!.h);
    drawText(ctx, l.text, text, '#f3e7d3', tpl.accent, true);
  } else {
    ctx.fillStyle = 'rgba(79,143,96,.92)';
    roundRect(ctx, l.panel!, rad);
    ctx.fill();
    drawText(ctx, l.text, text, '#ffffff', tpl.accent, true);
  }
}
