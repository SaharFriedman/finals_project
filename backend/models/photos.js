const mongoose = require("mongoose");

const PhotoSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  areaId:   { type: mongoose.Schema.Types.ObjectId, ref: "Area", required: true },

  fileName: { type: String, required: true },  // saved filename on disk
  width:    { type: Number, required: true },
  height:   { type: Number, required: true },
  takenAt:  { type: Date,   required: true },

  slot:     { type: Number, enum: [1,2,3], required: true }, // photo # inside the area
}, { timestamps: true });

// Enforce “up to 3 photos per area” and one photo per slot
PhotoSchema.index({ areaId: 1, slot: 1 }, { unique: true });
PhotoSchema.index({ areaId: 1, takenAt: -1 });
PhotoSchema.index({ userId: 1 });

module.exports = mongoose.model("Photo", PhotoSchema);
