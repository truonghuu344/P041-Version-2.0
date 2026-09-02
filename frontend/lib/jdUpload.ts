const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_BASE_URL || '';

const API_BASE_URL = API_ORIGIN
  ? `${API_ORIGIN}/api/v1`
  : '/api/v1';

/** Transport for JD file ingestion used by Counselor. */
export async function uploadJDForParsing(file: File): Promise<Response> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('access_token') : null;
  const form = new FormData();
  form.append('file', file);

  return fetch(`${API_BASE_URL}/jds/upload`, {
    method: 'POST',
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
  });
}
