const mongoose = require("mongoose");

const TipMessageSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text:    { type: String, required: true }
}, { timestamps: true });

TipMessageSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("TipMessage", TipMessageSchema);