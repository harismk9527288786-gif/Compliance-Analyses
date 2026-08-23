/**
 * Persistent Client Session & IP-scoped API Fetch Helper
 *
 * Ensures each device / IP maintains its own isolated analysis history,
 * while new devices start completely clean without preloaded defaults.
 */

export function getClientSessionId(): string {
  let sessionId = localStorage.getItem('mtc_client_session_id');
  if (!sessionId) {
    sessionId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('mtc_client_session_id', sessionId);
  }
  return sessionId;
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const sessionId = getClientSessionId();
  const headers = new Headers(init.headers || {});
  if (!headers.has('x-client-session')) {
    headers.set('x-client-session', sessionId);
  }
  return fetch(input, {
    ...init,
    headers,
  });
}
