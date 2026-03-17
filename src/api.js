const BASE = '/api';

export async function fetchApi(endpoint) {
  try {
    const res = await fetch(`${BASE}/${endpoint}`);
    if (!res.ok) {
      let detail = '';
      try { const j = await res.json(); detail = j.error || ''; } catch(e) {}
      throw new Error(`API ${endpoint}: ${res.status}${detail ? ' - ' + detail : ''}`);
    }
    return res.json();
  } catch (err) {
    if (err.message && err.message.startsWith('API ')) throw err;
    throw new Error(`API ${endpoint}: Network error - is the Flask server running on port 8080?`);
  }
}
