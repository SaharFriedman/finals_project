const mongoose = require("mongoose");

// monitoring and saving history of chat messages
const ChatMessageSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role:    { type: String, enum: ["user","assistant","system"], required: true },
  text:    { type: String, required: true },
  tokens:  { type: Number, default: 0 },
  refs:    { type: [mongoose.Schema.Types.ObjectId], default: [] },
  meta:    { type: Object, default: {} }, 
}, { timestamps: true });

ChatMessageSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("ChatMessage", ChatMessageSchema);