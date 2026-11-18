// E2E（v2 追加機能）: Playwright でタブレット横向き（1024x768）とスマホ（390x844）の主要な流れを確認し、
// docs/e2e-screenshots/v2-*/ に保存する。既存の E2E（run.mjs）のあとに実行する。
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { startDb, DB_URL } from '../local/pg.mjs';
import { startEmulator } from '../local/emulator.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '../..');
const SHOTS = path.resolve(appRoot, '../docs/e2e-screenshots');
const OUT = path.join(appRoot, 'test-results', 'v2');
const APP_PORT = 3101;
const BASE = `http://127.0.0.1:${APP_PORT}`;
const ADMIN_PIN = '135790';
const STAFF_PIN = '246802';
const TRIAL = { code: 'trial-shop', admin: '482039', staff: '739104' }; // 機能フラグ OFF（本番の試験導入店舗と同じ状態）

const results = [];
async function check(name, fn) {
  try {
    const info = await fn();
    results.push({ name, ok: true, info: info || '' });
    console.log(`○ ${name}${info ? ` — ${info}` : ''}`);
  } catch (e) {
    const msg = (e && e.message ? e.message : String(e)).split('\n')[0];
    results.push({ name, ok: false, info: msg });
    console.log(`× ${name} — ${msg}`);
  }
}

// 音声認識のモック（ヘッドレス環境にはマイクがないため）。話した内容は window.__voiceText
const FAKE_SPEECH = `(() => {
  class FakeRec {
    constructor() { this.lang = ''; this.continuous = false; this.interimResults = false; this.onresult = null; this.onend = null; this.onerror = null; }
    start() { window.__recLang = this.lang; setTimeout(() => { const r = Object.assign([{ transcript: window.__voiceText || '' }], { isFinal: true }); this.onresult && this.onresult({ resultIndex: 0, results: [r] }); }, 80); }
    stop() { setTimeout(() => this.onend && this.onend(), 30); }
    abort() {}
  }
  window.SpeechRecognition = FakeRec; window.webkitSpeechRecognition = FakeRec;
})();`;
const NO_SPEECH = `(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; try { Object.defineProperty(window, 'webkitSpeechRecognition', { value: undefined }); } catch {} })();`;

