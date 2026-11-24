export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('apex_token');
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the club API. Leave the server running on port 4000.');
  }

  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && !path.startsWith('/api/auth/login')) {
    localStorage.removeItem('apex_token');
    if (!window.location.pathname.startsWith('/login')) window.location.assign('/login');
  }
  if (!response.ok) throw new Error(data.message || 'Request failed.');
  return data;
}
