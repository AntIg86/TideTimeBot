import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserError } from '../src/errors';
import { fetchJson } from '../src/services/http';

const timeoutError = () => new DOMException('The operation was aborted due to timeout', 'TimeoutError');

afterEach(() => vi.unstubAllGlobals());

describe('fetchJson', () => {
  it('maps a timeout before the response to apiTimeout', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeoutError()));
    await expect(fetchJson(new URL('https://example.com'))).rejects.toMatchObject({ key: 'apiTimeout' });
  });

  it('maps a timeout while reading the body to apiTimeout', async () => {
    const response = { ok: true, json: () => Promise.reject(timeoutError()) };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(fetchJson(new URL('https://example.com'))).rejects.toMatchObject({ key: 'apiTimeout' });
  });

  it('maps HTTP errors to apiError', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 502 })));
    const error = await fetchJson(new URL('https://example.com')).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UserError);
    expect(error).toMatchObject({ key: 'apiError' });
  });
});
