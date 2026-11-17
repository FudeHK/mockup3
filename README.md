# ShopNavi（試験導入版）

小さなお店向けの「写真つき作業マニュアル」アプリです。1店舗・約2週間の試験導入（2026/11/20〜）用。

| フォルダ | 内容 |
|---|---|
| `app/` | 本体（Next.js App Router + Supabase）。Vercel の Root Directory はここ |
| `app/supabase/` | DB マイグレーション（スキーマ・RLS・Storage・Realtime）とシード |
| `docs/運用メモ.md` | 店主向けの1ページ運用メモ |
| `docs/e2e-screenshots/` | 自動テストのスクリーンショット（タブレット横・スマホ） |
| `shopnavi-mock/` | 以前の静的モックアップ（配色・部品を本体に流用） |

## できること

1. **認証**：店舗コード + PIN（管理者PIN／スタッフPIN）。PIN は bcrypt でハッシュ化して保存し、サーバー側（DB 関数）で照合。同じ端末で5回まちがえると15分ロック。入室後、スタッフは仮名（スタッフA など）を選ぶ。本名・電話番号は保存しない。Supabase 匿名サインイン + 店舗メンバー表（役割つき）で、RLS は `auth.uid()` と役割で判定
2. **マニュアル作成（管理者）**：テンプレート6種（開店・閉店・掃除・接客・調理・衛生）の質問に答えて工程を作る。工程ごとに写真1枚と一言。写真は端末で縮小（長辺1280px）し EXIF（位置情報など）を消してから非公開 Storage へ。公開ごとに版を残し（編集履歴）、2版目以降はスタッフへ再確認依頼。作成開始→初回公開の時間を自動記録
3. **閲覧（スタッフ）**：1工程ずつ大きな文字。タブレット横向き優先。音声読み上げ（Web Speech API・ja-JP、非対応端末はボタン無効＋理由表示）。再確認依頼のあるマニュアルを赤枠で先頭に表示
4. **「わからない」ボタン**：工程ごとにワンタップ。管理者画面に「いつ・どのマニュアルの・どの工程を・どのスタッフが」を一覧表示（Realtime で即時更新、接続できない場合も10秒ごとに自動更新）
5. **理解度クイズ**：管理者が工程から選択式問題を作成、スタッフが回答し正答率を保存
6. **利用ログと CSV**：作成時間・閲覧（開始／終了／工程ごと）・「わからない」・クイズ結果を記録。期間を指定して BOM 付き UTF-8 の CSV を出力（先頭が `= + - @` の値は `'` を付けて無害化）

PWA としてホーム画面に追加できます（manifest + Service Worker）。

## 環境変数

| 変数名 | 必須 | 設定場所 | 内容 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Vercel / `app/.env.local` | Supabase の Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Vercel / `app/.env.local` | Supabase の anon（publishable）キー。ブラウザに公開される前提の値 |
| `NEXT_PUBLIC_DEFAULT_STORE_CODE` | 任意 | Vercel / `app/.env.local` | ログイン画面に初期表示する店舗コード（例 `demo`） |

- **サービスロールキー（service_role / secret key）は使いません。** Vercel にもリポジトリにも置かないでください。
- デプロイ作業用（CLI 実行時のみ・リポジトリに保存しない）：`SUPABASE_ACCESS_TOKEN`、`SUPABASE_DB_PASSWORD`、`VERCEL_TOKEN`

## セットアップ（本番）

前提：Node.js 20.9 以上、Supabase プロジェクト、Vercel アカウント。

```bash
cd app && npm ci
```

```bash
npx supabase login
```

```bash
npx supabase link --project-ref <プロジェクトREF>
```

```bash
npx supabase db push --include-seed
```

Supabase ダッシュボードで次を設定します。

- Authentication → Sign In / Providers → **Allow anonymous sign-ins を ON**
- （推奨）Authentication → Attack Protection → CAPTCHA を有効化

Vercel（Root Directory を `app` に設定）：

```bash
npx vercel link
```

```bash
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
```

```bash
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
```

```bash
npx vercel env add NEXT_PUBLIC_DEFAULT_STORE_CODE production
```

```bash
npx vercel deploy --prod
```

デプロイ後、**すぐに管理者でログインして「設定」から両方の PIN を変更**してください（初期PIN はデモ用で、このリポジトリに書かれています）。

## ローカル開発・テスト

Supabase CLI が使える場合は `npx supabase start` → `app/.env.local` に表示された URL と anon キーを設定 → `npm run dev`。

Docker が無い環境でも、ローカル PostgreSQL（16 以上）があれば自動テストを実行できます。テストは `tests/local/` の Supabase 互換スタブ（auth / storage スキーマ・ロール）と簡易エミュレーター（Auth 匿名サインイン・REST・Storage）を使い、**本番と同じマイグレーションと RLS** に対して実行されます（エミュレーターはテスト専用で、本番では使いません）。

| コマンド | 内容 |
|---|---|
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run build` | 本番ビルド |
| `npm run test:unit` | 単体テスト（PIN 照合とロック、CSV の無害化） |
| `npm run test:rls` | RLS テスト（スタッフは編集不可／他店舗は読めない／未ログインは何も読めない ほか） |
| `npm run test:e2e` | Playwright で 1024x768 と 390x844 の一連の流れを確認し、`docs/e2e-screenshots/` に保存 |

E2E には Playwright（Chromium）が必要です（未導入なら `npm i -D playwright && npx playwright install chromium`）。

## セキュリティ上の設計メモ

- 全テーブルで RLS 有効。未ログイン（anon）には一切の権限を与えない
- PIN ハッシュ・試行履歴は RLS ポリシーなし＋権限剥奪で、管理者を含め API から読めない
- 「わからない」・ログは、仮名・店舗名・マニュアル名をサーバー側トリガーで補完（なりすまし防止）
- クイズの正答はスタッフに返さず、採点は DB 関数で実施
- 写真は非公開バケット。パスの先頭が店舗IDで、RLS で自店舗のみ参照可。表示は1時間の署名付きURL
- CSP・X-Frame-Options などのセキュリティヘッダーを付与
- 端末ロックは端末ID（ブラウザ保存）単位。総当たり対策として店舗単位でも15分50回失敗で一時停止

## 管理者PINを忘れたとき
Supabase ダッシュボードの SQL Editor で次を実行します（`新しいPIN` と店舗コードを置き換え）。

```sql
update public.store_secrets
set admin_pin_hash = extensions.crypt('新しいPIN', extensions.gen_salt('bf', 10)), updated_at = now()
where store_id = (select id from public.stores where code = 'demo');
```
