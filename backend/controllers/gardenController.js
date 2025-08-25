const mongoose = require("mongoose");
const Photo = require("../models/photos");
const Plant = require("../models/plant");

const toOid = (v) => (v && mongoose.Types.ObjectId.isValid(v) ? new mongoose.Types.ObjectId(v) : null);

/**
 * POST /api/photos
 * Body: { area_id, file_name, width, height, taken_at }
 * -> { photo_id }
 */
exports.createPhoto = async (req, res) => {
  try {
    const { area_id, file_name, width, height, taken_at } = req.body;

    const areaId = toOid(area_id);
    if (!areaId) return res.status(400).json({ error: "area_id is invalid" });
    if (!file_name || !width || !height) {
      return res.status(400).json({ error: "file_name, width, height are required" });
    }

    const takenAt = taken_at ? new Date(taken_at) : new Date();

    const photo = await Photo.create({
      areaId, fileName: file_name, width, height, takenAt,
    });

    res.json({ photo_id: photo._id.toString() });
  } catch (err) {
    console.error("createPhoto error:", err);
    res.status(500).json({ error: "internal_error" });
  }
};

/**
 * POST /api/plants   (bulk upsert)
 * Body: [
 *   { area_id, photo_id, idx, label, container, coords_px:[x1,y1,x2,y2], confidence, notes? }
 * ]
 * -> [
 *   { photo_id, idx, plant_id }
 * ]
 *
 * Upserts by (photoId, idx) so saving the same picture again is idempotent.
 */
exports.bulkUpsertPlants = async (req, res) => {
  try {
    const rows = Array.isArray(req.body) ? req.body : [];
    if (!rows.length) return res.json([]);

    // Build bulk upserts
    const ops = [];
    for (const r of rows) {
      const areaId  = toOid(r.area_id);
      const photoId = toOid(r.photo_id);
      const idx     = Number.isInteger(r.idx) ? r.idx : null;
      const coords  = r.coords_px;

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
