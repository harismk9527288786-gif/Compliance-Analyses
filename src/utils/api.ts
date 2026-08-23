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
