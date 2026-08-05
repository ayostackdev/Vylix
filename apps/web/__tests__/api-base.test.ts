import { describe, expect, it } from 'vitest';
import { isBrowserReachableApiBase, parseApiError } from '@/lib/api-base';

describe('isBrowserReachableApiBase', () => {
	it('rejects Docker-internal API hostnames', () => {
		expect(isBrowserReachableApiBase('http://api:4000')).toBe(false);
	});

	it('accepts localhost and public URLs', () => {
		expect(isBrowserReachableApiBase('http://localhost:4000')).toBe(true);
		expect(isBrowserReachableApiBase('https://vylix-api.onrender.com')).toBe(true);
	});
});

describe('parseApiError', () => {
	it('extracts string detail', () => {
		expect(parseApiError({ detail: 'Not authenticated' }, 'fallback')).toBe('Not authenticated');
	});

	it('joins FastAPI validation errors', () => {
		expect(
			parseApiError({ detail: [{ msg: 'Field required' }, { msg: 'Invalid type' }] }, 'fallback'),
		).toBe('Field required; Invalid type');
	});
});
