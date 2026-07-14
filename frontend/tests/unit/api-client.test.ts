import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, setAuthToken, setUnauthorizedHandler } from '@/lib/api/client';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const ok = <T>(data: T) => jsonResponse(200, { success: true, data });
const fail = (status: number, message: string) =>
  jsonResponse(status, { success: false, error: { message } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  setAuthToken(null);
  setUnauthorizedHandler(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  setAuthToken(null);
  setUnauthorizedHandler(null);
});

describe('response envelope', () => {
  it('unwraps { success, data } so callers never see the envelope', async () => {
    fetchMock.mockResolvedValue(ok([{ id: 1, name: 'Priya Sharma' }]));
    await expect(api.get('/api/users')).resolves.toEqual([{ id: 1, name: 'Priya Sharma' }]);
  });

  it('throws the backend message verbatim, with its status', async () => {
    fetchMock.mockResolvedValue(fail(400, 'Status must be one of: To Do, In Progress, Done'));

    // The server's copy is better than anything we'd invent — surface it as-is.
    await expect(api.patch('/api/tasks/1/status', { status: 'Nope' })).rejects.toThrow(
      'Status must be one of: To Do, In Progress, Done'
    );
  });

  it('returns undefined for 204 rather than trying to parse an empty body', async () => {
    // DELETE /api/tasks/:id answers 204 with no body; .json() on it would throw.
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api.delete('/api/tasks/1')).resolves.toBeUndefined();
  });

  it('reports a network failure as a human-readable error, not a raw TypeError', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(api.get('/api/projects')).rejects.toThrow(/Cannot reach the server/);
  });
});

describe('auth header', () => {
  it('omits Authorization when signed out', async () => {
    fetchMock.mockResolvedValue(ok([]));
    await api.get('/api/users');

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('sends Bearer <token> once signed in', async () => {
    setAuthToken('a.b.c');
    fetchMock.mockResolvedValue(ok([]));
    await api.get('/api/users');

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer a.b.c');
  });
});

/*
 * REGRESSION GUARD — the bug this suite exists for.
 *
 * The backend returns 401 for two unrelated things:
 *   /api/auth/login -> "wrong credentials" (a normal outcome)
 *   anything else   -> "your token is dead" (drop the session, go to /login)
 *
 * Conflating them made a failed login tell the user "Your session has expired.
 * Please sign in again." — to someone who had never signed in.
 */
describe('401 handling', () => {
  it('does NOT log out on a failed login; it surfaces the backend message', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    fetchMock.mockResolvedValue(fail(401, 'Invalid email or password'));

    await expect(
      api.post('/api/auth/login', { email: 'priya@kuberya.ai', password: 'wrong' })
    ).rejects.toThrow('Invalid email or password');

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('does NOT log out on a failed register either', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    fetchMock.mockResolvedValue(fail(401, 'Invalid email or password'));

    await expect(api.post('/api/auth/register', {})).rejects.toThrow();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('DOES log out when a protected route rejects the token', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    setAuthToken('expired.token');
    fetchMock.mockResolvedValue(fail(401, 'Invalid or expired token'));

    await expect(api.get('/api/projects')).rejects.toThrow(/session has expired/);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});

describe('voice availability', () => {
  it('flags a 503 so the UI can show "not configured" instead of a generic failure', async () => {
    fetchMock.mockResolvedValue(
      fail(503, 'Voice assignment is not configured on this server yet.')
    );

    const error = await api
      .postForm('/api/projects/1/tasks/voice/parse', new FormData())
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).isVoiceUnavailable).toBe(true);
  });

  it('does not set a Content-Type on multipart, so the browser can add the boundary', async () => {
    fetchMock.mockResolvedValue(ok({}));
    await api.postForm('/api/projects/1/tasks/voice/parse', new FormData());

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
  });
});
