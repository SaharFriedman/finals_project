const mongoose = require("mongoose");
const PhotoSchema = new mongoose.Schema(
  {
    areaId:   { type: mongoose.Schema.Types.ObjectId, ref: "Area", required: true },
    fileName: { type: String, required: true },   // URL
    width:    { type: Number, required: true },   // original pixel width
    height:   { type: Number, required: true },   // original pixel height
    takenAt:  { type: Date,   required: true },   // when the user took the photo
  },
  { timestamps: true }
);

module.exports = mongoose.model("Photo", PhotoSchema);
