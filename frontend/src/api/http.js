// Build Authorization header from localStorage token (or return empty object)
export function authHeaders() {
  const t = localStorage.getItem('token');
  if (t && t !== 'undefined' && t !== 'null') {
    return { Authorization: `Bearer ${t}` };
  }
  return {};
}

// same but allow passing a token explicitly
export function authHeadersWith(token) {
  const t = token ?? localStorage.getItem('token');
  if (t && t !== 'undefined' && t !== 'null') {
    return { Authorization: `Bearer ${t}` };
  }
  return {};
}
