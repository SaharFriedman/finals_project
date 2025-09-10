import { authHeaders } from './http';
const API_BASE = 'http://localhost:12345/api';

// posting the plant table
export async function bulkUpsertPlants(rows) {
  const resp = await fetch(`${API_BASE}/plants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(rows),
  });
  if (!resp.ok) throw new Error(`bulkUpsertPlants failed: ${resp.status}`);
  return resp.json();
}

// getting all of the plants by areaID
export async function listAreaPlants(areaId) {
  const resp = await fetch(`${API_BASE}/areas/${areaId}/plants`, {
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error(`listAreaPlants failed: ${resp.status}`);
  return resp.json();
}
// deleting all of the plants
export async function deletePlant(plantId) {
const resp = await fetch(`http://localhost:12345/api/plants/${plantId}`, {
method: 'DELETE',
headers: authHeaders(),
});
if (!resp.ok) throw new Error(`deletePlant failed: ${resp.status}`);
return resp.json();
}
