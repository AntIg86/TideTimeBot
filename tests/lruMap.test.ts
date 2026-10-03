import { describe, expect, it } from 'vitest';
import { LruMap } from '../src/services/lruMap';

describe('LruMap', () => {
  it('evicts the least recently used entry beyond the cap', () => {
    const map = new LruMap<string, number>(2);
    map.set('a', 1);
    map.set('b', 2);
    map.get('a'); // "b" is now the least recently used
    map.set('c', 3);

    expect(map.size).toBe(2);
    expect(map.get('b')).toBeUndefined();
    expect(map.toEntries()).toEqual([['a', 1], ['c', 3]]);
  });

  it('updates existing keys without growing', () => {
    const map = new LruMap<string, number>(2);
    map.set('a', 1);
    map.set('a', 2);
    expect(map.size).toBe(1);
    expect(map.get('a')).toBe(2);
  });
});
