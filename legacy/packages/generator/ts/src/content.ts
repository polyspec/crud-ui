/**
 * CRUDUI content translation (G3 axis 1: author translation of CONTENT).
 *
 * `LocalizedText` (types.ts:83) is a plain string OR a per-language LangMap
 * (`{ ko, en, ja, zh }`). This is the author-translated content axis — distinct
 * from the `lang` bucket (G3 axis 2: the field VALUE is per-language, a
 * structural input dimension handled by the lang container). `t()` resolves a
 * LocalizedText to a single string for the active language.
 */

import { isRecord } from './util';

/** Supported content language codes. */
export type Language = 'ko' | 'en' | 'ja' | 'zh';

/** Author-translated content: a string or a per-language map. */
export type LocalizedText = string | Record<string, string>;

/**
 * Resolve content for `language`: a string passes through; a language map yields the first
 * non-empty string entry for `language`, then `en`, then `ko`, then its first key; any other
 * value (a number, a boolean, an array or a map without such an entry) is the fallback.
 */
export function makeTranslate(language: Language): Translate {
  return function t(text: unknown, fallback = ''): string {
    if (typeof text === 'string') return text;
    if (!isRecord(text)) return fallback;
    for (const key of [language, 'en', 'ko', Object.keys(text)[0]]) {
      const entry = key === undefined ? undefined : text[key];
      if (typeof entry === 'string' && entry !== '') return entry;
    }
    return fallback;
  };
}

/**
 * Resolve content for the selected language: the text of the language, else English, Korean or the first entry, else
 * `fallback`. It takes any value of decoded JSON: a value that is no LocalizedText resolves to `fallback`.
 */
export type Translate = (text: unknown, fallback?: string) => string;
