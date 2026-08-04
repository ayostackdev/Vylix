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

export function resolveApiUrl(path: string): string {
	const versionedPath = toVersionedApiPath(path);
	return API_BASE ? `${API_BASE}${versionedPath}` : versionedPath;
}
