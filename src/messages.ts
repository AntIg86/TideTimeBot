const messages = {
  welcome:
    'Welcome! 🌊\nI show tide times for today and the next 7 days.\n\n' +
    'Send me a city name (e.g. "Lisbon") or share a location 📍.\n' +
    'Use /location <city> to check which place I find.',
  locationUsage: 'Please provide a city name. Usage: /location <city>',
  locationFound: 'Found: {name}\nLatitude: {lat}\nLongitude: {lon}',
  queryTooLong: 'The name is too long. Please send a shorter city name.',
  cityNotFound: 'Could not find "{city}". Try another spelling or a nearby city.',
  noTideData: 'No tide data for this place. Try a coastal location.',
  apiTimeout: 'The data service is not responding. Please try again in a minute.',
  apiError: 'The data service returned an error. Please try again later.',
  unexpectedError: 'Something went wrong. Please try again later.',
  title: 'Tide forecast',
  now: 'Now',
  rising: 'rising',
  falling: 'falling',
  unknown: 'unknown',
  next: 'Next',
  at: 'at',
  high: 'high tide',
  low: 'low tide',
  today: 'Today',
  noTides: 'no tides',
  waves: 'Waves',
  wind: 'Wind',
  sun: 'Sun',
  upToMeters: 'up to {value} m',
  upToSpeed: 'up to {value} m/s',
  upcoming: 'Next {days} days',
  seaPoint: 'tides for the nearest sea point, {km} km away',
  negligibleTides: 'Tides here are negligible: the sea level only drifts with wind and pressure.',
  meters: 'm',
} as const;

export type MessageKey = keyof typeof messages;
export type MessageParams = Record<string, string | number>;

export function t(key: MessageKey, params: MessageParams = {}): string {
  return messages[key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
