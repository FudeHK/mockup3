// E2E（webapp-testing 方式: Playwright）
// ローカル Postgres + Supabase 互換エミュレーター + Next.js 本番ビルドを起動し、
// タブレット横向き（1024x768）とスマホ（390x844）で一連の流れを自動確認する。
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startDb, DB_URL } from '../local/pg.mjs';
import { startEmulator } from '../local/emulator.mjs';

const { chromium } = createRequire(import.meta.url)('playwright'); // 未導入なら npm i -D playwright
const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '../..');
const SHOTS = path.resolve(appRoot, '../docs/e2e-screenshots');
const APP_PORT = 3100;
const EMU_PORT = 54321;
const BASE = `http://127.0.0.1:${APP_PORT}`;
const ADMIN_PIN = '135790';
const STAFF_PIN = '246802';

const results = [];
function record(name, ok, info = '') {
  results.push({ name, ok, info });
  console.log(`${ok ? '○' : '×'} ${name}${info ? ` — ${info}` : ''}`);
}
async function check(name, fn) {
  try {
    const info = await fn();
    record(name, true, info || '');
    return true;
  } catch (e) {
    record(name, false, (e && e.message ? e.message : String(e)).split('\n')[0]);
    return false;
  }
}

// EXIF（位置情報を模した文字列入り）付き JPEG を作る
async function makeExifJpeg(browser, file) {
  const p = await browser.newPage({ viewport: { width: 2000, height: 1500 } });
  await p.setContent('<body style="margin:0;background:linear-gradient(135deg,#e8743b,#4f8f60)"><h1 style="font-size:200px;color:#fff;margin:300px">閉店</h1></body>');
  const jpg = await p.screenshot({ type: 'jpeg', quality: 80 });
  await p.close();
  const marker = Buffer.from('GPS-SECRET-35.6812N-139.7671E\0');
  const tiff = Buffer.concat([Buffer.from('MM\0*\0\0\0\x08', 'binary'), Buffer.from([0, 0, 0, 0, 0, 0]), marker]);
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
  const len = Buffer.alloc(2);
  len.writeUInt16BE(payload.length + 2);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), len, payload]);
  fs.writeFileSync(file, Buffer.concat([jpg.subarray(0, 2), app1, jpg.subarray(2)]));
}

function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const m = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}

async function pinLogin(page, pin) {
  await page.goto(`${BASE}/`);
  await page.getByLabel('店舗コード').fill('demo');
  for (const d of pin) await page.getByRole('button', { name: `数字${d}`, exact: true }).click();
  await page.getByRole('button', { name: '入室する' }).click();
}

