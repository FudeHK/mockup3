// 単体テスト: v2 追加機能（A 音声 / B 広報画像 / C 共有・招待 / E アレルゲン / F プロフィール）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toStepText, splitIntoSteps, appendText, inputMethod, recognitionSupport } from '../../src/lib/v2/voice.ts';
import { expressionWarnings, layout, coverCrop, wrapLines, TEMPLATES, SIZES } from '../../src/lib/v2/promo.ts';
import { scrubText, buildTemplate, parseTemplate } from '../../src/lib/v2/template.ts';
import { randomToken, sha256Hex, tokenFromHash, inviteUrl, weakPin } from '../../src/lib/v2/invite.ts';
import { ALLERGENS, DISCLAIMER, LANGS, localized, sortAllergens } from '../../src/lib/v2/allergens.ts';
import { CATEGORIES, PROFILE_NOTICE, diffProfile, applyShare, isValid } from '../../src/lib/v2/profile.ts';

test('A: 話した内容を工程の一言に整える（言いよどみ除去・句点・200文字）', () => {
  assert.equal(toStepText('えーと 裏口の鍵を開けて 照明をつける'), '裏口の鍵を開けて照明をつける。');
  assert.equal(toStepText('あの棚の上を拭く'), 'あの棚の上を拭く。', '「あの棚」は消さない');
  assert.equal(toStepText('その後、えー、レジを締める'), 'その後、レジを締める。');
  assert.equal(toStepText('   '), '');
  assert.equal(toStepText('看板を出す！'), '看板を出す！');
  assert.equal(toStepText('あ'.repeat(300)).length, 200);
});

test('A: 「次に」「それから」で複数の工程に分ける', () => {
  assert.deepEqual(splitIntoSteps('まず手を洗う 次に エプロンをつける それから 冷蔵庫の温度を見る 最後に記録する'),
    ['まず手を洗う。', 'エプロンをつける。', '冷蔵庫の温度を見る。', '記録する。']);
  assert.deepEqual(splitIntoSteps(''), []);
});

test('A: 既存の文章への追記と入力方法の判定', () => {
  assert.equal(appendText('鍵を開ける', '照明をつける'), '鍵を開ける。照明をつける。');
  assert.equal(appendText('', 'えっと 照明'), '照明。');
  assert.equal(inputMethod(true, false), 'voice');
  assert.equal(inputMethod(false, true), 'typed');
  assert.equal(inputMethod(true, true), 'mixed');
  assert.equal(inputMethod(false, false), null);
});

test('A: 音声認識に非対応の端末では理由を返す', () => {
  assert.equal(recognitionSupport({}).supported, false);
  assert.match(recognitionSupport({}).reason, /対応していません/);
  assert.match(recognitionSupport({ isSecureContext: false, webkitSpeechRecognition: () => {} }).reason, /https/);
  assert.equal(recognitionSupport({ isSecureContext: true, webkitSpeechRecognition: () => {} }).supported, true);
  assert.equal(recognitionSupport(undefined).supported, false);
});

test('B: 景品表示法に触れるおそれのある表現を検出する', () => {
  assert.deepEqual(expressionWarnings('日本一おいしい、絶対に満足'), ['日本一', '絶対']);
  assert.deepEqual(expressionWarnings('旬の刺身、入荷しました'), []);
});

test('B: 3案のレイアウトはすべて画像の内側に収まる', () => {
  assert.equal(TEMPLATES.length, 3);
  for (const s of SIZES) for (const t of TEMPLATES) {
    const l = layout(t.key, s.w, s.h);
    for (const r of [l.photo, l.text, l.panel].filter(Boolean)) {
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= s.w + 0.5 && r.y + r.h <= s.h + 0.5, `${t.key} ${s.key} ${JSON.stringify(r)}`);
      assert.ok(r.w > 0 && r.h > 0);
    }
  }
});

test('B: 写真の切り抜き（cover）と文字の折り返し', () => {
  const c = coverCrop(2000, 1000, { x: 0, y: 0, w: 500, h: 500 });
  assert.deepEqual(c, { x: 500, y: 0, w: 1000, h: 1000 });
  const lines = wrapLines('あいうえおかきくけこさしすせそ', 50, (s) => [...s].length * 10, 2);
  assert.deepEqual(lines, ['あいうえお', 'かきくけ…']);
  assert.deepEqual(wrapLines('短い', 100, (s) => s.length * 10), ['短い']);
});

test('C: 書き出しでは写真・連絡先・店舗名・呼び名を除く', () => {
  assert.equal(scrubText('港さんに090-1234-5678へ連絡 a@b.co https://x.y/z', ['港さん']), '（名前）に（電話番号）へ連絡 （メール） （URL）');
  const t = buildTemplate('デモ店舗の開店', [
    { question: 'Q1', body: 'スタッフAが鍵を開ける', photo_path: 'store/x/y.jpg' },
    { question: '', body: '' },
  ], ['デモ店舗', 'スタッフA']);
  assert.equal(t.title, '（名前）の開店');
  assert.equal(t.steps.length, 1);
  assert.equal(t.steps[0].body, '（名前）が鍵を開ける');
  assert.ok(!JSON.stringify(t).includes('photo'), '写真のパスを含まない');
  assert.ok(!JSON.stringify(t).includes('store/x'));
});

