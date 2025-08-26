const mongoose = require("mongoose");

const PlantSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User",  required: true },
  areaId:     { type: mongoose.Schema.Types.ObjectId, ref: "Area",  required: true },
  photoId:    { type: mongoose.Schema.Types.ObjectId, ref: "Photo", required: true },

  idx:        { type: Number, required: true },            // 1..N within that photo
  label:      { type: String, required: true },            // "Flower", etc.
  container:  { type: String, default: "unknown" },        // "unknown|Pot|Raised_Bed|ground"
  coordsPx:   { type: [Number], required: true },          // [x1,y1,x2,y2] pixels
  confidence: { type: Number, required: true },            // 0..1
  notes:      { type: String, default: "" },
}, { timestamps: true });

// Guarantees per-photo numbering uniqueness
PlantSchema.index({ photoId: 1, idx: 1 }, { unique: true });
// Fast queries
PlantSchema.index({ areaId: 1 });
PlantSchema.index({ userId: 1 });

module.exports = mongoose.model("Plant", PlantSchema);
