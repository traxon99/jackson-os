export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  if (response.status === 401) {
    window.dispatchEvent(new Event('jos:signed-out'));
  }

  let message = response.statusText;
  try {
    const body = (await response.json()) as {
      error?: string;
      message?: string;
    };
    message = body.error ?? body.message ?? message;
  } catch {
    try {
      message = await response.text();
    } catch {
      // keep statusText
    }
  }

  throw new ApiError(message || 'Request failed', response.status);
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin' });
  return parseResponse<T>(response);
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers:
      body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parseResponse<T>(response);
}

export async function apiPatch(path: string, body: unknown): Promise<void> {
  const response = await fetch(path, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  await parseResponse<void>(response);
}

export async function apiDelete(path: string): Promise<void> {
  const response = await fetch(path, {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  await parseResponse<void>(response);
}
