// imports
const mongoose = require("mongoose");
const Plant = require("../models/plant");
const ChatMessage = require("../models/chat");
const TipMessage = require("../models/tip")
const { tools } = require("../services/tools");
const { callLLM, callLLMForChat } = require("../services/llm");

// recieving from frontent the object id as string -> validating and returning mongoDB ID as object
const toOid = (v) => (v && mongoose.Types.ObjectId.isValid(v) ? new mongoose.Types.ObjectId(v) : null);

// this is all of the tools that the helper can help with
const toolDefs = [
  {
    type: "function",
    function: {
      name: "get_plant",
      description: "Fetch a single plant and its full context for grounding: area_id, photo_id, slot, photo url and size, and bbox for the plant on that photo.",
      parameters: {
        type: "object",
        properties: {
          plant_id: { type: "string", description: "The unique plant id" },
          label: { type: "string", description: "Plant name if id not known" }
        },
        required: [],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_plant_note",
      description: "Update or append a note for a plant for your own purposes, or a significant data the user provided about this plant, if there is previous data in it do not override and write the note with that data combined",
      parameters: {
        type: "object",
        properties: {
          plant_id: { type: "string", description: "The plant id to update" },
          note: { type: "string", description: "The note text" },
          mode: { type: "string", enum: ["replace", "append"], description: "Replace or append" }
        },
        required: ["plant_id", "note"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get compact weather summaries for the next 7 days and previous week features",
      parameters: {
        type: "object",
        properties: {
          lat: { type: "number", description: "Latitude in decimal degrees" },
          lon: { type: "number", description: "Longitude in decimal degrees" }
        },
        required: ["lat", "lon"],
        additionalProperties: false
      }
    }
  }
];

// Summarize per-plant last events
async function getContext(userId) {
  const uid = toOid(userId); // make sure it is an ObjectId

  const plants = await Plant.find(
    { userId: uid },
    { label: 1, areaId: 1, lastWateredAt: 1 } // add whatever else you need
  ).lean();

  return plants.map(p => ({
    plant_id: String(p._id),
    area_id: String(p.areaId),
    label: p.label,
    last_water: p.lastWateredAt ? { at: p.lastWateredAt } : null
  }));
}
// GET /api/helper/context
// purpose - retreiving all of the plants data
exports.getContext = async (req, res) => {
  try {
    const userId = toOid(req.userId);
    if (!userId) return res.status(401).json({ error: "unauthorized" });
    const ctx = await getContext(userId);
    res.json({ plants: ctx });
  } catch (e) {
    console.error("helper.getContext error", e);
    res.status(500).json({ error: "internal_error" });
  }
};

// POST /api/helper/chat  { message, area_id? } -> providing full chat prompt context and more to give a personal smart bot
exports.chat = async (req, res) => {
  try {
    const userId = toOid(req.userId);
    if (!userId) return res.status(401).json({ error: "unauthorized" });
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: "message is required" });

    // Retrieve short context
    const ctx = await getContext(userId);

    // Build a constrained prompt with instruction to return optional JSON block
    const sys = `
You are My Helper - a personal garden assistant.

Core rules:
- Write in plain, simple language. Default to 1-3 sentences or 3-5 short bullets.
- Never invent or assume dates, numbers, or plant states.
- Do not repeat the same advice recently given. Keep answers fresh and incremental.
- Stay focused on gardening and the user's garden data only.
- If info is missing, ask a single clear question or use the tools.
- Summarize results from tools; do not dump raw JSON or full records.

Memory rules:
- When you learn a durable fact (watering pattern, pests, soil type, sun exposure, transplant date, etc.), call update_plant_note.
- Notes must be very short (5-15 words) and tagged. Example:
  [watering] Basil droops by noon - morning water better
  [pests] Aphids on roses 2025-09-20
  [sun] West bed gets 5h direct sun
- Use append unless replacing outdated info.

Answer format:
- Prefer bullets for tasks, schedules, amounts.
- Include one actionable next step if possible (e.g., when to water, how much).
- If you need a new photo to proceed, explain why and call request_slot_photo.
`.trim();
    const dev = `
Behavior contract:

Tool usage:
- get_plant: when details about a plant's type or notes are needed.
- get_weather: before giving timing advice that depends on forecasted heat, rain, or wind.
- request_slot_photo: when diagnosis or comparison requires a new picture.
- update_plant_note: after extracting a durable fact, store it in a short tagged line.

Style rules:
- Do not output walls of text or multiple-day weather dumps.
- Always summarize: "Hot and dry this week - water earlier" instead of listing daily highs.
- Numbers should be specific and bounded ("500-700 ml", "every 3-4 days").
- Only ask the user one clear follow-up question if necessary.
`.trim();

    // recent messages with a limit of 8 recent commands
    const recent = await ChatMessage.find({ userId }).sort({ createdAt: -1 }).limit(8).lean();
    // provide role and content
    const history = recent.reverse().map(m => ({ role: m.role, content: m.text }));

    const ctxStr = JSON.stringify(ctx.slice(0, 100)); // keep it bounded
    // messages is the prompt given to the LLM with: 1) system initial prompt 2) user's plants 3) chat history of 8 responses 4) user's message  
    const messages = [
      { role: "system", content: sys },
      { role: "system", content: `USER_PLANTS=${ctxStr}` },
      { role: "system", content: dev }, // optional, but recommended
      ...history,
      { role: "user", content: message }
    ];
    await ChatMessage.create({ userId, role: "user", text: message });
    // LLM response
    let loops = 0;

    while (loops++ < 4) {
      const r = await callLLMForChat({ messages, tools: toolDefs });
      if (r.assistant_message?.tool_calls?.length) {
        // 1) push the assistant message that contains the tool_calls
        messages.push(r.assistant_message);

        // 2) respond to every tool_call in that message
        for (const tc of r.assistant_message.tool_calls) {
          const name = tc.function?.name;
          let args = {};
          try {
            args = JSON.parse(tc.function?.arguments || "{}");
          } catch (_) {
            // keep args as {}
          }

          let result;
          try {
            const fn = tools[name];
            if (!fn) {
              result = { error: `unknown tool: ${name}` };
            } else {
              result = await fn(args, { userId });
            }
          } catch (e) {
            result = { error: "tool exception", details: String(e).slice(0, 500) };
          }

          // 3) push one tool message per tool_call_id
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result) // must be a string
          });
        }

        // 4) go back to the model with both the assistant tool_calls message
        //    and the N tool responses appended
        continue;
      }
      await ChatMessage.create({ userId, role: "assistant", text: r.text });
      return res.json({ reply: r.text });
    }
  }
  catch {
    res.json({ reply: "error" });
  }
}

