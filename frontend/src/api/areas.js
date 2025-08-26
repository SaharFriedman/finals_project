// frontend/src/api/areas.js
const API_BASE = "http://localhost:12345/api";

export async function listAreas(userId) {
  const res = await fetch(`${API_BASE}/areas?user_id=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error("listAreas failed");
  return res.json(); // [{ area_id, name, orderIndex, createdAt }]
}

export async function createArea(userId, name) {
  const res = await fetch(`${API_BASE}/areas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, name }),
  });
  if (!res.ok) throw new Error("createArea failed");
  return res.json(); // { area_id, name, orderIndex }
}

export async function renameArea(areaId, userId, name) {
  const res = await fetch(`${API_BASE}/areas/${areaId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, name }),
  });
  if (!res.ok) throw new Error("renameArea failed");
  return res.json(); // { area_id, name, orderIndex }
}
