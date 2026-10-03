/** Map with a size cap that evicts the least recently used entry. */
export class LruMap<K, V> {
  private readonly entries = new Map<K, V>();

  constructor(private readonly maxSize: number) {}

  get(key: K): V | undefined {
    const value = this.entries.get(key);
    if (value !== undefined) {
      // Re-insert to mark as most recently used (Map keeps insertion order).
      this.entries.delete(key);
      this.entries.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size > this.maxSize) {
      this.entries.delete(this.entries.keys().next().value as K);
    }
  }

  get size(): number {
    return this.entries.size;
  }

  /** Entries from least to most recently used. */
  toEntries(): Array<[K, V]> {
    return [...this.entries];
  }
}