// POST /api/helper/chat/tip
// this function post the tip to the LLM
exports.tip = async (req, res) => {
  try {
    const userId = toOid(req.userId);
    if (!userId) return res.status(401).json({ error: "unauthorized" });

    // accept exactly these fields from the frontend
    const { system, developer, user } = req.body || {};
    if (!system || !developer || !user) {
      return res.status(400).json({ error: "system, developer, and user are required" });
    }

    // recent messages with a limit of 8 recent commands
    const recent = await TipMessage.find({ userId }).sort({ createdAt: -1 }).limit(8).lean();
    // provide role and content
    const history = recent.reverse().map(m => ({ role: m.role, content: m.text }));
    // small size caps
    const sys = String(system).slice(0, 6000);
    const dev = String(developer).slice(0, 12000);
    const usr = String(user).slice(0, 60000);

    const messages = [
      { role: "system", content: sys },
      { role: "developer", content: dev },
      ...history,
      { role: "user", content: usr }
    ];
    const out = await callLLM(messages);
    const text = out.text;
    const saved = await TipMessage.create({ userId, text });
    return res.json(out);

  } catch (err) {
    return res.status(500).json({ error: "tip failed", details: err.message || String(err) });
  }
};
// GET /api/chat/tip/recent
// this retrieves the last tip - simulating a weekly driven recommendation
exports.loadRecentTip = async (req, res) => {
  try {
    const userId = toOid(req.userId);
    if (!userId) return res.status(401).json({ error: "unauthorized" });
    const doc = await TipMessage
      .findOne({ userId })
      .sort({ _id: -1 })          
      .lean();
    if (!doc) return res.json(null);
    let parsed = null;
    try { parsed = JSON.parse(doc.text); } catch { }
    return res.json({ tip: parsed || doc.text, createdAt: doc.createdAt });
  } catch (e) {
    console.error("loadRecentTip error:", e);
    res.status(500).json({ error: "internal_error" });
  }
};