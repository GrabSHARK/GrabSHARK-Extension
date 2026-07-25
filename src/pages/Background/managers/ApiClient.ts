export interface BackgroundApiConfig {
    baseUrl: string;
    apiKey: string;
}

export class ApiRequestError extends Error {
    status?: number;

    constructor(message: string, status?: number) {
        super(message);
        this.name = 'ApiRequestError';
        this.status = status;
    }
}

async function parseResponseBody(response: Response) {
    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
        return await response.json();
    }

    return await response.text();
}

function buildHeaders(config: BackgroundApiConfig, initHeaders?: HeadersInit, body?: BodyInit | null) {
    const headers = new Headers(initHeaders ?? {});

    if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${config.apiKey}`);
    }

    if (body && !(body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    return headers;
}

export class ApiClient {
    static async request<T>(config: BackgroundApiConfig, path: string, init: RequestInit = {}): Promise<T> {
        const url = `${config.baseUrl.replace(/\/$/, '')}${path}`;
        const response = await fetch(url, {
            ...init,
            headers: buildHeaders(config, init.headers, init.body),
        });

        const data = await parseResponseBody(response);

        if (!response.ok) {
            const message = typeof data === 'string'
                ? data
                : data?.response || data?.message || `Request failed with status ${response.status}`;
            throw new ApiRequestError(String(message), response.status);
        }

        return data as T;
    }
}
