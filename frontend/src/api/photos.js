// frontend/src/api/photos.js
export async function savePhotoFile({ file, userId, areaId, takenAt, apiBase = "http://localhost:12345/api" }) {
  const form = new FormData();
  form.append("photo", file);     // field name MUST be "photo"
  form.append("user_id", userId);
  form.append("area_id", areaId);
  if (takenAt) form.append("taken_at", takenAt);

  const resp = await fetch(`${apiBase}/photos`, { method: "POST", body: form });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`savePhotoFile failed: ${resp.status} ${t}`);
  }
  return resp.json(); // { photo_id, photo_url, slot }
}
