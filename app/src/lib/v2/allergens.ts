// E. アレルゲン表示（店主の入力のみ。自動判定はしない）
// 食品表示基準の「特定原材料」8品目と「特定原材料に準ずるもの」20品目（2025年4月時点の区分）

export type Lang = 'ja' | 'en' | 'zh' | 'ko';
export const LANGS: { key: Lang; label: string; htmlLang: string }[] = [
  { key: 'ja', label: '日本語', htmlLang: 'ja' },
  { key: 'en', label: 'English', htmlLang: 'en' },
  { key: 'zh', label: '中文', htmlLang: 'zh-Hans' },
  { key: 'ko', label: '한국어', htmlLang: 'ko' },
];
export const TRANSLATED: Exclude<Lang, 'ja'>[] = ['en', 'zh', 'ko'];

export type Allergen = { key: string; mandatory: boolean; mark: string; ja: string; en: string; zh: string; ko: string };

export const ALLERGENS: Allergen[] = [
  { key: 'shrimp', mandatory: true, mark: 'エビ', ja: 'えび', en: 'Shrimp', zh: '虾', ko: '새우' },
  { key: 'crab', mandatory: true, mark: 'カニ', ja: 'かに', en: 'Crab', zh: '蟹', ko: '게' },
  { key: 'walnut', mandatory: true, mark: 'クル', ja: 'くるみ', en: 'Walnut', zh: '核桃', ko: '호두' },
  { key: 'wheat', mandatory: true, mark: '麦', ja: '小麦', en: 'Wheat', zh: '小麦', ko: '밀' },
  { key: 'buckwheat', mandatory: true, mark: 'ソバ', ja: 'そば', en: 'Buckwheat', zh: '荞麦', ko: '메밀' },
  { key: 'egg', mandatory: true, mark: '卵', ja: '卵', en: 'Egg', zh: '鸡蛋', ko: '달걀' },
  { key: 'milk', mandatory: true, mark: '乳', ja: '乳', en: 'Milk', zh: '乳制品', ko: '우유' },
  { key: 'peanut', mandatory: true, mark: '落', ja: '落花生', en: 'Peanut', zh: '花生', ko: '땅콩' },
  { key: 'almond', mandatory: false, mark: 'アモ', ja: 'アーモンド', en: 'Almond', zh: '杏仁', ko: '아몬드' },
  { key: 'abalone', mandatory: false, mark: 'アワ', ja: 'あわび', en: 'Abalone', zh: '鲍鱼', ko: '전복' },
  { key: 'squid', mandatory: false, mark: 'イカ', ja: 'いか', en: 'Squid', zh: '鱿鱼', ko: '오징어' },
  { key: 'salmon_roe', mandatory: false, mark: 'イク', ja: 'いくら', en: 'Salmon roe', zh: '鲑鱼子', ko: '연어알' },
  { key: 'orange', mandatory: false, mark: 'オレ', ja: 'オレンジ', en: 'Orange', zh: '橙子', ko: '오렌지' },
  { key: 'cashew', mandatory: false, mark: 'カシ', ja: 'カシューナッツ', en: 'Cashew', zh: '腰果', ko: '캐슈너트' },
  { key: 'kiwi', mandatory: false, mark: 'キウ', ja: 'キウイフルーツ', en: 'Kiwi fruit', zh: '猕猴桃', ko: '키위' },
  { key: 'beef', mandatory: false, mark: '牛', ja: '牛肉', en: 'Beef', zh: '牛肉', ko: '소고기' },
  { key: 'sesame', mandatory: false, mark: 'ゴマ', ja: 'ごま', en: 'Sesame', zh: '芝麻', ko: '참깨' },
  { key: 'salmon', mandatory: false, mark: 'サケ', ja: 'さけ', en: 'Salmon', zh: '鲑鱼', ko: '연어' },
  { key: 'mackerel', mandatory: false, mark: 'サバ', ja: 'さば', en: 'Mackerel', zh: '鲭鱼', ko: '고등어' },
  { key: 'soybean', mandatory: false, mark: '豆', ja: '大豆', en: 'Soybean', zh: '大豆', ko: '대두' },
  { key: 'chicken', mandatory: false, mark: '鶏', ja: '鶏肉', en: 'Chicken', zh: '鸡肉', ko: '닭고기' },
  { key: 'banana', mandatory: false, mark: 'バナ', ja: 'バナナ', en: 'Banana', zh: '香蕉', ko: '바나나' },
  { key: 'pork', mandatory: false, mark: '豚', ja: '豚肉', en: 'Pork', zh: '猪肉', ko: '돼지고기' },
  { key: 'macadamia', mandatory: false, mark: 'マカ', ja: 'マカダミアナッツ', en: 'Macadamia nut', zh: '夏威夷果', ko: '마카다미아' },
  { key: 'peach', mandatory: false, mark: 'モモ', ja: 'もも', en: 'Peach', zh: '桃子', ko: '복숭아' },
  { key: 'yam', mandatory: false, mark: 'ヤマ', ja: 'やまいも', en: 'Yam', zh: '山药', ko: '마' },
  { key: 'apple', mandatory: false, mark: 'リン', ja: 'りんご', en: 'Apple', zh: '苹果', ko: '사과' },
  { key: 'gelatin', mandatory: false, mark: 'ゼラ', ja: 'ゼラチン', en: 'Gelatin', zh: '明胶', ko: '젤라틴' },
];
export const ALLERGEN_KEYS = ALLERGENS.map((a) => a.key);
const BY_KEY = new Map(ALLERGENS.map((a) => [a.key, a]));
export const allergen = (k: string) => BY_KEY.get(k);