test('C: 取り込み時の検証', () => {
  const ok = parseTemplate(JSON.stringify(buildTemplate('閉店', [{ question: 'q', body: 'b' }])));
  assert.equal(ok.title, '閉店');
  assert.throws(() => parseTemplate('not json'), /形式/);
  assert.throws(() => parseTemplate('{"format":"other","version":1}'), /ShopNavi/);
  assert.throws(() => parseTemplate(JSON.stringify({ format: 'shopnavi-template', version: 1, title: 't', steps: [] })), /工程/);
  assert.throws(() => parseTemplate(JSON.stringify({ format: 'shopnavi-template', version: 1, title: 't', steps: [{ question: 1, body: 'x' }] })), /工程/);
  const long = parseTemplate(JSON.stringify({ format: 'shopnavi-template', version: 1, title: 'x'.repeat(99), steps: [{ question: '', body: 'y'.repeat(999) }] }));
  assert.equal(long.title.length, 60);
  assert.equal(long.steps[0].body.length, 200);
});

test('C: 招待トークンは推測困難で、URL の # 以降に置く', async () => {
  const a = randomToken();
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a, randomToken());
  assert.match(await sha256Hex(a), /^[0-9a-f]{64}$/);
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  const url = inviteUrl('https://x.example', a);
  assert.ok(url.includes('#t='));
  assert.equal(tokenFromHash(new URL(url).hash), a);
  assert.equal(tokenFromHash('#t=short'), '');
});

test('C: 推測されやすいPINを弾く', () => {
  for (const p of ['111111', '123456', '654321', '121212', '123123', '12345', 'abcdef']) assert.ok(weakPin(p), p);
  for (const p of ['572049', '308716', '48203917']) assert.ok(!weakPin(p), p);
});

test('E: アレルゲンは特定原材料8品目＋準ずるもの20品目、4言語の名前と免責', () => {
  assert.equal(ALLERGENS.filter((a) => a.mandatory).length, 8);
  assert.equal(ALLERGENS.filter((a) => !a.mandatory).length, 20);
  assert.equal(new Set(ALLERGENS.map((a) => a.key)).size, 28);
  assert.equal(new Set(ALLERGENS.map((a) => a.mark)).size, 28, 'アイコンの文字が重複しない');
  for (const a of ALLERGENS) for (const l of ['ja', 'en', 'zh', 'ko']) assert.ok(a[l], `${a.key} ${l}`);
  for (const l of LANGS) assert.ok(DISCLAIMER[l.key].length > 10);
  assert.ok(DISCLAIMER.ja.includes('最新の情報は店舗に確認してください'));
  assert.deepEqual(sortAllergens(['soybean', 'x', 'egg', 'wheat']), ['wheat', 'egg', 'soybean']);
});

test('E: 翻訳は確定したものだけ表示し、未確定は日本語に戻す', () => {
  const item = { name_ja: '唐揚げ', description_ja: '鶏', translations: { en: { name: 'Fried chicken', description: 'c', confirmed: true }, ko: { name: '닭튀김', confirmed: false } } };
  assert.deepEqual(localized(item, 'en'), { name: 'Fried chicken', description: 'c', fallback: false });
  assert.deepEqual(localized(item, 'ko'), { name: '唐揚げ', description: '鶏', fallback: true });
  assert.deepEqual(localized(item, 'zh'), { name: '唐揚げ', description: '鶏', fallback: true });
  assert.equal(localized(item, 'ja').fallback, false);
});

test('F: プロフィールは選択式で、公開設定の差分を計算できる', () => {
  assert.deepEqual(CATEGORIES.map((c) => c.key), ['skill', 'experience', 'wish']);
  assert.match(PROFILE_NOTICE, /評価・人事判断/);
  assert.match(PROFILE_NOTICE, /推測・診断は行いません/);
  assert.ok(isValid({ category: 'skill', value: 'レジ', shared: false }));
  assert.ok(!isValid({ category: 'skill', value: '口癖が多い', shared: false }));
  const before = [{ category: 'skill', value: 'レジ', shared: false }, { category: 'wish', value: '今のままでよい', shared: true }];
  const after = applyShare([{ category: 'skill', value: 'レジ', shared: false }, { category: 'skill', value: '調理', shared: false }], { skill: true, experience: false, wish: false });
  const d = diffProfile(before, after);
  assert.deepEqual(d.add.map((i) => i.value), ['調理']);
  assert.deepEqual(d.remove.map((i) => i.value), ['今のままでよい']);
  assert.deepEqual(d.update.map((i) => [i.value, i.shared]), [['レジ', true]]);
});
