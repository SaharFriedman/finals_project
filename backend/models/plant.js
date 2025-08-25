const mongoose = require("mongoose");

const PlantSchema = new mongoose.Schema(
  {
    areaId:     { type: mongoose.Schema.Types.ObjectId, ref: "Area",  required: true },
    photoId:    { type: mongoose.Schema.Types.ObjectId, ref: "Photo", required: true },
    idx:        { type: Number, required: true }, // 1,2,3… as shown on the picture
    label:      { type: String, required: true }, // e.g., "Flower"
    container:  { type: String, default: "unknown" }, // "unknown|pot|raised_bed|ground"
    coordsPx:   { type: [Number], required: true },    // [x1,y1,x2,y2] in pixels
    confidence: { type: Number, required: true },      // 0..1
    notes:      { type: String, default: "" },
  },
  { timestamps: true }
);

// Keep each number unique within a photo and allow fast area queries
PlantSchema.index({ photoId: 1, idx: 1 }, { unique: true });
PlantSchema.index({ areaId: 1 });

module.exports = mongoose.model("Plant", PlantSchema);
