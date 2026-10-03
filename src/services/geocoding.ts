import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config';
import { UserError } from '../errors';
import type { Locale } from '../i18n';
import { fetchJson } from './http';

// Vercel only allows writing to /tmp; locally keep the cache next to the project.
const CACHE_FILE = process.env.VERCEL
  ? '/tmp/cities_cache.json'
  : path.join(process.cwd(), 'cities_cache.json');

const MAX_QUERY_LENGTH = 100;
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const USER_AGENT = `TideTimeBot/1.1${config.nominatimEmail ? ` (${config.nominatimEmail})` : ''}`;

export interface Place {
  lat: number;
  lon: number;
  /** Full Nominatim display name. */
  displayName: string;
  /** Short "City, Country" label for messages. */
  shortName: string;
}

interface NominatimPlace {
  lat: string;
  lon: string;
  display_name: string;
}

let cache: Map<string, Place> | null = null;
let pendingSave: Promise<void> = Promise.resolve();

async function getCache(): Promise<Map<string, Place>> {
  if (!cache) {
    try {
      const raw = JSON.parse(await readFile(CACHE_FILE, 'utf8')) as Record<string, Place>;
      // Entries written by older versions have no shortName; drop them.
      cache = new Map(Object.entries(raw).filter(([, place]) => place.shortName));
    } catch {
      cache = new Map();
    }
  }
  return cache;
}

function saveCache(entries: Map<string, Place>): void {
  // Serialize writes so concurrent lookups don't interleave partial files.
  pendingSave = pendingSave
    .then(() => writeFile(CACHE_FILE, JSON.stringify(Object.fromEntries(entries), null, 2)))
    .catch((error) => console.error('Error saving geocoding cache:', error));
}

export function shortenName(displayName: string): string {
  const parts = displayName.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 2) return parts.join(', ');
  return `${parts[0]}, ${parts[parts.length - 1]}`;
}

function toPlace(result: NominatimPlace): Place {
  return {
    lat: Number(result.lat),
    lon: Number(result.lon),
    displayName: result.display_name,
    shortName: shortenName(result.display_name),
  };
}

function nominatimRequest(endpoint: string, params: Record<string, string>, locale: Locale) {
  const url = new URL(endpoint, NOMINATIM_URL);
  url.search = new URLSearchParams({ ...params, format: 'json', 'accept-language': locale }).toString();
  return url;
}

export async function getCoordinates(city: string, locale: Locale): Promise<Place> {
  const query = city.trim();
  if (query.length > MAX_QUERY_LENGTH) {
    throw new UserError('queryTooLong');
  }

  const key = `${locale}:${query.toLowerCase()}`;
  const entries = await getCache();

  const cached = entries.get(key);
  if (cached) return cached;

  const results = await fetchJson<NominatimPlace[]>(
    nominatimRequest('/search', { q: query, limit: '1' }, locale),
    { headers: { 'User-Agent': USER_AGENT } },
  );

  const [first] = results;
  if (!first) {
    throw new UserError('cityNotFound', { city: query });
  }

  const place = toPlace(first);
  entries.set(key, place);
  saveCache(entries);
  return place;
}

/** Names a point the user shared; falls back to raw coordinates if Nominatim fails. */
export async function reverseGeocode(lat: number, lon: number, locale: Locale): Promise<Place> {
  const fallback = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  try {
    const result = await fetchJson<NominatimPlace | { error: string }>(
      nominatimRequest('/reverse', { lat: String(lat), lon: String(lon), zoom: '10' }, locale),
      { headers: { 'User-Agent': USER_AGENT } },
    );
    if ('display_name' in result) {
      return { ...toPlace(result), lat, lon };
    }
  } catch (error) {
    console.error('Reverse geocoding failed:', error);
  }
  return { lat, lon, displayName: fallback, shortName: fallback };
}
