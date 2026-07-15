import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authFetch } from '@/lib/auth-fetch';

const mockGetSession = vi.fn();

vi.mock('@/lib/supabase-client', () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      getSession: mockGetSession,
    },
  }),
}));

describe('authFetch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGetSession.mockReset();
  });

  it('throws when no session exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    await expect(authFetch('/api/test')).rejects.toThrow('Not authenticated');
  });

  it('sends authorization header with session token', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'tok_abc123' } },
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    await authFetch('/api/courses/my');

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, init] = fetchSpy.mock.calls[0];
    expect((init?.headers as Record<string, string>)['Authorization']).toBe('Bearer tok_abc123');
  });

  it('throws on non-ok response', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'tok_abc123' } },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not found', { status: 404 })
    );

    await expect(authFetch('/api/missing')).rejects.toThrow('Not found');
  });

  it('returns parsed JSON on success', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'tok_abc123' } },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: [1, 2, 3] }), { status: 200 })
    );

    const result = await authFetch('/api/test');
    expect(result).toEqual({ data: [1, 2, 3] });
  });
});
