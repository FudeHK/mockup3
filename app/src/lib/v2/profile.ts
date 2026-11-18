// F. スタッフの自己申告プロフィール（選択式。推測・診断はしない）

export type Category = 'skill' | 'experience' | 'wish';
export const CATEGORIES: { key: Category; label: string; multi: boolean; options: string[] }[] = [
  { key: 'skill', label: '得意な作業', multi: true, options: ['接客', 'レジ', '調理', '仕込み', '盛り付け', '掃除', '発注・在庫', '新人への説明'] },
  { key: 'experience', label: '飲食店での経験', multi: false, options: ['飲食店は初めて', '1年未満', '1〜3年', '3年以上'] },
  { key: 'wish', label: 'これからの希望', multi: true, options: ['接客をもっとしたい', '調理を覚えたい', 'レジを覚えたい', '新人に教えたい', 'シフトを増やしたい', 'シフトを減らしたい', '今のままでよい'] },
];

export const PROFILE_NOTICE =
  'この情報はスタッフ本人の自己申告です。評価・人事判断（採用・配置・給与・契約更新など）に使うことは禁止しています。しぐさや口癖などからの推測・診断は行いません。';

export type ProfileItem = { category: Category; value: string; shared: boolean };

/** 選択状態の差分（追加・削除・公開設定の変更）を計算する */
export function diffProfile(before: ProfileItem[], after: ProfileItem[]) {
  const key = (i: ProfileItem) => `${i.category}|${i.value}`;
  const b = new Map(before.map((i) => [key(i), i]));
  const a = new Map(after.map((i) => [key(i), i]));
  const add = after.filter((i) => !b.has(key(i)));
  const remove = before.filter((i) => !a.has(key(i)));
  const update = after.filter((i) => b.has(key(i)) && b.get(key(i))!.shared !== i.shared);
  return { add, remove, update };
}

/** 各カテゴリの公開設定をまとめて適用する */
export function applyShare(items: ProfileItem[], share: Record<Category, boolean>): ProfileItem[] {
  return items.map((i) => ({ ...i, shared: Boolean(share[i.category]) }));
}

export function isValid(item: ProfileItem): boolean {
  const c = CATEGORIES.find((x) => x.key === item.category);
  return Boolean(c && c.options.includes(item.value));
}
