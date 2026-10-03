export type Locale = 'en' | 'ru';

const en = {
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
  waves: 'waves up to {value} m',
  wind: 'wind up to {value} m/s',
  upcoming: 'Next days',
  meters: 'm',
} as const;

export type MessageKey = keyof typeof en;

const ru: Record<MessageKey, string> = {
  welcome:
    'Привет! 🌊\nЯ показываю приливы и отливы на сегодня и на 7 дней вперёд.\n\n' +
    'Отправь название города (например, «Лиссабон») или геолокацию 📍.\n' +
    'Команда /location <город> покажет, какое место я нашёл.',
  locationUsage: 'Укажи название города. Пример: /location Лиссабон',
  locationFound: 'Найдено: {name}\nШирота: {lat}\nДолгота: {lon}',
  queryTooLong: 'Слишком длинное название. Отправь название города покороче.',
  cityNotFound: 'Не удалось найти «{city}». Попробуй другое написание или соседний город.',
  noTideData: 'Для этого места нет данных о приливах. Попробуй прибрежный город.',
  apiTimeout: 'Сервис данных не отвечает. Попробуй ещё раз через минуту.',
  apiError: 'Сервис данных вернул ошибку. Попробуй позже.',
  unexpectedError: 'Что-то пошло не так. Попробуй позже.',
  title: 'Прогноз приливов',
  now: 'Сейчас',
  rising: 'прилив',
  falling: 'отлив',
  unknown: 'неизвестно',
  next: 'Далее',
  at: 'в',
  high: 'полная вода',
  low: 'малая вода',
  today: 'Сегодня',
  noTides: 'нет данных',
  waves: 'волны до {value} м',
  wind: 'ветер до {value} м/с',
  upcoming: 'Следующие дни',
  meters: 'м',
};

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, ru };

export function resolveLocale(languageCode: string | undefined): Locale {
  return languageCode?.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export type MessageParams = Record<string, string | number>;

export function t(locale: Locale, key: MessageKey, params: MessageParams = {}): string {
  return dictionaries[locale][key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
