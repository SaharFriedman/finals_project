const mongoose = require("mongoose");
const Area = require("../models/area");
const Plant = require("../models/plant");
const Photo = require("../models/photos");
const Event = require("../models/event");
const ChatMessage = require("../models/chat");
const { callLLM } = require("../services/llm");

const toOid = (v) => (v && mongoose.Types.ObjectId.isValid(v) ? new mongoose.Types.ObjectId(v) : null);

// Summarize per-plant last events
async function getContext(userId) {
  const plants = await Plant.find({ userId }, { label: 1, areaId: 1 }).lean();
  const events = await Event.aggregate([
    { $match: { userId } },
    { $sort: { happenedAt: -1 } },
    { $group: { _id: "$plantId", lastWater: { $first: { amount: "$amount", units: "$units", at: "$happenedAt" } } } }
  ]);

  const map = new Map(events.map(e => [String(e._id), e.lastWater]));
  const ctx = plants.map(p => ({
    plant_id: String(p._id),
    area_id: String(p.areaId),
    label: p.label,
    last_water: map.get(String(p._id)) || null
  }));

  return ctx;
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
Avoid repeating the same advice within recent history if already given.`;

    // recent messages with a limit of 8 recent commands
    const recent = await ChatMessage.find({ userId }).sort({ createdAt: -1 }).limit(8).lean();
    // provide role and content
    const history = recent.reverse().map(m => ({ role: m.role, content: m.text }));

    const ctxStr = JSON.stringify(ctx.slice(0, 100)); // keep it bounded
    // messages is the prompt given to the LLM with: 1) system initial prompt 2) user's plants 3) chat history of 8 responses 4) user's message  
    const messages = [
      { role: "system", content: sys },
      { role: "system", content: `USER_PLANTS=${ctxStr}` },
      ...history,
      { role: "user", content: message }
    ];
  // LLM response
    const out = await callLLM(messages);
    const text = out.text || "Sorry - no response";

    // Store assistant turn
    await ChatMessage.create({ userId, role: "assistant", text });

    res.json({ reply: text, savedEvents: saved });
  } catch (e) {
    console.error("helper.chat error", e);
    res.status(500).json({ error: "internal_error" });
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