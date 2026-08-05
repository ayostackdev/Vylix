import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { FormDataApiResponse } from '@/lib/api-request';

const DIRECT = 'https://api.example.com/api/v1/user/avatar';
const PROXY = '/api/v1/user/avatar';
const DIRECT_MATERIALS = 'https://api.example.com/api/v1/materials/upload';
const PROXY_MATERIALS = '/api/v1/materials/upload';

let fetchApi: (path: string, init?: RequestInit & { direct?: boolean }) => Promise<Response>;
let postFormDataApi: (
	path: string,
	formData: FormData,
	options?: { headers?: Record<string, string>; onProgress?: (loaded: number, total: number) => void },
) => Promise<FormDataApiResponse>;

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	});
}

function htmlResponse(status: number): Response {
	return new Response('<html>gateway error</html>', {
		status,
		headers: { 'content-type': 'text/html' },
	});
}

let xhrPlan: Record<string, { status: number; body: string }> = {};

class FakeXHR {
	status = 0;
	responseText = '';
	upload: { onprogress: ((event: unknown) => void) | null } = { onprogress: null };
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	onabort: (() => void) | null = null;
	url = '';

	open(_method: string, url: string): void {
		this.url = url;
	}

	setRequestHeader(_key: string, _value: string): void {}

	send(): void {
		const plan = xhrPlan[this.url];
		if (plan) {
			this.status = plan.status;
			this.responseText = plan.body;
			this.onload?.();
		} else {
			this.onerror?.();
		}
	}
}

beforeAll(async () => {
	vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://api.example.com');
	vi.resetModules();
	const mod = await import('@/lib/api-request');
	fetchApi = mod.fetchApi;
	postFormDataApi = mod.postFormDataApi;
});

describe('fetchApi fallback', () => {
	it('falls back to the proxy when the direct response is a gateway HTML error', async () => {
		const calls: string[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				calls.push(url);
				if (url === DIRECT) return htmlResponse(502);
				return jsonResponse({ ok: true });
			}) as unknown as typeof fetch,
		);

		const res = await fetchApi('/api/user/avatar', { direct: true });
		expect(calls).toEqual([DIRECT, PROXY]);
		expect(res.ok).toBe(true);
	});

	it('returns JSON error responses immediately without falling back', async () => {
		const calls: string[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				calls.push(url);
				if (url === DIRECT) return jsonResponse({ detail: 'No session' }, 401);
				return jsonResponse({ detail: 'should not be called' }, 500);
			}) as unknown as typeof fetch,
		);

		const res = await fetchApi('/api/user/avatar', { direct: true });
		expect(calls).toEqual([DIRECT]);
		expect(res.status).toBe(401);
	});

	it('returns ok responses from the direct URL', async () => {
		const calls: string[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL) => {
				calls.push(String(input));
				return jsonResponse({ avatar_url: 'https://cdn.example/avatar.png' });
			}) as unknown as typeof fetch,
		);

		const res = await fetchApi('/api/user/avatar', { direct: true });
		expect(calls).toEqual([DIRECT]);
		expect(res.ok).toBe(true);
	});

	it('falls back when the direct URL throws a network error', async () => {
		const calls: string[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				calls.push(url);
				if (url === DIRECT) throw new TypeError('Failed to fetch');
				return jsonResponse({ ok: true });
			}) as unknown as typeof fetch,
		);

		const res = await fetchApi('/api/user/avatar', { direct: true });
		expect(calls).toEqual([DIRECT, PROXY]);
		expect(res.ok).toBe(true);
	});
});

describe('postFormDataApi fallback', () => {
	it('falls back to the proxy on non-JSON gateway errors', async () => {
		xhrPlan = {
			[DIRECT_MATERIALS]: { status: 502, body: '<html>Bad Gateway</html>' },
			[PROXY_MATERIALS]: { status: 200, body: '{"ok":true}' },
		};
		vi.stubGlobal('XMLHttpRequest', FakeXHR as unknown as typeof XMLHttpRequest);

		const result = await postFormDataApi('/api/materials/upload', new FormData());
		expect(result.status).toBe(200);
	});

	it('returns JSON error bodies immediately', async () => {
		xhrPlan = {
			[DIRECT_MATERIALS]: { status: 400, body: '{"detail":"No course"}' },
		};
		vi.stubGlobal('XMLHttpRequest', FakeXHR as unknown as typeof XMLHttpRequest);

		const result = await postFormDataApi('/api/materials/upload', new FormData());
		expect(result.status).toBe(400);
		expect(result.body).toContain('No course');
	});
});
