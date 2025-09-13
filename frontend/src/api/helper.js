import { authHeaders } from "./http";
const API_BASE = "http://localhost:12345/api/helper";

// getting all of the context from the DB
export async function getHelperContext() {
  const res = await fetch(`${API_BASE}/context`, { headers: authHeaders() });
  if (!res.ok) throw new Error("helper context failed");
  return res.json();
}

// this method is posting the data to recieve a daily tip from the LLM
export async function postTip({ system, developer, user, area_id }) {
  const res = await fetch(`${API_BASE}/chat/tip`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ system, developer, user, area_id }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`postTip failed: ${res.status} ${txt}`);
  }
  return res.json();
}

export async function postChat(message) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ message}),
  });
  if (!res.ok) throw new Error("helper chat failed");
  return res.json();
}
export async function logEvent(ev) {
  const res = await fetch(`${API_BASE}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(ev),
  });
  if (!res.ok) throw new Error("log event failed");
  return res.json();
}

export async function listEvents(plantId) {
  const url = plantId ? `${API_BASE}/events?plant_id=${plantId}` : `${API_BASE}/events`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error("list events failed");
  return res.json();
}