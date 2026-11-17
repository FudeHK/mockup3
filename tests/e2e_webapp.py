"""webapp-testing スキルに沿った E2E 確認（静的HTMLなので file:// で直接開く）。
使い方: python3 tests/e2e_webapp.py   （npm run e2e でも可）
タブレット横向き 1024x768 とスマホ 390x844 で、主要フローを確認する。
画面に機能が存在しない項目は「未実装」として報告し、失敗(×)とは区別する。"""
import os, sys, json
from playwright.sync_api import sync_playwright

ROOT = 'file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'shopnavi-mock'))
VIEWPORTS = {'tablet-1024x768': (1024, 768), 'phone-390x844': (390, 844)}
results, errors = {}, []


def rec(item, vp, ok):
    results.setdefault(item, {})[vp] = ok


def body(p):
    return p.inner_text('body')


with sync_playwright() as pw:
    b = pw.chromium.launch(headless=True)
    for vp, (w, h) in VIEWPORTS.items():
        p = b.new_page(viewport={'width': w, 'height': h})
        p.on('pageerror', lambda e: errors.append(str(e)))
        p.on('console', lambda m: m.type == 'error' and errors.append(m.text))
        base = ROOT + '/full/index.html'

        # 1. PIN認証（管理者・スタッフ）
        p.goto(base + '#/home'); p.wait_for_load_state('load')
        has_pin = p.locator('input[type="password"], input[inputmode="numeric"], [data-pin]').count() > 0 or 'PIN' in body(p)
        rec('PIN認証（管理者・スタッフ）', vp, 'ok' if has_pin else 'missing')

        # 2. マニュアルの作成と手順表示
        p.goto(base + '#/manual/new')
        ok = True
        for _ in range(3):
            p.click('button[data-act="wiz"][data-v="1"]')
        ok &= '4. 完成イメージ' in body(p)
        p.goto(base + '#/manual/1')
        ok &= p.locator('#view .card.row .n').count() >= 2
        ok &= p.evaluate('document.documentElement.scrollWidth <= innerWidth')
        rec('マニュアルの作成と手順表示', vp, 'ok' if ok else 'ng')

        # 3. 「わからない」ボタンと管理者の一覧
        found = False
        for r in ['manual/1', 'manual/1/read', 'home', 'staff']:
            p.goto(base + '#/' + r)
            if 'わからない' in body(p):
                found = True
        rec('「わからない」ボタンと管理者の一覧', vp, 'ok' if found else 'missing')

        # 4. クイズと点数
        p.goto(base + '#/quiz')
        qs = p.locator('#view .card:has(button[data-act="quiz"])')
        n = qs.count()
        for i in range(n):
            qs.nth(i).locator('button[data-ok="1"]').click()
        judged = p.locator('button.opt.ok').count() == n and n > 0
        score = any(k in body(p) for k in ['点数', 'スコア', f'{n}/{n}', f'{n} / {n}'])
        rec('クイズ（回答・正誤判定）', vp, 'ok' if judged else 'ng')
        rec('クイズの点数表示', vp, 'ok' if score else 'missing')

        # 5. 利用ログのCSV出力
        found = False
        for r in ['settings', 'staff', 'home', 'more']:
            p.goto(base + '#/' + r)
            if 'CSV' in body(p):
                found = True
        rec('利用ログのCSV出力', vp, 'ok' if found else 'missing')
        p.close()
    b.close()

mark = {'ok': '○', 'ng': '×', 'missing': '×(未実装)'}
for item, v in results.items():
    print(item + ': ' + ' / '.join(f'{k} {mark[s]}' for k, s in v.items()))
if errors:
    print('consoleErrors:', json.dumps(errors, ensure_ascii=False))
sys.exit(1 if errors or any(s != 'ok' for v in results.values() for s in v.values()) else 0)
