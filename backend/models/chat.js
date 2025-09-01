const mongoose = require("mongoose");

const ChatMessageSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role:    { type: String, enum: ["user","assistant","system"], required: true },
  text:    { type: String, required: true },
  tokens:  { type: Number, default: 0 },
  refs:    { type: [mongoose.Schema.Types.ObjectId], default: [] }, // plants or events referenced
  meta:    { type: Object, default: {} }, // arbitrary - can store suggested_tips etc
}, { timestamps: true });

ChatMessageSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("ChatMessage", ChatMessageSchema);