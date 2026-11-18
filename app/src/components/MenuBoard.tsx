'use client';
import { useEffect, useState } from 'react';
import { sb } from '@/lib/supabase';
import { DISCLAIMER, LANGS, UI, allergen, allergenLabel, localized, sortAllergens, type Lang, type MenuItem } from '@/lib/v2/allergens';

const NOT_CONFIRMED: Record<Lang, string> = {
  ja: 'アレルゲン情報は確認中です。スタッフにおたずねください',
  en: 'Allergen information is being checked. Please ask the staff.',
  zh: '过敏原信息确认中，请询问店员。',
  ko: '알레르기 정보를 확인 중입니다. 직원에게 문의해 주세요.',
};

export function AllergenBadges({ keys, lang }: { keys: string[]; lang: Lang }) {
  const list = sortAllergens(keys);
  if (list.length === 0) return <span className="muted">{UI[lang].allergens}: {UI[lang].none}</span>;
  return (
    <span aria-label={UI[lang].allergens}>
      {list.map((k) => {
        const a = allergen(k)!;
        return (
          <span key={k} className={`allergen ${a.mandatory ? 'm' : 'r'}`} title={a.mandatory ? UI[lang].mandatory : UI[lang].recommended}>
            <i aria-hidden>{a.mark}</i>{allergenLabel(k, lang)}
          </span>
        );
      })}
    </span>
  );
}

/** お客様向けのメニュー表示（多言語・アレルゲン・免責表示つき） */
export function MenuBoard() {
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [lang, setLang] = useState<Lang>('ja');
  useEffect(() => {
    void sb().from('menu_items').select('*').eq('active', true).order('sort').then(({ data }) => setItems((data as MenuItem[]) ?? []));
  }, []);
  const htmlLang = LANGS.find((l) => l.key === lang)!.htmlLang;
  return (
    <div className="menu-board" lang={htmlLang}>
      <div className="chips" role="tablist" aria-label="言語 / Language" style={{ marginBottom: 12 }}>
        {LANGS.map((l) => (
          <button key={l.key} role="tab" aria-selected={lang === l.key} className={`chip ${lang === l.key ? 'on' : ''}`} onClick={() => setLang(l.key)} lang={l.htmlLang} data-testid={`lang-${l.key}`}>{l.label}</button>
        ))}
      </div>
      <p className="disclaimer" role="note" data-testid="allergen-disclaimer">⚠ {DISCLAIMER[lang]}</p>
      {items === null && <p className="muted">…</p>}
      {items?.map((m) => {
        const t = localized(m, lang);
        return (
          <div key={m.id} className="card" data-testid="menu-board-item">
            <div className="item">
              <div className="grow">
                <h3 style={{ fontSize: '1.25rem' }} lang={t.fallback ? 'ja' : htmlLang}>{t.name}</h3>
                {t.description && <p lang={t.fallback ? 'ja' : htmlLang}>{t.description}</p>}
                {t.fallback && <p className="muted">{UI[lang].notTranslated}</p>}
              </div>
              {m.price !== null && <strong style={{ fontSize: '1.2rem' }}>¥{m.price.toLocaleString('ja-JP')}</strong>}
            </div>
            <div style={{ marginTop: 6 }}>
              {m.allergens_confirmed_at ? <AllergenBadges keys={m.allergens} lang={lang} /> : <span className="err">{NOT_CONFIRMED[lang]}</span>}
            </div>
          </div>
        );
      })}
      <p className="disclaimer" role="note">⚠ {DISCLAIMER[lang]}</p>
      <p className="muted">● {UI[lang].mandatory} ○ {UI[lang].recommended}</p>
    </div>
  );
}
