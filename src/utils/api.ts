/**
 * Authenticated API Fetch Helper
 *
 * Ensures all requests send HttpOnly session cookies (credentials: 'include')
 * and includes proper headers for API interactions.
 */

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  return fetch(input, {
    ...init,
    credentials: 'include', // Crucial for HttpOnly session cookie transmission
    headers,
  });
}

/**
 * Safely converts any error (string, Error instance, object with {code, message}, etc.)
 * into a render-safe string to prevent React Error #31 (Objects are not valid as a React child).
 */
export function formatErrorMessage(err: any, fallback = 'An unexpected error occurred.'): string {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (typeof err.message === 'string') return err.message;
  if (typeof err.error === 'string') return err.error;
  if (err.error && typeof err.error === 'object') {
    if (typeof err.error.message === 'string') return err.error.message;
    if (typeof err.error.error === 'string') return err.error.error;
  }
  if (err.message && typeof err.message === 'object') {
    if (typeof err.message.message === 'string') return err.message.message;
  }
  if (typeof err.code === 'string' && typeof err.message === 'string') {
    return `[${err.code}] ${err.message}`;
  }
  if (typeof err.code === 'number' && typeof err.message === 'string') {
    return err.message;
  }
  try {
    const str = JSON.stringify(err);
    if (str && str !== '{}') return str;
  } catch {
    // ignore
  }
  // String(someObject) is "[object Object]" — truthy, so it would win over the
  // fallback and put that literal text in front of a user. Prefer the caller's
  // message in that case.
  const asString = String(err);
  return !asString || asString === '[object Object]' ? fallback : asString;
}

