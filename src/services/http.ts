import { UserError } from '../errors';

const DEFAULT_TIMEOUT_MS = 5000;

interface FetchJsonOptions {
  timeoutMs?: number;
  headers?: Record<string, string>;
}

export async function fetchJson<T>(url: URL, options: FetchJsonOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: options.headers,
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new UserError('apiTimeout', {}, { cause: error });
    }
    throw error;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error(`HTTP ${response.status} from ${url.host}${url.pathname}: ${body.slice(0, 500)}`);
    throw new UserError('apiError');
  }

  return (await response.json()) as T;
}
