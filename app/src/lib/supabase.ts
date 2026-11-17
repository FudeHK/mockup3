'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ブラウザ用クライアント。公開してよい URL と anon(publishable) キーのみを使う。
// サービスロールキーはこのアプリでは一切使用しない。
let client: SupabaseClient | null = null;

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function sb(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Supabase の環境変数が設定されていません');
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'shopnavi-auth' },
    });
  }
  return client;
}

export const PHOTO_BUCKET = 'manual-photos';