/** 必ず表示する免責（全言語） */
export const DISCLAIMER: Record<Lang, string> = {
  ja: 'アレルゲン情報は店主が入力したものです。最新の情報は店舗に確認してください。',
  en: 'Allergen information is entered by the restaurant. Please check the latest information with the staff.',
  zh: '过敏原信息由店铺填写。最新信息请向店员确认。',
  ko: '알레르기 정보는 매장에서 입력한 것입니다. 최신 정보는 매장에 확인해 주세요.',
};
export const UI: Record<Lang, { allergens: string; none: string; notTranslated: string; mandatory: string; recommended: string }> = {
  ja: { allergens: 'アレルゲン', none: '入力なし', notTranslated: '', mandatory: '特定原材料', recommended: '準ずるもの' },
  en: { allergens: 'Allergens', none: 'None entered', notTranslated: 'Translation not yet confirmed (shown in Japanese)', mandatory: 'Major', recommended: 'Other' },
  zh: { allergens: '过敏原', none: '未填写', notTranslated: '翻译尚未确认（以日语显示）', mandatory: '主要', recommended: '其他' },
  ko: { allergens: '알레르기', none: '입력 없음', notTranslated: '번역이 아직 확인되지 않았습니다 (일본어로 표시)', mandatory: '주요', recommended: '기타' },
};

export type Translation = { name?: string; description?: string; confirmed?: boolean };
export type MenuItem = {
  id: string;
  name_ja: string;
  description_ja: string;
  price: number | null;
  allergens: string[];
  allergens_confirmed_at: string | null;
  translations: Partial<Record<Exclude<Lang, 'ja'>, Translation>>;
  sort: number;
  active: boolean;
  updated_at?: string;
};

/** 表示名。確定した翻訳だけを使い、未確定なら日本語を出す */
export function localized(item: Pick<MenuItem, 'name_ja' | 'description_ja' | 'translations'>, lang: Lang): { name: string; description: string; fallback: boolean } {
  if (lang === 'ja') return { name: item.name_ja, description: item.description_ja, fallback: false };
  const t = item.translations?.[lang];
  if (t?.confirmed && t.name?.trim()) return { name: t.name, description: t.description ?? '', fallback: false };
  return { name: item.name_ja, description: item.description_ja, fallback: true };
}

/** 未知のキーを捨て、表示順（特定原材料→準ずるもの）に並べる */
export function sortAllergens(keys: string[]): string[] {
  const set = new Set(keys);
  return ALLERGEN_KEYS.filter((k) => set.has(k));
}

export function allergenLabel(k: string, lang: Lang): string {
  const a = allergen(k);
  return a ? a[lang] : '';
}
