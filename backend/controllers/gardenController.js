const mongoose = require("mongoose");
const Photo = require("../models/photos");
const Plant = require("../models/plant");
const fs = require("fs");
const { imageSize } = require("image-size");
const path = require("path");

const toOid = (v) =>
  (v && mongoose.Types.ObjectId.isValid(v) ? new mongoose.Types.ObjectId(v) : null);

/**
 * POST /api/photos
 * Multipart (preferred):
 *   form-data:
 *     - photo: (file)
 *     - area_id: <ObjectId string>
 *     - taken_at?: ISO string
 *
 * Fallback (old JSON body still supported):
 *   { area_id, file_name, width, height, taken_at }
 *
 * -> { photo_id, photo_url }
 */
exports.createPhoto = async (req, res) => {
  try {
    // If multipart was used, you'll have req.file
    if (req.file) {
      const { area_id, taken_at } = req.body;
      const areaId = toOid(area_id);
      if (!areaId) return res.status(400).json({ error: "area_id is invalid" });

      // read size from the saved image
      const absPath = req.file.path;
      const buffer = fs.readFileSync(absPath);
      const { width, height } = imageSize(buffer);

      const photo = await Photo.create({
        areaId,
        fileName: req.file.filename,     // just the filename we saved
        width,
        height,
        takenAt: taken_at ? new Date(taken_at) : new Date(),
      });

      return res.json({
        photo_id: photo._id.toString(),
        photo_url: `/static/photos/${photo.fileName}` // usable in <img src="">
      });
    }

    // ---- fallback: keep your previous JSON contract working if no file uploaded ----
    const { area_id, file_name, width, height, taken_at } = req.body;

    const areaId = toOid(area_id);
    if (!areaId) return res.status(400).json({ error: "area_id is invalid" });
    if (!file_name || !width || !height) {
      return res.status(400).json({ error: "file_name, width, height are required" });
    }

    const photo = await Photo.create({
      areaId,
      fileName: file_name,
      width,
      height,
      takenAt: taken_at ? new Date(taken_at) : new Date(),
    });

    return res.json({
      photo_id: photo._id.toString(),
      photo_url: `/static/photos/${photo.fileName}` // if you later move file into photos dir
    });
  } catch (err) {
    console.error("createPhoto error:", err);
    res.status(500).json({ error: "internal_error" });
  }
};

exports.bulkUpsertPlants = async (req, res) => {
  try {
    const rows = Array.isArray(req.body) ? req.body : [];
    if (!rows.length) return res.json([]);

    // Build bulk upserts
    const ops = [];
    for (const r of rows) {
      const areaId = toOid(r.area_id);
      const photoId = toOid(r.photo_id);
      const idx = Number.isInteger(r.idx) ? r.idx : null;
      const coords = r.coords_px;

      if (!areaId || !photoId || !idx || !Array.isArray(coords) || coords.length !== 4) continue;

      ops.push({
        updateOne: {
          filter: { photoId, idx },
          update: {
            $setOnInsert: { areaId, photoId, idx, createdAt: new Date() },
            $set: {
              label: r.label || "Plant",
              container: r.container || "unknown",
              coordsPx: coords.map(Number),
              confidence: typeof r.confidence === "number" ? r.confidence : 0,
              notes: r.notes || "",
              updatedAt: new Date(),
            },
          },
          upsert: true,
        },
      });
    }

    if (ops.length) await Plant.bulkWrite(ops, { ordered: false });

    // Return mapping so the client knows the saved IDs
    const photoIds = [...new Set(rows.map(r => r.photo_id).filter(Boolean))].map(toOid);
    const idxs = [...new Set(rows.map(r => r.idx).filter(Number.isInteger))];

    const plants = await Plant.find(
      { photoId: { $in: photoIds }, idx: { $in: idxs } },
      { _id: 1, photoId: 1, idx: 1 }
    ).lean();

    res.json(plants.map(p => ({
      photo_id: p.photoId.toString(),
      idx: p.idx,
      plant_id: p._id.toString(),
    })));
  } catch (err) {
    console.error("bulkUpsertPlants error:", err);
    res.status(500).json({ error: "internal_error" });
  }
};
