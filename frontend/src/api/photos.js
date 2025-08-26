export async function savePhotoFile({ file, areaId, takenAt, apiBase = "http://localhost:12345/api/gardenRoutes" }) {
  const form = new FormData();
  form.append("photo", file);      // <-- field name MUST be "photo"
  form.append("area_id", areaId);
  if (takenAt) form.append("taken_at", takenAt);

  const resp = await fetch(`${apiBase}/photos`, {
    method: "POST",
    body: form, // browser sets multipart/form-data headers automatically
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Failed to save photo (${resp.status}): ${text}`);
  }
  return resp.json(); // { photo_id, photo_url }
}