async function flow(browser, emu, vp) {
  const dir = path.join(SHOTS, vp.name);
  fs.mkdirSync(dir, { recursive: true });
  let n = 0;
  const shot = async (page, label) => page.screenshot({ path: path.join(dir, `${String(++n).padStart(2, '0')}-${label}.png`), fullPage: false });
  const title = `閉店手順（${vp.label}）`;
  const ctxOpts = { viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, locale: 'ja-JP', timezoneId: 'Asia/Tokyo', hasTouch: vp.touch, isMobile: vp.touch, acceptDownloads: true };
  const adminCtx = await browser.newContext(ctxOpts);
  const staffCtx = await browser.newContext(ctxOpts);
  const admin = await adminCtx.newPage();
  const staff = await staffCtx.newPage();
  const errors = [];
  for (const p of [admin, staff]) p.on('pageerror', (e) => errors.push(e.message));
  const P = `[${vp.label}]`;
  let manualUrl = '';

  await check(`${P} 管理者でログイン`, async () => {
    await pinLogin(admin, ADMIN_PIN);
    await admin.waitForURL(`${BASE}/admin`);
    await admin.getByRole('heading', { name: 'マニュアル' }).waitFor();
    await shot(admin, 'admin-login');
  });

  await check(`${P} マニュアル作成（テンプレート→質問に回答→写真）`, async () => {
    await admin.getByRole('link', { name: '＋ 新しく作る' }).click();
    await admin.getByTestId('tpl-close').click();
    await admin.waitForURL(/\/admin\/manuals\/[0-9a-f-]{36}$/);
    manualUrl = admin.url();
    await admin.getByLabel('タイトル').fill(title);
    const steps = admin.getByTestId('step-edit');
    if ((await steps.count()) !== 5) throw new Error(`工程数 ${await steps.count()}`);
    const bodies = ['閉店30分前にラストオーダーを伝える', '+αの片付け：レジを締めて、売上をノートに書く', 'テーブルと椅子をふく', '', ''];
    for (let i = 0; i < bodies.length; i++) if (bodies[i]) await steps.nth(i).locator('textarea').fill(bodies[i]);
    const fixture = path.join(appRoot, 'test-results', 'exif-photo.jpg');
    fs.mkdirSync(path.dirname(fixture), { recursive: true });
    await makeExifJpeg(browser, fixture);
    await steps.nth(0).getByTestId('photo-input').setInputFiles(fixture);
    await admin.getByText('写真を追加しました').waitFor();
    await steps.nth(0).locator('img.photo-thumb').waitFor();
    await shot(admin, 'admin-edit');
  });

  await check(`${P} 写真は縮小・EXIF削除のうえ非公開Storageに保存`, async () => {
    const bucketDir = path.join(emu.storageDir, 'manual-photos');
    const files = [];
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.jpg') && files.push(path.join(d, e.name))));
    walk(bucketDir);
    const latest = files.map((f) => [f, fs.statSync(f).mtimeMs]).sort((a, b) => b[1] - a[1])[0][0];
    const buf = fs.readFileSync(latest);
    if (buf.includes(Buffer.from('Exif'))) throw new Error('EXIF が残っている');
    if (buf.includes(Buffer.from('GPS-SECRET'))) throw new Error('位置情報が残っている');
    const s = jpegSize(buf);
    if (!s || Math.max(s.w, s.h) > 1280) throw new Error(`サイズ ${JSON.stringify(s)}`);
    const orig = fs.statSync(path.join(appRoot, 'test-results', 'exif-photo.jpg')).size;
    // 非公開: 署名なしURLでは取得できない
    const r = await fetch(`${emu.url}/storage/v1/object/public/manual-photos/${path.relative(bucketDir, latest)}`);
    if (r.ok) throw new Error('公開URLで取得できてしまう');
    return `${s.w}x${s.h}px, ${orig}B→${buf.length}B, EXIFなし`;
  });

  await check(`${P} 公開（作成時間を自動記録）`, async () => {
    await admin.getByTestId('publish').click();
    await admin.getByText(/公開しました（作成時間/).waitFor();
    await admin.getByText('公開中 第1版').first().waitFor();
    await shot(admin, 'admin-published');
  });

  await check(`${P} クイズ作成（管理者）`, async () => {
    await admin.goto(`${manualUrl}/quiz`);
    await admin.getByLabel('もとにする工程').selectOption({ index: 2 });
    await admin.getByLabel('問題文').fill('レジを締めたあと、何をしますか？');
    await admin.getByLabel('選択肢2', { exact: true }).fill('そのまま帰る');
    await admin.getByLabel('選択肢3', { exact: true }).fill('レジを開けたままにする');
    await admin.getByTestId('add-question').click();
    await admin.getByText('問題一覧（1問）').waitFor();
    await shot(admin, 'admin-quiz');
  });

  const manualId = manualUrl.split('/').pop();

  await check(`${P} スタッフでログイン・仮名を選択`, async () => {
    await pinLogin(staff, STAFF_PIN);
    await staff.waitForURL(`${BASE}/staff/alias`);
    await shot(staff, 'staff-alias');
    await staff.getByRole('button', { name: vp.alias }).click();
    await staff.waitForURL(`${BASE}/staff`);
    await staff.getByText(title).waitFor();
    await shot(staff, 'staff-list');
  });

  await check(`${P} 閲覧（1工程ずつ大きな文字）`, async () => {
    await staff.getByText(title).click();
    await staff.waitForURL(`${BASE}/staff/manuals/${manualId}`);
    await staff.getByText('工程 1 / 3').waitFor();
    await staff.locator('.step-photo img').waitFor();
    const fs1 = await staff.getByTestId('step-text').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    if (fs1 < 24) throw new Error(`文字サイズ ${fs1}px`);
    // 横スクロールが出ないこと
    const over = await staff.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (over > 1) throw new Error(`横にはみ出し ${over}px`);
    await shot(staff, 'staff-viewer-step1');
    return `本文 ${fs1}px`;
  });

  await check(`${P} 音声読み上げ（非対応なら無効化と理由表示）`, async () => {
    const btn = staff.getByRole('button', { name: /読み上げ|停止/ });
    await staff.waitForTimeout(2300);
    const disabled = await btn.isDisabled();
    if (disabled) {
      const note = await staff.locator('#speech-note').innerText();
      if (!note.includes('読み上げを使えません')) throw new Error('理由が表示されない');
      return `この環境は非対応→無効化: ${note.replace('🔇 ', '')}`;
    }
    return '対応端末→有効';
  });

  await check(`${P} 「わからない」を押す`, async () => {
    await staff.getByRole('button', { name: '次へ →' }).click();
    await staff.getByText('工程 2 / 3').waitFor();
    await staff.getByTestId('unknown').click();
    await staff.getByText('「わからない」を管理者に伝えました').waitFor();
    await shot(staff, 'staff-unknown');
  });

  await check(`${P} 管理者の一覧に表示（マニュアル・工程・スタッフ・日時）`, async () => {
    await admin.goto(`${BASE}/admin/confusions`);
    const row = admin.getByTestId('confusion-table').locator('tr', { hasText: title });
    await row.first().waitFor({ timeout: 15000 });
    const t = await row.first().innerText();
    for (const s of ['工程2', vp.alias, 'レジを締めて']) if (!t.includes(s)) throw new Error(`表示に「${s}」がない: ${t}`);
    if (!/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(t)) throw new Error('日時がない');
    await shot(admin, 'admin-confusions');
  });

  await check(`${P} 最後まで確認→クイズに回答（正答率を保存）`, async () => {
    await staff.getByRole('button', { name: '次へ →' }).click();
    await staff.getByRole('button', { name: '確認しました ✓' }).click();
    await staff.getByText('最後まで確認しました').waitFor();
    await staff.getByRole('link', { name: '理解度クイズに答える' }).click();
    await staff.getByText('+αの片付け：レジを締めて、売上をノートに書く').click();
    await staff.getByRole('button', { name: '答え合わせ' }).click();
    const score = await staff.getByTestId('quiz-score').innerText();
    if (!score.includes('1 / 1')) throw new Error(score);
    await shot(staff, 'staff-quiz-result');
    return score;
  });

  await check(`${P} 更新公開でスタッフに再確認依頼が目立って表示`, async () => {
    await admin.goto(manualUrl);
    await admin.getByTestId('step-edit').nth(1).locator('textarea').fill('レジを締めて、売上と現金をノートに書く');
    await admin.getByLabel(/変更点のメモ/).fill('現金も記録するよう変更');
    await admin.getByTestId('publish').click();
    await admin.getByText(/第2版を公開し/).waitFor();
    await staff.goto(`${BASE}/staff`);
    await staff.getByText(/再確認のお願いが \d+ 件/).waitFor();
    await staff.locator('[data-testid=staff-manual].alert', { hasText: title }).waitFor();
    await shot(staff, 'staff-reconfirm');
  });

  await check(`${P} CSV出力（BOM付きUTF-8・数式無害化・全種別）`, async () => {
    await admin.goto(`${BASE}/admin/logs`);
    const [dl] = await Promise.all([admin.waitForEvent('download'), admin.getByTestId('export-csv').click()]);
    const file = path.join(appRoot, 'test-results', `log-${vp.name}.csv`);
    await dl.saveAs(file);
    const buf = fs.readFileSync(file);
    if (!(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf)) throw new Error('BOM なし');
    const text = buf.toString('utf8');
    for (const s of ['マニュアル公開', '閲覧開始', '閲覧終了', '工程閲覧', 'わからない', 'クイズ結果', title, vp.alias]) {
      if (!text.includes(s)) throw new Error(`「${s}」がない`);
    }
    if (!text.includes(`"'+αの片付け：レジを締めて`)) throw new Error('先頭 + の値が無害化されていない');
    if (/(^|,)"[=+\-@]/m.test(text.slice(1))) throw new Error('先頭が記号のセルがある');
    await admin.getByText(/件を出力しました/).waitFor();
    await shot(admin, 'admin-csv');
    return `${dl.suggestedFilename()} ${text.split('\r\n').length - 2}行`;
  });

  await check(`${P} 画面のJSエラーなし`, async () => {
    if (errors.length) throw new Error(errors.join(' / '));
  });

  await adminCtx.close();
  await staffCtx.close();
}

async function main() {
  console.log('DB 初期化…');
  startDb({ reset: true });
  const emu = await startEmulator({ port: EMU_PORT, dbUrl: DB_URL });
  const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: emu.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: emu.anonKey, NEXT_PUBLIC_DEFAULT_STORE_CODE: 'demo', NEXT_TELEMETRY_DISABLED: '1' };
  if (!process.env.SKIP_BUILD) {
    console.log('next build…');
    execFileSync('npx', ['next', 'build'], { cwd: appRoot, env, stdio: 'ignore' });
  }
  const server = spawn('npx', ['next', 'start', '-p', String(APP_PORT), '-H', '127.0.0.1'], { cwd: appRoot, env, stdio: 'ignore', detached: true });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE)).ok) break; } catch { /* wait */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  fs.rmSync(SHOTS, { recursive: true, force: true });
  const browser = await chromium.launch();
  try {
    await check('PWA: manifest と Service Worker', async () => {
      const m = await (await fetch(`${BASE}/manifest.webmanifest`)).json();
      if (m.display !== 'standalone' || !m.icons.some((i) => i.sizes === '512x512')) throw new Error('manifest 不備');
      const sw = await fetch(`${BASE}/sw.js`);
      if (!sw.ok) throw new Error('sw.js なし');
      const h = (await fetch(BASE)).headers;
      if (!h.get('content-security-policy')) throw new Error('CSP なし');
      return `${m.name} / standalone`;
    });
    await flow(browser, emu, { name: 'tablet-1024x768', label: 'タブレット', width: 1024, height: 768, touch: true, alias: 'スタッフA' });
    await flow(browser, emu, { name: 'phone-390x844', label: 'スマホ', width: 390, height: 844, touch: true, alias: 'スタッフB' });
  } finally {
    await browser.close();
    try { process.kill(-server.pid); } catch { /* noop */ }
    await emu.close();
  }
  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(path.join(appRoot, 'test-results', 'e2e-results.json'), JSON.stringify(results, null, 2));
  console.log(`\nE2E: ${results.length - failed.length}/${results.length} 合格`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
