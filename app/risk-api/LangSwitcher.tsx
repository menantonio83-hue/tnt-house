// Version 1.0 — app/risk-api/LangSwitcher.tsx
//
// Same flag-row markup/behavior as app/page.js's inline language
// switcher (existing file, not modified) — active flag at full opacity
// + slightly scaled up, inactive flags dimmed to 40% opacity, title
// attribute for the language name as a tooltip.

'use client';

import { RISK_API_TRANSLATIONS } from './i18n';
import { useRiskApiLang } from './LangContext';

export default function LangSwitcher() {
  const { lang, setLang } = useRiskApiLang();

  return (
    <div className="flex items-center gap-0.5">
      {Object.keys(RISK_API_TRANSLATIONS).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l as keyof typeof RISK_API_TRANSLATIONS)}
          title={RISK_API_TRANSLATIONS[l as keyof typeof RISK_API_TRANSLATIONS].name}
          className={
            'text-base px-1 py-0.5 rounded transition ' +
            (lang === l ? 'opacity-100 scale-110' : 'opacity-40 hover:opacity-80')
          }
        >
          {RISK_API_TRANSLATIONS[l as keyof typeof RISK_API_TRANSLATIONS].flag}
        </button>
      ))}
    </div>
  );
}
