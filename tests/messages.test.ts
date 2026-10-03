import { describe, expect, it } from 'vitest';
import { t } from '../src/messages';

describe('t', () => {
  it('substitutes parameters', () => {
    expect(t('cityNotFound', { city: 'Atlantis' })).toBe('Could not find "Atlantis". Try another spelling or a nearby city.');
  });

  it('leaves unknown placeholders intact', () => {
    expect(t('upcoming')).toBe('Next {days} days');
  });
});
