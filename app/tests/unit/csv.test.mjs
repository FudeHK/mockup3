// 単体テスト: CSV の無害化・BOM・エスケープ
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv, neutralize, toCell, BOM } from '../../src/lib/csv.ts';

test('先頭が = + - @ の値は数式にならないよう先頭に \' を付ける', () => {
  assert.equal(neutralize('=1+1'), "'=1+1");
  assert.equal(neutralize('+81-90'), "'+81-90");
  assert.equal(neutralize('-2+3'), "'-2+3");
  assert.equal(neutralize('@SUM(A1)'), "'@SUM(A1)");
  assert.equal(neutralize('=HYPERLINK("http://evil","x")'), `'=HYPERLINK("http://evil","x")`);
  assert.equal(neutralize('\t=1'), "'\t=1");
  assert.equal(neutralize('＝1+1'), "'＝1+1");
});

test('通常の文字列・数値はそのまま', () => {
  assert.equal(neutralize('スタッフA'), 'スタッフA');
  assert.equal(neutralize('a=b'), 'a=b');
  assert.equal(toCell(75.5), '75.5');
  assert.equal(toCell(null), '');
  assert.equal(toCell(undefined), '');
});

test('BOM 付き UTF-8・CRLF・ダブルクォートのエスケープ', () => {
  const csv = toCsv(['日時', 'メモ'], [['2026-11-20 09:00', '「わからない」"引用"'], ['=cmd|calc', 'a,b\n改行']]);
  assert.ok(csv.startsWith(BOM));
  const bytes = Buffer.from(csv, 'utf8');
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  const body = csv.slice(1);
  assert.equal(body.split('\r\n')[0], '"日時","メモ"');
  assert.ok(body.includes('"「わからない」""引用"""'));
  assert.ok(body.includes(`"'=cmd|calc"`));
  assert.ok(body.includes('"a,b\n改行"'));
  assert.ok(body.endsWith('\r\n'));
});
