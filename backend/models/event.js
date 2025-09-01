const mongoose = require("mongoose");

const GardenEventSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User",  required: true },
  areaId:   { type: mongoose.Schema.Types.ObjectId, ref: "Area",  required: true },
  plantId:  { type: mongoose.Schema.Types.ObjectId, ref: "Plant", required: false },
  type:     { type: String, enum: ["water","fertilize","prune","harvest","inspect","planting","note"], required: true },
  amount:   { type: Number, default: null }, // liters or grams depending on units
  units:    { type: String, default: "" },   // "L","ml","g","kg"
  moisture: { type: Number, default: null }, // 0-100 percent if provided
  source:   { type: String, default: "" },   // "user","auto","vision"
  photoId:  { type: mongoose.Schema.Types.ObjectId, ref: "Photo", required: false },
  notes:    { type: String, default: "" },
  happenedAt: { type: Date, default: Date.now },
}, { timestamps: true });

GardenEventSchema.index({ userId: 1, areaId: 1, happenedAt: -1 });
GardenEventSchema.index({ plantId: 1, happenedAt: -1 });
GardenEventSchema.index({ userId: 1, type: 1, happenedAt: -1 });

module.exports = mongoose.model("GardenEvent", GardenEventSchema);