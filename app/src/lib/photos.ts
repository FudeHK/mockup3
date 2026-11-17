'use client';
import { useEffect, useState } from 'react';
import { sb, PHOTO_BUCKET } from './supabase';

/** 非公開バケットの写真を期限付きURLに変換する */
export function useSignedUrls(paths: (string | null | undefined)[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = paths.filter(Boolean).sort().join('|');
  useEffect(() => {
    const list = key ? key.split('|') : [];
    if (list.length === 0) return;
    let alive = true;
    void sb()
      .storage.from(PHOTO_BUCKET)
      .createSignedUrls(list, 60 * 60)
      .then(({ data }) => {
        if (!alive || !data) return;
        const map: Record<string, string> = {};
        for (const d of data) if (d.signedUrl && d.path) map[d.path] = d.signedUrl;
        setUrls((u) => ({ ...u, ...map }));
      });
    return () => {
      alive = false;
    };
  }, [key]);
  return urls;
}
