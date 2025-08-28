const mongoose = require("mongoose");
const AreaSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name:       { type: String, required: true },       // "Area 1", "Front yard", etc.
  orderIndex: { type: Number, default: 1 },           // 1,2,3... per user (for default naming)
}, { timestamps: true });

// Uniqueness per user
AreaSchema.index({ userId: 1, name: 1 }, { unique: true });
AreaSchema.index({ userId: 1, orderIndex: 1 }, { unique: true });

module.exports = mongoose.model("Area", AreaSchema);
