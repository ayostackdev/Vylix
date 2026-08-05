export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '').trim().replace(/\/$/, '');

export function toVersionedApiPath(path: string): string {
	if (/^https?:\/\//i.test(path)) {
		return path;
	}

	return path.startsWith('/api/')
		? path.replace('/api/', '/api/v1/')
		: path.startsWith('/api/v1/')
			? path
			: `/api/v1${path.startsWith('/') ? path : `/${path}`}`;
}

/** True when the browser can reach NEXT_PUBLIC_API_BASE_URL (not Docker-internal hostnames). */
export function isBrowserReachableApiBase(base: string = API_BASE): boolean {
	if (!base) return false;
	try {
		const { hostname } = new URL(base);
		if (hostname === 'api' || hostname.endsWith('.internal')) return false;
		return true;
	} catch {
		return false;
	}
}

export function parseApiError(body: unknown, fallback: string): string {
	if (!body || typeof body !== 'object') return fallback;
	const record = body as Record<string, unknown>;
	const detail = record.detail;
	if (typeof detail === 'string') return detail;
	if (Array.isArray(detail)) {
		const messages = detail
			.map((item) => {
				if (item && typeof item === 'object' && 'msg' in item) {
					return String((item as { msg: unknown }).msg);
				}
				return null;
			})
			.filter(Boolean);
		if (messages.length > 0) return messages.join('; ');
	}
	if (detail && typeof detail === 'object' && 'message' in detail) {
		return String((detail as { message: unknown }).message);
	}
	if (typeof record.message === 'string') return record.message;
	if (typeof record.error === 'string') return record.error;
	return fallback;
}

export function resolveApiUrl(path: string, opts?: { direct?: boolean }): string {
	const versionedPath = toVersionedApiPath(path);

	if (typeof window !== 'undefined') {
		// Same-origin proxy works everywhere (local dev, Docker, Vercel).
		// Direct calls bypass Vercel's ~4.5MB body limit but must use a URL the
		// browser can reach — not Docker-internal hostnames like http://api:4000.
		const useDirect = Boolean(opts?.direct && isBrowserReachableApiBase());
		if (!useDirect) {
			return versionedPath;
		}
		return `${API_BASE}${versionedPath}`;
	}

	return API_BASE ? `${API_BASE}${versionedPath}` : versionedPath;
}
