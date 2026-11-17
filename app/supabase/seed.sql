-- ShopNavi 初期データ（デモ店舗・テンプレート6種・サンプルマニュアル1件・仮名スタッフ3名）
-- 初期PIN（デモ用）: 管理者 135790 / スタッフ 246802 → 試験導入前に必ず「設定」から変更してください
-- PIN はここで bcrypt ハッシュ化され、平文は DB に保存されません。

insert into public.templates (key, name, sort, description, questions) values
('open', '開店', 1, '開店前の準備の流れ', '[
  "お店に着いたら、最初に何をしますか？（鍵・照明・空調など）",
  "売場や客席の準備は、どこから何をしますか？",
  "レジ・つり銭の準備はどうしますか？",
  "商品や食材の確認は、何を見ますか？",
  "開店直前の最終チェックは何ですか？"
]'::jsonb),
('close', '閉店', 2, '閉店作業と戸締まり', '[
  "閉店の何分前から、何を始めますか？",
  "レジ締めはどの順番で行いますか？",
  "片付け・在庫の確認は何をしますか？",
  "火の元・電気・水道の確認はどうしますか？",
  "戸締まりと退店の手順は？"
]'::jsonb),
('clean', '掃除', 3, '日々の清掃', '[
  "掃除の前に準備する道具は何ですか？",
  "どこから順番に掃除しますか？",
  "特に汚れやすい場所と、その掃除方法は？",
  "使った道具の片付け方は？"
]'::jsonb),
('service', '接客', 4, 'お客様への対応', '[
  "お客様が来店されたら、最初にどう声をかけますか？",
  "ご案内・注文の受け方は？",
  "お会計のときに伝えることは？",
  "お見送りの言葉と動きは？",
  "困ったときは誰に、どう伝えますか？"
]'::jsonb),
('cook', '調理', 5, '調理の基本手順', '[
  "調理を始める前の準備は何ですか？",
  "材料の量り方・切り方のポイントは？",
  "加熱の時間や温度の目安は？（店のルールに従って記入）",
  "盛り付けの決まりは？",
  "提供前に確認することは？"
]'::jsonb),
('hygiene', '衛生', 6, '衛生管理（保健所の指導・HACCPに沿った衛生管理計画に合わせて記入）', '[
  "出勤時の体調・身だしなみの確認は？（店のルールに従って記入）",
  "手洗いのタイミングと方法は？",
  "器具・まな板などの洗浄と消毒は？",
  "冷蔵・冷凍庫の温度確認と記録は？",
  "体調が悪いとき・異常に気づいたときの報告先は？"
]'::jsonb)
on conflict (key) do update set name = excluded.name, sort = excluded.sort,
  description = excluded.description, questions = excluded.questions;

do $$
declare
  v_store uuid := '00000000-0000-4000-8000-000000000001';
  v_manual uuid := '00000000-0000-4000-8000-000000000101';
  v_steps jsonb;
begin
  insert into public.stores (id, code, name) values (v_store, 'demo', 'デモ店舗')
  on conflict (id) do nothing;

  insert into public.store_secrets (store_id, admin_pin_hash, staff_pin_hash)
  values (v_store,
    extensions.crypt('135790', extensions.gen_salt('bf', 10)),
    extensions.crypt('246802', extensions.gen_salt('bf', 10)))
  on conflict (store_id) do nothing;

  insert into public.staff_aliases (store_id, name) values
    (v_store, 'スタッフA'), (v_store, 'スタッフB'), (v_store, 'スタッフC')
  on conflict (store_id, name) do nothing;

  if not exists (select 1 from public.manuals where id = v_manual) then
    insert into public.manuals (id, store_id, template_key, title, status, version, has_unpublished_changes,
      draft_started_at, first_published_at, published_at, creation_seconds, created_by)
    values (v_manual, v_store, 'open', '開店準備（サンプル）', 'published', 1, false,
      now() - interval '20 minutes', now() - interval '8 minutes', now() - interval '8 minutes', 720, null);

    insert into public.manual_steps (id, manual_id, store_id, position, question, body) values
      ('00000000-0000-4000-8000-000000000201', v_manual, v_store, 1,
       'お店に着いたら、最初に何をしますか？（鍵・照明・空調など）', '裏口の鍵を開け、照明と空調のスイッチを入れる'),
      ('00000000-0000-4000-8000-000000000202', v_manual, v_store, 2,
       '売場や客席の準備は、どこから何をしますか？', '入口から奥へ、テーブルと椅子をふいて並べる'),
      ('00000000-0000-4000-8000-000000000203', v_manual, v_store, 3,
       'レジ・つり銭の準備はどうしますか？', 'つり銭を数えて、ノートに金額を書く'),
      ('00000000-0000-4000-8000-000000000204', v_manual, v_store, 4,
       '開店直前の最終チェックは何ですか？', '看板を出し、入口の札を「営業中」にする');

    select jsonb_agg(jsonb_build_object('id', id, 'no', position, 'question', question, 'body', body,
      'photo_path', photo_path) order by position)
    into v_steps from public.manual_steps where manual_id = v_manual;

    insert into public.manual_revisions (manual_id, store_id, version, title, steps, note)
    values (v_manual, v_store, 1, '開店準備（サンプル）', v_steps, 'サンプルとして登録');
    update public.manuals set has_unpublished_changes = false where id = v_manual;

    insert into public.quiz_questions (store_id, manual_id, step_id, step_no, question, choices, correct_index) values
      (v_store, v_manual, '00000000-0000-4000-8000-000000000203', 3,
       'つり銭を数えたあと、何をしますか？', '["ノートに金額を書く","すぐに開店する","店長に電話する"]'::jsonb, 0);
  end if;
end $$;
