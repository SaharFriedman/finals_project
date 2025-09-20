const mongoose = require("mongoose");
const Area = require("../models/area");
const Plant = require("../models/plant");
const Photo = require("../models/photos");
const ChatMessage = require("../models/chat");
const TipMessage = require("../models/tip")
const { callLLM } = require("../services/llm");

const toOid = (v) => (v && mongoose.Types.ObjectId.isValid(v) ? new mongoose.Types.ObjectId(v) : null);

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
    const { message, area_id } = req.body || {};
    if (!message) return res.status(400).json({ error: "message is required" });

    // Store user turn
    const urec = await ChatMessage.create({ userId, role: "user", text: message });

    // Retrieve short context
    const ctx = await getContext(userId);

    // Build a constrained prompt with instruction to return optional JSON block
    const sys = `You are My Helper - a personal garden assistant. 
You answer using the user's private garden data. Never invent dates. 
Avoid repeating the same advice within recent history if already given. only answer relevant questions about gardening and garden data. if you need any more context use the tools provided.
`;

    // recent messages with a limit of 8 recent commands
    const recent = await ChatMessage.find({ userId }).sort({ createdAt: -1 }).limit(8).lean();
    // provide role and content
    const history = recent.reverse().map(m => ({ role: m.role, content: m.text }));

    const ctxStr = JSON.stringify(ctx.slice(0, 100)); // keep it bounded
    // messages is the prompt given to the LLM with: 1) system initial prompt 2) user's plants 3) chat history of 8 responses 4) user's message  
    const messages = [
      { role: "system", content: sys },
      { role: "system", content: `USER_PLANTS=${ctxStr}` },
      ...history
    ];
  // LLM response
    const out = await callLLM(messages);
    const text = out.text || "Sorry - no response";
    // Store assistant turn
    await ChatMessage.create({ userId, role: "assistant", text });

    res.json({ reply: text});
  } catch (e) {
    console.error("helper.chat error", e);
    res.status(500).json({ error: "internal_error" });
  }
};

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
      { role: "system",    content: sys },
      { role: "developer", content: dev },
      ...history,
      { role: "user",      content: usr }
    ];
    const out = await callLLM(messages); 
    const text = out.text;
    await TipMessage.create({ userId, text });
    return res.json(out); 
  } catch (err) {
    return res.status(500).json({ error: "tip failed", details: err.message || String(err) });
  }
};


// POST /api/helper/events - simple logger
exports.createEvent = async (req, res) => {
  try {
    const userId = toOid(req.userId);
    if (!userId) return res.status(401).json({ error: "unauthorized" });

    const { area_id, plant_id, type, amount, units, notes, happened_at } = req.body || {};
    const rec = await Event.create({
      userId,
      areaId: toOid(area_id),
      plantId: toOid(plant_id),
      type,
      amount,
      units,
      notes,
      happenedAt: happened_at ? new Date(happened_at) : new Date(),
      source: "user"
    });
    res.json({ id: String(rec._id) });
  } catch (e) {
    console.error("helper.createEvent error", e);
    res.status(500).json({ error: "internal_error" });
  }
};

// GET /api/helper/events?plant_id=
exports.listEvents = async (req, res) => {
  try {
    const userId = toOid(req.userId);
    if (!userId) return res.status(401).json({ error: "unauthorized" });
    const plantId = toOid(req.query.plant_id);
    const q = { userId };
    if (plantId) q.plantId = plantId;
    const rows = await Event.find(q).sort({ happenedAt: -1 }).limit(200).lean();
    res.json(rows.map(r => ({
      id: String(r._id),
      type: r.type,
      plantId: r.plantId ? String(r.plantId) : null,
      amount: r.amount,
      units: r.units,
      happenedAt: r.happenedAt,
      notes: r.notes
    })));
  } catch (e) {
    console.error("helper.listEvents error", e);
    res.status(500).json({ error: "internal_error" });
  }
};