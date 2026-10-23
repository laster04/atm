import i18n, { type LanguageDetectorModule } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import cs from './locales/cs.json';
import { DEFAULT_LANGUAGE, LANGUAGES, languageOf } from './languages';

const STORAGE_KEY = 'i18nextLng';

/** Languages beyond Czech and English are loaded only when someone uses them. */
const LOADERS: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
	sk: () => import('./locales/sk.json'),
};

const stored = (): string | null => {
	try {
		return localStorage.getItem(STORAGE_KEY);
	} catch {
		return null;
	}
};

/**
 * ?lang=xx first (how a language is checked before launch), then the choice
 * remembered from an earlier visit, then the browser's languages, but only
 * live ones: a Slovak browser does not get Slovak before it is checked.
 */
const detector: LanguageDetectorModule = {
	type: 'languageDetector',
	detect: () => {
		const asked = languageOf(new URLSearchParams(window.location.search).get('lang'));
		if (asked) return asked.code;
		const remembered = languageOf(stored());
		if (remembered) return remembered.code;
		for (const tag of navigator.languages ?? [navigator.language]) {
			const language = languageOf(tag);
			if (language?.live) return language.code;
		}
		return DEFAULT_LANGUAGE;
	},
	cacheUserLanguage: (lng: string) => {
		try {
			localStorage.setItem(STORAGE_KEY, lng);
		} catch {
			// Private mode: the choice simply is not remembered.
		}
	},
};

/** Loads a language's texts the first time it is needed. */
export async function loadLanguage(lng: string): Promise<void> {
	const code = languageOf(lng)?.code;
	if (!code || i18n.hasResourceBundle(code, 'translation')) return;
	const loader = LOADERS[code];
	if (!loader) return;
	const module = await loader();
	i18n.addResourceBundle(code, 'translation', module.default, true, true);
}

i18n
  .use(detector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      cs: { translation: cs }
    },
    // Languages that are not bundled are added on demand by loadLanguage.
    partialBundledLanguages: true,
    supportedLngs: LANGUAGES.map((language) => language.code),
    fallbackLng: Object.fromEntries([
      ...LANGUAGES.map((language) => [language.code, language.fallback]),
      ['default', [DEFAULT_LANGUAGE]],
    ]),
    interpolation: {
      escapeValue: false
    },
    // Re-render once a language loaded on demand arrives.
    react: { bindI18nStore: 'added' },
  });

void loadLanguage(i18n.language);

// ?lang= has done its job once the choice is remembered; leaving it in the
// address would undo a later pick from the menu on the next reload.
const params = new URLSearchParams(window.location.search);
if (params.has('lang')) {
  params.delete('lang');
  const search = params.toString();
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`);
}
i18n.on('languageChanged', (lng) => {
  void loadLanguage(lng);
  document.documentElement.lang = lng;
});
document.documentElement.lang = i18n.language;

export default i18n;
