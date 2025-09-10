import { authHeaders } from './http';
const API_BASE = 'http://localhost:12345/api';

// saving a photo of an area
export async function savePhotoFile({ file, areaId, takenAt }) {
  const form = new FormData();
  form.append('photo', file);
  form.append('area_id', areaId);
  if (takenAt) form.append('taken_at', takenAt);

  const resp = await fetch(`${API_BASE}/photos`, {
    method: 'POST',
    headers: authHeaders(), 
    body: form,
  });
  if (!resp.ok) throw new Error(`savePhotoFile failed: ${resp.status}`);
  return resp.json();
}

// getting all of the photos of the area from the server
export async function listAreaPhotos(areaId) {
  const resp = await fetch(`${API_BASE}/areas/${areaId}/photos`, {
    headers: authHeaders(),
  });
  if (!resp.ok) throw new Error(`listAreaPhotos failed: ${resp.status}`);
  return resp.json();
}
