import { describe, expect, it } from 'vitest';
import { resolveLocale, t } from '../src/i18n';

describe('resolveLocale', () => {
  it('maps Russian language codes to ru', () => {
    expect(resolveLocale('ru')).toBe('ru');
    expect(resolveLocale('ru-RU')).toBe('ru');
  });

  it('falls back to en', () => {
    expect(resolveLocale('de')).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
  });
});

describe('t', () => {
  it('substitutes parameters', () => {
    expect(t('en', 'cityNotFound', { city: 'Atlantis' })).toContain('"Atlantis"');
  });
});
