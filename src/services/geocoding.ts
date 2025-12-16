import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), 'cities_cache.json');

interface Coordinates {
  lat: number;
  lon: number;
  displayName: string;
}

interface Cache {
  [key: string]: Coordinates;
}

async function loadCache(): Promise<Cache> {
  try {
    if (await fs.pathExists(CACHE_FILE)) {
      return await fs.readJson(CACHE_FILE);
    }
  } catch (error) {
    console.error('Error loading cache:', error);
  }
  return {};
}

async function saveCache(cache: Cache): Promise<void> {
  try {
    await fs.writeJson(CACHE_FILE, cache, { spaces: 2 });
  } catch (error) {
    console.error('Error saving cache:', error);
  }
}

export async function getCoordinates(city: string): Promise<Coordinates> {
  const normalizedCity = city.trim().toLowerCase();
  const cache = await loadCache();

  if (cache[normalizedCity]) {
    return cache[normalizedCity];
  }

  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: city,
        format: 'json',
        limit: 1,
      },
      headers: {
        'User-Agent': 'TideTimeBot/1.0',
      },
    });

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      const coordinates: Coordinates = {
        lat: parseFloat(result.lat),
        lon: parseFloat(result.lon),
        displayName: result.display_name,
      };

      cache[normalizedCity] = coordinates;
      await saveCache(cache);

      return coordinates;
    } else {
      throw new Error(`City "${city}" not found.`);
    }
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Geocoding API error: ${error.message}`);
    }
    throw error;
  }
}
