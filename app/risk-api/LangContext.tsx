// Version 1.0 — app/risk-api/LangContext.tsx
//
// Same pattern as app/page.js's own language handling (existing file,
// not modified — that one manages its own `lang` useState directly
// inline since it's a single giant component; this page is split across
// several files, so the equivalent logic lives in a small context
// instead): auto-detect the browser's language on first visit, persist
// a manual pick to localStorage so it sticks and wins on future visits.
// Deliberately reuses the exact same localStorage key ('tnt_lang') as
// app/page.js — one site-wide language preference, not a separate one
// per page. Picking Russian on the homepage means /risk-api opens in
// Russian too, and vice versa.

'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { RISK_API_TRANSLATIONS, type LangCode, type RiskApiTranslations } from './i18n';

const LANG_STORAGE_KEY = 'tnt_lang';

interface LangContextValue {
  lang: LangCode;
  t: RiskApiTranslations;
  setLang: (l: LangCode) => void;
}

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_STORAGE_KEY);
      if (saved && RISK_API_TRANSLATIONS[saved as LangCode]) {
        setLangState(saved as LangCode);
        return;
      }
      const browserLang = (navigator.language || 'en').toLowerCase().split('-')[0];
      if (RISK_API_TRANSLATIONS[browserLang as LangCode]) {
        setLangState(browserLang as LangCode);
      }
    } catch {
      // localStorage/navigator unavailable (SSR edge case, privacy mode)
      // — just stay on the 'en' default.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLang = (l: LangCode) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_STORAGE_KEY, l);
    } catch {
      // ignore — worst case the pick doesn't persist across visits
    }
  };

  const t = RISK_API_TRANSLATIONS[lang] || RISK_API_TRANSLATIONS.en;

  return <LangContext.Provider value={{ lang, t, setLang }}>{children}</LangContext.Provider>;
}

export function useRiskApiLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) {
    throw new Error('useRiskApiLang() must be called from within <LangProvider>');
  }
  return ctx;
}
