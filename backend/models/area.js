const mongoose = require("mongoose");

const AreaSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name:       { type: String, required: true },
  orderIndex: { type: Number, default: 1 },             
}, { timestamps: true });

// Unique per user by name
AreaSchema.index({ userId: 1, name: 1 }, { unique: true });

// Helpful for sorting - not unique
AreaSchema.index({ userId: 1, orderIndex: 1 });

module.exports = mongoose.model("Area", AreaSchema);
