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

// basic fallback in case the LLM fails
function basicFallback(messages) {
  const last = messages.filter(m => m.role === "user").slice(-1)[0]?.content || "";
  return { text: `LLM failed to respond this data: ${last}` };
}
// calling the LLM for the tip message
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

// calling the LLM for chat message
export async function callLLMForChat({ messages, tools }) {
   try {
    const resp = await client.chat.completions.create({
      model: MODEL,
      messages,
      tools,
      tool_choice: "auto" // let the model decide
    });

    const msg = resp.choices?.[0]?.message;
 if (msg?.tool_calls?.length) {
      return { assistant_message: msg };
    }
    // if the model wants to call a tool
    if (msg?.tool_calls?.length) {
      const tc = msg.tool_calls[0]; // handle one at a time
      return {
        tool_call: {
          id: tc.id, // important for Chat API follow-up
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments || "{}")
        }
      };
    }

    // final text
    return { text: msg?.content || "" };
  } catch (err) {
    console.error("OpenAI error", err);
    return { text: "Sorry, something went wrong." };
  }
}