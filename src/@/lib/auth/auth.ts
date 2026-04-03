export interface DataLogin {
  username: string;
  password: string;
  redirect: boolean;
  csrfToken: string;
  callbackUrl: string;
  json: boolean;
}

export interface DataLogout {
  csrfToken: string;
  callbackUrl: string;
  json: boolean;
}

export interface HttpResult<T> {
  status: number;
  data: T;
}

export class AuthRequestError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AuthRequestError';
    this.status = status;
  }
}

async function readResponseBody<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}

async function postRequest<T>(url: string, init: RequestInit): Promise<HttpResult<T>> {
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
  });

  const data = await readResponseBody<T | { message?: string }>(response);

  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string'
        ? data.message
        : response.status === 401
          ? 'Invalid credentials'
          : `Request failed with status ${response.status}`;

    throw new AuthRequestError(message, response.status);
  }

  return {
    status: response.status,
    data: data as T,
  };
}

export async function getCsrfTokenFetch(url: string): Promise<string> {
  const token = await fetch(`${url}/api/v1/auth/csrf`, { credentials: 'include' });
  const { csrfToken } = await token.json();
  return csrfToken;
}

export async function performLoginOrLogout(
  url: string,
  data: DataLogin | DataLogout
): Promise<HttpResult<unknown>> {
  const formBody = Object.entries(data)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
    .join('&');

  return await postRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody,
  });
}

export async function getSession(
  url: string,
  username: string,
  password: string
): Promise<HttpResult<{ response: { token: string } }>> {
  return await postRequest(`${url}/api/v1/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username,
      password,
      sessionName: 'Browser Extension',
    }),
  });
}

export async function getSessionFetch(url: string) {
  const session = await fetch(`${url}/api/v1/auth/session`, { credentials: 'include' });

  if (!session.ok) {
    throw new AuthRequestError(`Request failed with status ${session.status}`, session.status);
  }

  const sessionJson = await session.json();
  return sessionJson.user;
}
