export async function bulkUpsertPlants(userId, rows, apiBase = "http://localhost:12345/api") {
  const resp = await fetch(`${apiBase}/plants?user_id=${encodeURIComponent(userId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rows),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`bulkUpsertPlants failed: ${resp.status} ${t}`);
  }
  return resp.json();
}
