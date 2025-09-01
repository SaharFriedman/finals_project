import OpenAI from "openai";
import { OPENAI_KEY } from "./apitok";

const PROVIDER = "openai";
const MODEL = "gpt-4o-mini";
const client = new OpenAI({ apiKey: OPENAI_KEY });

function toSingleInput(messages) {
  return messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
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
      max_output_tokens: 500,
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
