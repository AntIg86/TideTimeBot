import { describe, expect, it } from 'vitest';

process.env.BOT_TOKEN ??= 'test-token';
const { getCoordinates, shortenName } = await import('../src/services/geocoding');

describe('shortenName', () => {
  it('keeps the first and last parts of a long name', () => {
    expect(shortenName('Волгоград, городской округ Волгоград, Волгоградская область, Россия')).toBe('Волгоград, Россия');
  });

  it('keeps short names as is', () => {
    expect(shortenName('Lisboa, Portugal')).toBe('Lisboa, Portugal');
  });
});

describe('getCoordinates', () => {
  it('rejects overly long queries before calling Nominatim', async () => {
    await expect(getCoordinates('x'.repeat(101), 'en')).rejects.toMatchObject({ key: 'queryTooLong' });
  });
});
