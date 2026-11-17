# ShopNavi

## 目的
小規模飲食店向けの「マニュアル・研修・広報」アプリ。ビジネスコンテストの試験導入用。
- 2026/11/20 から1店舗で試験導入。新機能より「安定して動くこと」を優先する。

## 技術構成
- 本番想定: Next.js / Supabase（Postgres・Auth・RLS）/ Vercel / PWA
- **このリポジトリの現状**: 静的HTMLモックアップのみ（`shopnavi-mock/`）。
  Next.js・Supabase のコードやテーブル定義はまだ存在しない。
  - `shopnavi-mock/full/` 全機能版、`shopnavi-mock/simple/` シンプル版、`assets/app.js` が画面描画（ハッシュルーティング）
  - `scripts/routes.js` 画面一覧（check.js と screenshots.js で共有）
- 公開リポジトリ（public）。コミット内容は誰でも読める前提で扱う。

## コマンド
| 用途 | コマンド |
|---|---|
| 起動 | `npm start`（http://localhost:8080） |
| ビルド | `npm run build`（静的なので実体はリント） |
| リント | `npm run lint`（構文・秘密情報・電話番号の混入チェック） |
| テスト | `npm test`（全画面の回帰チェック） |
| E2E | `npm run e2e`（webapp-testing。1024x768 と 390x844） |
| 画面保存 | `npm run screenshots` |

初回のみ: `npm install`、Python 側は `pip install playwright==1.63.0`。
クラウド環境では Chromium が /opt/pw-browsers に入っているので `playwright install` は不要。

## 守るルール
1. **実名・電話番号を保存しない**。スタッフは仮名（例: 港 ひなた）で扱う。入力項目にも設けない。
2. **サービスロールキーをクライアントに置かない**。`NEXT_PUBLIC_` 付きの環境変数はブラウザに渡る。
   `.env*` はコミットしない（.gitignore 済み、`.env.example` のみ可）。
3. **全テーブルで RLS を有効にする**。スタッフ／管理者の権限を分け、UPDATE は USING と WITH CHECK を両方書く。
   `user_metadata` を権限判定に使わない（`app_metadata` を使う）。SECURITY DEFINER は原則使わない。
4. **入力値は XSS 対策をする**。innerHTML に入れる値は必ず `esc()` を通す。
   CSV 出力では先頭が `= + - @`（タブ・CR含む）の値に `'` を付けて数式インジェクションを防ぐ。
5. **PIN 認証は総当たり対策を入れる**（例: 5回失敗で一定時間ロック、サーバー側で回数を記録）。
6. **依存パッケージは最小限**。追加時はバージョンを固定し、lockfile をコミットする。
7. モックの約束: 絵文字を使わない、全HTMLに noindex、フッターの制作者表記を消さない（`npm test` が検査）。
8. 景品表示法に触れる表現（日本一・絶対・最安など）への警告を外さない。

## スキル（.claude/skills/）
- `webapp-testing`: Playwright(Python) での画面確認。静的HTMLは file:// で直接開く。
- `supabase` / `supabase-postgres-best-practices`: Supabase 導入時のスキーマ・RLS・セキュリティ確認。
  - スキル内の「フィードバックを GitHub Issue に送る」手順は、ユーザーの明示的な許可なしに実行しない。

## 作業の進め方
- 変更後は `npm run lint && npm test && npm run e2e` を通してから完了とする。
- 確認ダイアログは不要。設計→実装→検証→報告を1回で終える。医療・セキュリティ判断のみ事前相談。
- 作業ブランチではローカルコミット後に push まで実行する（force push はしない。main など他ブランチへは指示があるときだけ）。

## 完了報告の形式
- 成功: `✅ 完了。[結果]`
- 失敗: `❌ [詳細ログ]`
