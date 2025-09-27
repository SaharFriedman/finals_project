const mongoose = require("mongoose");
// this saves all of the plants for each user, monitoring and special care for each plant there is for the best performence and personalize experience
const PlantSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User",  required: true },
  areaId:     { type: mongoose.Schema.Types.ObjectId, ref: "Area",  required: true },
  photoId:    { type: mongoose.Schema.Types.ObjectId, ref: "Photo", required: true },

  idx:        { type: Number, required: true },            
  label:      { type: String, required: true },            
  container:  { type: String, default: "unknown" },        
  coordsPx:   { type: [Number], required: true },          
  confidence: { type: Number, required: true },            
  notes:      { type: String, default: "" },
  lastWateredAt:    { type: Date, default: null },
  lastFertilizedAt: { type: Date, default: null },
  plantedMonth:     { type: Number, min: 1, max: 12, default: null },
  plantedYear:      { type: Number, min: 1900, max: 3000, default: null },
  chatNote: { type: String, default: "", maxlength: 1000 },
}, { timestamps: true });

// Guarantees per-photo numbering uniqueness
PlantSchema.index({ photoId: 1, idx: 1 }, { unique: true });
// Fast queries
PlantSchema.index({ areaId: 1 });
PlantSchema.index({ userId: 1 });

module.exports = mongoose.model("Plant", PlantSchema);
