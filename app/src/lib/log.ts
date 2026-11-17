'use client';
import { sb } from './supabase';

export type ViewEvent = 'view_start' | 'view_end' | 'step_view';

/** 閲覧ログを記録（失敗しても画面の操作は止めない） */
export async function logView(
  storeId: string,
  type: ViewEvent,
  fields: { manual_id: string; session_id: string; step_id?: string | null; step_no?: number | null; value?: number | null; detail?: string },
  userId: string,
): Promise<void> {
  try {
    await sb().from('usage_events').insert({
      store_id: storeId,
      event_type: type,
      user_id: userId,
      ...fields,
    });
  } catch {
    /* noop */
  }
}
