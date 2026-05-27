// i18n Translation System
import en from './en.json';
import zh from './zh.json';
import { useLanguage } from '../lib/LanguageContext';

const translations = { en, zh };

/**
 * Get translation for a key
 * @param {string} key - Dot-separated key path (e.g., 'common.loading')
 * @param {string} language - Language code ('en' or 'zh')
 * @param {object} params - Parameters to replace in the string (e.g., {name: 'John'})
 * @returns {string} Translated string or the key if not found
 */
export function t(key, language = 'en', params = {}) {
  const keys = key.split('.');
  let value = translations[language];

  for (const k of keys) {
    value = value?.[k];
  }

  // Fallback to English if not found in target language
  if (value === undefined) {
    value = translations['en'];
    for (const k of keys) {
      value = value?.[k];
    }
  }

  // Return key if still not found
  if (value === undefined) return key;

  // Replace parameters {name} -> value
  if (typeof value === 'string') {
    return value.replace(/\{(\w+)\}/g, (_, name) => params[name] ?? `{${name}}`);
  }

  return value;
}

/**
 * React hook for translations
 * Usage: const t = useT(); t('common.loading')
 */
export function useT() {
  const { language } = useLanguage();
  return (key, params) => t(key, language, params);
}

/**
 * Get current language from context (for non-component usage)
 */
export { useLanguage } from '../lib/LanguageContext';
