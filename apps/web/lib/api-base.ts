export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

export function resolveApiUrl(path: string): string {
	if (/^https?:\/\//i.test(path)) {
		return path;
	}

	const versionedPath = path.startsWith('/api/')
		? path.replace('/api/', '/api/v1/')
		: path.startsWith('/api/v1/')
			? path
			: `/api/v1${path.startsWith('/') ? path : `/${path}`}`;

	return API_BASE ? `${API_BASE}${versionedPath}` : versionedPath;
}
