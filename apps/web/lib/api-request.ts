import { isBrowserReachableApiBase, parseApiError, resolveApiUrl, toVersionedApiPath } from '@/lib/api-base';

export { parseApiError };

export interface FormDataApiResponse {
	status: number;
	body: string;
}

export interface ApiRequestInit extends RequestInit {
	direct?: boolean;
}

function isJsonResponse(response: Response): boolean {
	const contentType = response.headers.get('content-type') || '';
	return contentType.includes('application/json') || contentType.includes('application/problem+json');
}

export async function fetchApi(path: string, init: ApiRequestInit = {}): Promise<Response> {
	const urls = API_BASE_FALLBACKS(path, init.direct);
	let lastError: unknown = null;

	for (let i = 0; i < urls.length; i++) {
		const url = urls[i];
		try {
			const response = await fetch(url, init);
			if (response.ok) return response;

			// 404 and JSON error bodies come from the API itself; return them so the
			// caller can surface the real detail. HTML/plain error bodies are gateway
			// pages (proxy timeout, Render cold boot, Cloudflare) — try the next URL.
			if (response.status === 404) {
				if (i < urls.length - 1) continue;
				return response;
			}
			if (isJsonResponse(response) || i === urls.length - 1) {
				return response;
			}
			lastError = new Error(`Request failed with HTTP ${response.status}`);
		} catch (error) {
			lastError = error;
			if (i < urls.length - 1) {
				continue;
			}
			throw error;
		}
	}

	throw lastError instanceof Error ? lastError : new Error('Request failed');
}

function API_BASE_FALLBACKS(path: string, direct = false): string[] {
	const versionedPath = toVersionedApiPath(path);
	const primary = resolveApiUrl(path, { direct });
	return primary === versionedPath ? [primary] : Array.from(new Set([primary, versionedPath]));
}

export function postFormDataApi(
	path: string,
	formData: FormData,
	options?: {
		headers?: Record<string, string>;
		onProgress?: (loaded: number, total: number) => void;
	},
): Promise<FormDataApiResponse> {
	const urls = API_BASE_FALLBACKS(path, true);

	return attempt(0);

	function attempt(index: number): Promise<FormDataApiResponse> {
		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();

			xhr.upload.onprogress = (event) => {
				if (event.lengthComputable && options?.onProgress) {
					options.onProgress(event.loaded, event.total);
				}
			};

			xhr.onload = () => {
				if (xhr.status >= 200 && xhr.status < 300) {
					resolve({ status: xhr.status, body: xhr.responseText });
					return;
				}

				const looksLikeJson = /^\s*[\[{]/.test(xhr.responseText);
				if (index < urls.length - 1 && (xhr.status === 404 || !looksLikeJson)) {
					attempt(index + 1).then(resolve, reject);
					return;
				}

				resolve({ status: xhr.status, body: xhr.responseText });
			};

			xhr.onerror = () => {
				if (index < urls.length - 1) {
					attempt(index + 1).then(resolve, reject);
					return;
				}
				reject(new Error('Network error'));
			};

			xhr.onabort = () => reject(new Error('Upload cancelled'));

			xhr.open('POST', urls[index]);
			if (options?.headers) {
				for (const [key, value] of Object.entries(options.headers)) {
					xhr.setRequestHeader(key, value);
				}
			}
			xhr.send(formData);
		});
	}
}