async function makeExifJpeg(browser, file) {
  const p = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  await p.setContent('<body style="margin:0;background:linear-gradient(135deg,#c98a4b,#4f8f60)"><div style="margin:300px auto;width:600px;height:400px;border-radius:50%;background:#fff"></div></body>');
  const jpg = await p.screenshot({ type: 'jpeg', quality: 80 });
  await p.close();
  const marker = Buffer.from('GPS-SECRET-35.0000N-135.0000E\0');
  const tiff = Buffer.concat([Buffer.from('MM\0*\0\0\0\x08', 'binary'), Buffer.from([0, 0, 0, 0, 0, 0]), marker]);
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
  const len = Buffer.alloc(2);
  len.writeUInt16BE(payload.length + 2);
  fs.writeFileSync(file, Buffer.concat([jpg.subarray(0, 2), Buffer.from([0xff, 0xe1]), len, payload, jpg.subarray(2)]));
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

async function pinLogin(page, pin, code = 'demo') {
  await page.goto(`${BASE}/`);
  await page.getByLabel('店舗コード').fill(code);
  for (const d of pin) await page.getByRole('button', { name: `数字${d}`, exact: true }).click();
  await page.getByRole('button', { name: '入室する' }).click();
}
async function say(page, testId, text, nth = 0) {
  await page.evaluate((t) => { window.__voiceText = t; }, text);
  const btn = page.getByTestId(testId).nth(nth);
  await btn.click();
  await page.getByText('聞き取り中').first().waitFor();
  await page.waitForTimeout(250);
  await btn.click();
}
async function download(page, trigger, file) {
  const [dl] = await Promise.all([page.waitForEvent('download'), trigger()]);
  await dl.saveAs(file);
  return { buf: fs.readFileSync(file), name: dl.suggestedFilename() };
}

async function flow(browser, vp) {
  const dir = path.join(SHOTS, `v2-${vp.name}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  let n = 0;
  const shot = async (page, label) => page.screenshot({ path: path.join(dir, `${String(++n).padStart(2, '0')}-${label}.png`) });
  const ctxOpts = { viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, locale: 'ja-JP', timezoneId: 'Asia/Tokyo', hasTouch: true, isMobile: vp.mobile, acceptDownloads: true };
  const adminCtx = await browser.newContext(ctxOpts);
  await adminCtx.addInitScript(FAKE_SPEECH);
  const staffCtx = await browser.newContext(ctxOpts);
  const admin = await adminCtx.newPage();
  const staff = await staffCtx.newPage();
  const errors = [];
  for (const p of [admin, staff]) p.on('pageerror', (e) => errors.push(e.message));
  const P = `[${vp.label}]`;
  const title = `音声で作った閉店（${vp.label}）`;
  let voiceManualUrl = '';

  await check(`${P} 管理者でログイン（デモ店舗＝新機能ON）`, async () => {
    await pinLogin(admin, ADMIN_PIN);
    await admin.waitForURL(`${BASE}/admin`);
    await admin.getByRole('link', { name: /その他/ }).waitFor();
    await admin.getByRole('link', { name: /その他/ }).click();
    await admin.getByRole('heading', { name: 'その他の機能' }).waitFor();
    await admin.getByText('広報画像をつくる').waitFor();
    await shot(admin, 'admin-more');
  });

  await check(`${P} A 音声でマニュアル作成（まとめて話す→工程に分割・工程ごとの音声・手入力）`, async () => {
    await admin.goto(`${BASE}/admin/manuals/new`);
    await admin.getByTestId('tpl-close').click();
    await admin.waitForURL(/\/admin\/manuals\/[0-9a-f-]{36}$/);
    voiceManualUrl = admin.url();
    await admin.getByLabel('タイトル').fill(title);
    await admin.getByTestId('voice-bulk-card').waitFor();
    await say(admin, 'voice-bulk', 'えーと 閉店30分前にラストオーダーを伝える 次に レジを締める それから テーブルをふく');
    await admin.getByText(/音声から3つの工程を入れました/).waitFor();
    const steps = admin.getByTestId('step-edit');
    const b = await Promise.all([0, 1, 2].map((i) => steps.nth(i).locator('textarea').inputValue()));
    if (b.join('|') !== '閉店30分前にラストオーダーを伝える。|レジを締める。|テーブルをふく。') throw new Error(`分割結果: ${b.join('|')}`);
    if ((await admin.evaluate(() => window.__recLang)) !== 'ja-JP') throw new Error('認識言語が ja-JP でない');
    await say(admin, 'voice-step', 'あのー 火の元を確認する', 3);
    await admin.waitForFunction(() => document.querySelectorAll('[data-testid=step-edit] textarea')[3]?.value !== '', null, { timeout: 5000 }).catch(() => {});
    const v4 = await steps.nth(3).locator('textarea').inputValue();
    if (v4 !== '火の元を確認する。') throw new Error(`工程4: ${v4}`);
    await steps.nth(4).locator('textarea').fill('戸締まりをして退店する');
    await shot(admin, 'voice-editor');
    await admin.getByTestId('publish').click();
    await admin.getByText(/公開しました/).waitFor();
    return b.join(' / ');
  });

  await check(`${P} A 入力方法（音声／手入力）が CSV に出る`, async () => {
    await admin.goto(`${BASE}/admin/logs`);
    await admin.getByText('入力方法（工程ごとに').waitFor();
    const { buf } = await download(admin, () => admin.getByTestId('export-csv').click(), path.join(OUT, `log-${vp.name}.csv`));
    if (!(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf)) throw new Error('BOM なし');
    const text = buf.toString('utf8');
    const rows = text.split('\r\n').filter((l) => l.includes('"入力方法"') && l.includes(title));
    const voice = rows.filter((l) => l.includes('"音声"')).length;
    const typed = rows.filter((l) => l.includes('"手入力"')).length;
    if (voice !== 4 || typed !== 1) throw new Error(`音声${voice}件・手入力${typed}件`);
    if (!text.includes('"文字数"')) throw new Error('単位がない');
    await shot(admin, 'logs-input-method');
    return `音声${voice}件・手入力${typed}件`;
  });

  await check(`${P} A 音声認識に非対応の端末ではボタン無効＋理由表示`, async () => {
    const ctx = await browser.newContext(ctxOpts);
    await ctx.addInitScript(NO_SPEECH);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await pinLogin(p, ADMIN_PIN);
    await p.waitForURL(`${BASE}/admin`);
    await p.goto(voiceManualUrl);
    await p.getByTestId('voice-bulk').waitFor();
    if (!(await p.getByTestId('voice-bulk').isDisabled())) throw new Error('無効になっていない');
    const reason = await p.getByTestId('voice-unsupported').first().innerText();
    if (!reason.includes('対応していません')) throw new Error(reason);
    await shot(p, 'voice-unsupported');
    await ctx.close();
    return reason.replace('🔇', '').trim().slice(0, 40);
  });

  await check(`${P} B 広報画像（写真1枚→3案・EXIF削除・表現チェック）`, async () => {
    await admin.goto(`${BASE}/admin/promo`);
    const fixture = path.join(OUT, 'exif-photo.jpg');
    await makeExifJpeg(browser, fixture);
    await admin.getByTestId('promo-photo').setInputFiles(fixture);
    await admin.getByTestId('promo-photo-ok').waitFor();
    await admin.getByLabel(/^店名/).fill('デモ食堂（架空）');
    await admin.getByLabel(/^メニュー/).fill('旬の刺身盛り合わせ');
    await admin.getByLabel(/^一言/).fill('日本一の鮮度');
    await admin.getByTestId('promo-warn').waitFor();
    if ((await admin.getByTestId('promo-candidate').count()) !== 3) throw new Error('3案ない');
    await shot(admin, 'promo-warning');
    await admin.getByLabel(/^一言/).fill('今週だけの限定です');
    await admin.getByTestId('promo-warn').waitFor({ state: 'detached' });
    const sizes = [];
    for (const i of [0, 1, 2]) {
      const { buf, name } = await download(admin, () => admin.getByTestId(`promo-download-${i}`).click(), path.join(OUT, `promo-${vp.name}-${i}.jpg`));
      if (buf.includes(Buffer.from('Exif'))) throw new Error('EXIF が残っている');
      if (buf.includes(Buffer.from('GPS-SECRET'))) throw new Error('位置情報が残っている');
      const s = jpegSize(buf);
      if (!s || s.w !== 1080 || s.h !== 1080) throw new Error(`サイズ ${JSON.stringify(s)}`);
      sizes.push(name);
    }
    // 3案が互いに異なる画像であること
    const hashes = new Set([0, 1, 2].map((i) => fs.readFileSync(path.join(OUT, `promo-${vp.name}-${i}.jpg`)).toString('base64').slice(-200)));
    if (hashes.size !== 3) throw new Error('3案が同じ');
    await admin.getByTestId('promo-candidate').first().scrollIntoViewIfNeeded();
    await shot(admin, 'promo-3plans');
    return sizes.join(', ');
  });

  let exported = '';
  await check(`${P} C テンプレートの書き出し（写真・店舗名・呼び名を含まない）`, async () => {
    await admin.goto(`${BASE}/admin/share`);
    await admin.getByText('開店準備（サンプル）').first().waitFor();
    const row = admin.locator('div.row', { hasText: '開店準備（サンプル）' }).filter({ has: admin.getByTestId('export-template') }).first();
    const { buf } = await download(admin, () => row.getByTestId('export-template').click(), path.join(OUT, `tpl-${vp.name}.json`));
    exported = path.join(OUT, `tpl-${vp.name}.json`);
    const t = JSON.parse(buf.toString('utf8'));
    const s = JSON.stringify(t);
    if (t.format !== 'shopnavi-template' || t.steps.length < 3) throw new Error(s.slice(0, 80));
    for (const bad of ['photo', 'store_id', 'デモ店舗', 'スタッフA', '00000000-']) if (s.includes(bad)) throw new Error(`「${bad}」を含む`);
    return `工程${t.steps.length}`;
  });

  await check(`${P} C テンプレートの取り込み（下書きとして作成）`, async () => {
    await admin.getByTestId('import-template').setInputFiles(exported);
    await admin.getByTestId('import-preview').waitFor();
    await shot(admin, 'template-import');
    await admin.getByTestId('import-confirm').click();
    await admin.waitForURL(/\/admin\/manuals\/[0-9a-f-]{36}$/);
    await admin.getByText('下書き').first().waitFor();
    const v = await admin.getByTestId('step-edit').first().locator('textarea').inputValue();
    if (!v.includes('鍵')) throw new Error(`工程1: ${v}`);
  });

  await check(`${P} C 招待リンクから新しい店を作成（店舗コード・PIN設定）→管理者で入れる`, async () => {
    await admin.goto(`${BASE}/admin/share`);
    await admin.getByTestId('create-invite').click();
    const url = await admin.getByTestId('invite-url').inputValue();
    if (!/\/invite#t=[A-Za-z0-9_-]{43}$/.test(url)) throw new Error(url);
    await shot(admin, 'invite-created');
    const ctx = await browser.newContext(ctxOpts);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(url.replace(/^https?:\/\/[^/]+/, BASE));
    await p.getByLabel(/^店舗名/).fill(`招待された店（架空・${vp.label}）`);
    await p.getByLabel(/^店舗コード/).fill(`invited-${vp.name.slice(0, 6)}`);
    await p.getByLabel('管理者PIN（6〜8桁）').fill('123456');
    await p.getByLabel('管理者PIN（確認）').fill('123456');
    await p.getByLabel('スタッフPIN（6〜8桁）').fill('739104');
    await p.getByLabel('スタッフPIN（確認）').fill('739104');
    await p.getByTestId('invite-submit').click();
    await p.getByText(/連番/).waitFor(); // 推測されやすいPINは弾く
    await p.getByLabel('管理者PIN（6〜8桁）').fill('592817');
    await p.getByLabel('管理者PIN（確認）').fill('592817');
    if (p.url().includes('#')) throw new Error('トークンがURLに残っている');
    await shot(p, 'invite-form');
    await p.getByTestId('invite-submit').click();
    await p.waitForURL(`${BASE}/admin`);
    await p.getByText(`招待された店（架空・${vp.label}）`).first().waitFor();
    await shot(p, 'invite-new-store');
    // 同じリンクはもう使えない
    const p2 = await (await browser.newContext(ctxOpts)).newPage();
    await p2.goto(url.replace(/^https?:\/\/[^/]+/, BASE));
    await p2.getByLabel(/^店舗名/).fill('2回目');
    await p2.getByLabel(/^店舗コード/).fill(`again-${vp.name.slice(0, 6)}`);
    for (const [l, v] of [['管理者PIN（6〜8桁）', '592817'], ['管理者PIN（確認）', '592817'], ['スタッフPIN（6〜8桁）', '739104'], ['スタッフPIN（確認）', '739104']]) await p2.getByLabel(l).fill(v);
    await p2.getByTestId('invite-submit').click();
    await p2.getByText(/この招待リンクは使えません/).waitFor();
    await ctx.close();
  });

  await check(`${P} E メニュー（アレルゲン入力・翻訳を確定・多言語表示・免責表示）`, async () => {
    await admin.goto(`${BASE}/admin/menu`);
    await admin.locator('#add-name').fill(`テスト丼（サンプル・${vp.label}）`);
    await admin.getByLabel('価格（円・税込）').fill('900');
    await admin.getByTestId('menu-add').click();
    const card = admin.getByTestId('menu-item').filter({ has: admin.locator(`input[value="テスト丼（サンプル・${vp.label}）"]`) });
    await card.waitFor();
    await card.getByTestId('al-egg').check();
    await card.getByTestId('al-wheat').check();
    await card.getByTestId('al-salmon_roe').check();
    await card.getByTestId('menu-save').click();
    await admin.getByText('保存しました').first().waitFor();
    await card.getByTestId('allergen-confirm').click();
    await card.getByText(/確認済み/).waitFor();
    await card.getByTestId('tr-name-en').fill(`Test rice bowl (${vp.name})`);
    await card.getByTestId('tr-confirm-en').click();
    await card.locator('.tag.g', { hasText: '確定' }).waitFor();
    await card.scrollIntoViewIfNeeded();
    await shot(admin, 'menu-edit');
    await admin.getByTestId('menu-board-tab').click();
    await admin.getByTestId('lang-en').click();
    await admin.getByText(`Test rice bowl (${vp.name})`).waitFor();
    const d = await admin.getByTestId('allergen-disclaimer').innerText();
    if (!d.includes('Please check the latest information')) throw new Error(d);
    const item = admin.getByTestId('menu-board-item').filter({ hasText: `Test rice bowl (${vp.name})` });
    const t = await item.innerText();
    for (const s of ['Egg', 'Wheat', 'Salmon roe', '¥900']) if (!t.includes(s)) throw new Error(`「${s}」がない: ${t}`);
    // 未確認のアレルゲンは表示しない（枝豆のサンプル）
    if (!(await admin.getByText('Allergen information is being checked').count())) throw new Error('未確認の表示がない');
    await shot(admin, 'menu-board-en');
    await admin.getByTestId('lang-ja').click();
    const ja = await admin.getByTestId('allergen-disclaimer').innerText();
    if (!ja.includes('最新の情報は店舗に確認してください')) throw new Error(ja);
  });

  await check(`${P} F スタッフの自己申告プロフィール（公開項目だけ管理者に見える）`, async () => {
    await pinLogin(staff, STAFF_PIN);
    await staff.waitForURL(`${BASE}/staff/alias`);
    await staff.getByRole('button', { name: vp.alias }).click();
    await staff.waitForURL(`${BASE}/staff`);
    await staff.getByTestId('link-profile').click();
    await staff.getByTestId('profile-notice').waitFor();
    const notice = await staff.getByTestId('profile-notice').innerText();
    if (!notice.includes('評価・人事判断') || !notice.includes('推測・診断は行いません')) throw new Error(notice);
    await staff.getByText('レジ', { exact: true }).click();
    await staff.getByText('盛り付け', { exact: true }).click();
    await staff.getByTestId('share-skill').check();
    await staff.getByText('シフトを減らしたい', { exact: true }).click();
    await staff.getByTestId('profile-save').click();
    await staff.getByText('保存しました').waitFor();
    await shot(staff, 'staff-profile');
    await admin.goto(`${BASE}/admin/profiles`);
    const c = admin.getByTestId('profile-card').filter({ hasText: vp.alias });
    await c.waitFor();
    const t = await c.innerText();
    if (!t.includes('レジ') || !t.includes('盛り付け')) throw new Error(t);
    if (t.includes('シフトを減らしたい')) throw new Error('非公開の希望が見えている');
    await shot(admin, 'admin-profiles');
  });

  await check(`${P} E スタッフ側のメニュー表（韓国語・未確定の翻訳は日本語）`, async () => {
    await staff.goto(`${BASE}/staff/menu`);
    await staff.getByTestId('lang-ko').click();
    await staff.getByText('번역이 아직 확인되지 않았습니다').first().waitFor();
    const d = await staff.getByTestId('allergen-disclaimer').innerText();
    if (!d.includes('최신 정보는 매장에 확인해 주세요')) throw new Error(d);
    await shot(staff, 'staff-menu-ko');
  });

  await check(`${P} D パートナー管理画面（架空のデータ・集計のみ・3店舗未満は非表示）`, async () => {
    const ctx = await browser.newContext(ctxOpts);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(`${BASE}/partner`);
    await p.getByLabel('パートナーコード').fill('demo-partner');
    await p.getByLabel('PIN').fill('864209');
    await p.getByTestId('partner-login').click();
    await p.getByTestId('fake-banner').waitFor();
    const banner = await p.getByTestId('fake-banner').innerText();
    if (!banner.includes('架空のデータ')) throw new Error(banner);
    const totals = await p.getByTestId('partner-totals').innerText();
    if (!totals.includes('7店')) throw new Error(totals);
    const groups = await p.getByTestId('partner-groups').innerText();
    if (groups.includes('定食屋')) throw new Error('1店舗の区分が表示されている');
    if (/架空の(居酒屋|カフェ)\d/.test(await p.content())) throw new Error('店舗名が表示されている');
    await p.getByTestId('partner-hidden').waitFor();
    await shot(p, 'partner-dashboard');
    await ctx.close();
    return totals.replace(/\s+/g, ' ').slice(0, 60);
  });

  await check(`${P} 機能フラグOFFの店舗は従来どおり（新機能が出ない・CSVも従来の形式）`, async () => {
    const ctx = await browser.newContext(ctxOpts);
    await ctx.addInitScript(FAKE_SPEECH);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(e.message));
    await pinLogin(p, TRIAL.admin, TRIAL.code);
    await p.waitForURL(`${BASE}/admin`);
    await p.getByRole('heading', { name: 'マニュアル' }).waitFor();
    await p.waitForTimeout(800);
    if (await p.getByRole('link', { name: /その他/ }).count()) throw new Error('「その他」が出ている');
    await p.getByRole('link', { name: '＋ 新しく作る' }).click();
    await p.getByTestId('tpl-open').click();
    await p.waitForURL(/\/admin\/manuals\/[0-9a-f-]{36}$/);
    await p.getByTestId('step-edit').first().waitFor();
    await p.waitForTimeout(800);
    if (await p.getByTestId('voice-bulk').count() || await p.getByTestId('voice-step').count()) throw new Error('音声ボタンが出ている');
    await p.getByTestId('step-edit').first().locator('textarea').fill('鍵を開ける');
    await p.getByTestId('publish').click();
    await p.getByText(/公開しました/).waitFor();
    await shot(p, 'flag-off-editor');
    for (const u of ['/admin/promo', '/admin/menu', '/admin/share', '/admin/profiles']) {
      await p.goto(`${BASE}${u}`);
      await p.getByText('この店舗では使えない機能です').waitFor();
    }
    await p.goto(`${BASE}/admin/logs`);
    const { buf } = await download(p, () => p.getByTestId('export-csv').click(), path.join(OUT, `trial-${vp.name}.csv`));
    const text = buf.toString('utf8');
    if (text.includes('入力方法')) throw new Error('入力方法が出力されている');
    if (!text.includes('マニュアル公開')) throw new Error('従来の記録がない');
    await ctx.close();
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
  const pool = new pg.Pool({ connectionString: DB_URL });
  await pool.query(`insert into public.stores (id, code, name) values ('00000000-0000-4000-8000-0000000000aa', $1, '試験導入店（フラグOFF）')`, [TRIAL.code]);
  await pool.query(`insert into public.store_secrets values ('00000000-0000-4000-8000-0000000000aa', extensions.crypt($1, extensions.gen_salt('bf')), extensions.crypt($2, extensions.gen_salt('bf')))`, [TRIAL.admin, TRIAL.staff]);
  await pool.end();
  const emu = await startEmulator({ port: 54321, dbUrl: DB_URL });
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
  const browser = await chromium.launch();
  try {
    await flow(browser, { name: 'tablet-1024x768', label: 'タブレット', width: 1024, height: 768, mobile: false, alias: 'スタッフA' });
    await flow(browser, { name: 'phone-390x844', label: 'スマホ', width: 390, height: 844, mobile: true, alias: 'スタッフB' });
  } finally {
    await browser.close();
    try { process.kill(-server.pid); } catch { /* noop */ }
    await emu.close();
  }
  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(path.join(OUT, 'e2e-v2-results.json'), JSON.stringify(results, null, 2));
  console.log(`\nE2E(v2): ${results.length - failed.length}/${results.length} 合格`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
