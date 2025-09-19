import OpenAI from "openai";
import { OPENAI_KEY } from "./apitok";

const PROVIDER = "openai";
const MODEL = "gpt-4o-mini";
const client = new OpenAI({ apiKey: OPENAI_KEY });

function toSingleInput(messages) {
  // Accept either an array of {role, content} or an object {system, developer, user}
  if (!Array.isArray(messages)) {
    const obj = messages || {};
    messages = [
      obj.system && { role: "system", content: obj.system },
      obj.developer && { role: "developer", content: obj.developer },
      obj.user && { role: "user", content: obj.user },
    ].filter(Boolean);
  }

  return messages
    .filter(m => m && typeof m.content === "string" && m.content.trim() !== "")
    .map(m => `${String(m.role || "user").toUpperCase()}: ${m.content}`)
    .join("\n\n");
}


function basicFallback(messages) {
  const last = messages.filter(m => m.role === "user").slice(-1)[0]?.content || "";
  return { text: `Here is a basic answer based on your data: ${last}` };
}

export async function callLLM(messages) {
  if (PROVIDER !== "openai" || !client.apiKey) return basicFallback(messages);

  try {
    const input = toSingleInput(messages);
    const resp = await client.responses.create({
      model: MODEL,
      input,
    });
    const text = resp.output_text || "";
    return { text };
  } catch (err) {
    const status = err?.status || err?.response?.status;
    const body = err?.response?.data || err?.error || err?.message;
    console.error("OpenAI error", status, body);
    return basicFallback(messages);
  }
}
