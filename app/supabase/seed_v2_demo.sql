-- ShopNavi v2 デモ用データ（すべて架空。実在の企業名・店名・数値ではありません）
-- * デモ店舗（店舗コード demo）でだけ新機能のフラグを ON にする
-- * パートナー集計用に、架空の店舗8店と架空の卸「デモ卸（架空）」を作る
-- * 本番の試験導入店舗には適用しないこと（本番へ反映する際は、このファイルを実行しない）
-- デモ用パートナーの初期PIN: 864209（架空データ閲覧用。デモ以外では使わない）

do $$
declare
  v_demo uuid := '00000000-0000-4000-8000-000000000001';
  v_partner uuid := '00000000-0000-4000-8000-00000000d001';
  v_store uuid;
  v_manual uuid;
  i int;
  j int;
  v_cat text;
  v_manuals int[] := array[5, 3, 4, 6, 2, 4, 3, 5];
  v_conf int[] := array[4, 9, 2, 6, 11, 3, 5, 1];
  v_active boolean[] := array[true, true, false, true, true, true, false, true];
  v_cats text[] := array['居酒屋', '居酒屋', '居酒屋', 'カフェ', 'カフェ', 'カフェ', '定食屋', '居酒屋'];
  f text;
begin
  -- デモ店舗: 新機能を ON（デモ店舗自体はパートナー集計には参加しない）
  foreach f in array array['voice_input','promo_image','template_share','invite','menu_i18n','staff_profile'] loop
    insert into public.store_features (store_id, feature, enabled) values (v_demo, f, true)
    on conflict (store_id, feature) do update set enabled = true, updated_at = now();
  end loop;

  -- 架空のパートナー
  insert into public.partners (id, code, name, is_demo) values (v_partner, 'demo-partner', 'デモ卸（架空）', true)
  on conflict (id) do nothing;
  insert into public.partner_secrets (partner_id, pin_hash)
  values (v_partner, extensions.crypt('864209', extensions.gen_salt('bf', 10)))
  on conflict (partner_id) do nothing;

  -- 架空の取引先店舗8店（8店目は集計への参加に同意していない想定＝集計に含まれない）
  for i in 1..8 loop
    v_store := ('00000000-0000-4000-8000-0000000fa0' || lpad(i::text, 2, '0'))::uuid;
    v_cat := v_cats[i];
    insert into public.stores (id, code, name) values (v_store, 'fake-store-' || i, '架空の' || v_cat || i)
    on conflict (id) do nothing;
    insert into public.partner_stores (partner_id, store_id, category, joined_at)
    values (v_partner, v_store, v_cat, now() - (i * 9 || ' days')::interval)
    on conflict do nothing;
    insert into public.store_features (store_id, feature, enabled) values (v_store, 'partner_share', i <> 8)
    on conflict (store_id, feature) do nothing;

    if not exists (select 1 from public.manuals m where m.store_id = v_store) then
      for j in 1..v_manuals[i] loop
        v_manual := gen_random_uuid();
        insert into public.manuals (id, store_id, title, status, version, has_unpublished_changes, published_at, first_published_at)
        values (v_manual, v_store, '架空マニュアル' || j, 'published', 1, false, now() - interval '5 days', now() - interval '5 days');
      end loop;
      select m.id into v_manual from public.manuals m where m.store_id = v_store limit 1;
      for j in 1..v_conf[i] loop
        insert into public.confusions (store_id, manual_id, step_no, created_at)
        values (v_store, v_manual, 1 + (j % 3), now() - ((j * 2) || ' days')::interval);
      end loop;
      if not v_active[i] then
        -- 直近30日の利用がない店舗（継続率の計算用）。「わからない」も30日より前にずらす
        update public.confusions set created_at = now() - interval '45 days' where store_id = v_store;
        update public.usage_events set created_at = now() - interval '45 days' where store_id = v_store;
      end if;
    end if;
  end loop;

  -- デモ店舗の架空メニュー
  if not exists (select 1 from public.menu_items m where m.store_id = v_demo) then
    insert into public.menu_items (store_id, name_ja, description_ja, price, allergens, translations, sort, allergens_confirmed_at) values
      (v_demo, '鶏の唐揚げ（架空のサンプル）', '下味をつけた鶏もも肉を揚げました', 680, array['wheat','egg','soybean','chicken'],
       '{"en":{"name":"Fried chicken (fictional sample)","description":"Marinated chicken thigh, deep-fried","confirmed":true},
         "zh":{"name":"炸鸡块（虚构示例）","description":"腌制鸡腿肉油炸","confirmed":true},
         "ko":{"name":"닭튀김 (가상 샘플)","description":"양념한 닭다리살 튀김","confirmed":false}}'::jsonb, 1, now()),
      (v_demo, 'だし巻き玉子（架空のサンプル）', 'だしの入った卵焼き', 580, array['egg','soybean'],
       '{"en":{"name":"Japanese rolled omelet (fictional sample)","description":"Rolled omelet with dashi broth","confirmed":true}}'::jsonb, 2, now()),
      (v_demo, '枝豆（架空のサンプル）', '塩ゆでの枝豆', 380, array['soybean'], '{}'::jsonb, 3, null);
  end if;
end $$;
