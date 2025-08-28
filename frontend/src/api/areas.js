import { authHeaders } from './http';
const API_BASE = 'http://localhost:12345/api';

export async function listAreas() {
  const res = await fetch(`${API_BASE}/areas`, { headers: authHeaders() });
  if (!res.ok) throw new Error('listAreas failed');
  return res.json();
}
export async function createArea(name) {
  const res = await fetch(`${API_BASE}/areas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('createArea failed');
  return res.json();
}
export async function renameArea(areaId, name) {
  const res = await fetch(`${API_BASE}/areas/${areaId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error('renameArea failed');
  return res.json();
}
