const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { imageSize } = require("image-size");

const Area = require("../models/area");
const Photo = require("../models/photos");
const Plant = require("../models/plant");

const toOid = (v) =>
  (v && mongoose.Types.ObjectId.isValid(v) ? new mongoose.Types.ObjectId(v) : null);

// ---------- AREAS ----------
/**
 * GET /api/gardenRoutes/areas?user_id=<oid>
 */
exports.listAreas = async (req, res) => {
  try {
    const userId = toOid(req.query.user_id);
    if (!userId) return res.status(400).json({ error: "user_id is invalid" });

    const areas = await Area.find({ userId }).sort({ orderIndex: 1 }).lean();
    res.json(areas.map(a => ({
      area_id: a._id.toString(),
      name: a.name,
      orderIndex: a.orderIndex,
      createdAt: a.createdAt,
    })));
  } catch (e) {
    console.error("listAreas error:", e);
    res.status(500).json({ error: "internal_error" });
  }
};

/**
 * POST /api/gardenRoutes/areas
 * Body: { user_id, name? }  -> auto "Area N" if name missing
 */
exports.createArea = async (req, res) => {
  try {
    const { user_id, name } = req.body;
    const userId = toOid(user_id);
    if (!userId) return res.status(400).json({ error: "user_id is invalid" });

    // find next orderIndex for that user
    const last = await Area.findOne({ userId }).sort({ orderIndex: -1 }).lean();
    const nextIndex = (last?.orderIndex || 0) + 1;
    const finalName = (name && name.trim()) || `Area ${nextIndex}`;

    const area = await Area.create({
      userId,
      name: finalName,
      orderIndex: nextIndex,
    });

    res.json({
      area_id: area._id.toString(),
      name: area.name,
      orderIndex: area.orderIndex,
    });
  } catch (e) {
    if (e && e.code === 11000) {
      return res.status(409).json({ error: "duplicate_area_name" });
    }
    console.error("createArea error:", e);
    res.status(500).json({ error: "internal_error" });
  }
};

/**
 * PATCH /api/gardenRoutes/areas/:id
 * Body: { user_id, name }
 */
exports.renameArea = async (req, res) => {
  try {
    const id = toOid(req.params.id);
    const { user_id, name } = req.body;
    const userId = toOid(user_id);
    if (!id) return res.status(400).json({ error: "area_id is invalid" });
    if (!userId) return res.status(400).json({ error: "user_id is invalid" });
    if (!name || !name.trim()) return res.status(400).json({ error: "name is required" });

    const updated = await Area.findOneAndUpdate(
      { _id: id, userId },
      { $set: { name: name.trim() } },
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "area_not_found_for_user" });

    res.json({
      area_id: updated._id.toString(),
      name: updated.name,
      orderIndex: updated.orderIndex,
    });
  } catch (e) {
    if (e && e.code === 11000) {
      return res.status(409).json({ error: "duplicate_area_name" });
    }
    console.error("renameArea error:", e);
    res.status(500).json({ error: "internal_error" });
  }
};


exports.createPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "photo file is required" });

    const { user_id, area_id, taken_at } = req.body;
    const userId = toOid(user_id);
    const areaId = toOid(area_id);
    if (!userId) return res.status(400).json({ error: "user_id is invalid" });
    if (!areaId) return res.status(400).json({ error: "area_id is invalid" });

    // verify area belongs to user
    const area = await Area.findOne({ _id: areaId, userId }).lean();
    if (!area) return res.status(404).json({ error: "area_not_found_for_user" });

    // compute dimensions
    const absPath = req.file.path;
    const buffer = fs.readFileSync(absPath);
    const { width, height } = imageSize(buffer);
    const takenAt = taken_at ? new Date(taken_at) : new Date();

    // pick first free slot 1..3
    const used = await Photo.find({ areaId }, { slot: 1, _id: 0 }).lean();
    const usedSet = new Set(used.map(u => u.slot));
    const firstFree = [1, 2, 3].find(n => !usedSet.has(n));
    if (!firstFree) return res.status(409).json({ error: "area_photo_limit_reached" });

    // try create (unique index {areaId,slot} guards concurrency)
    let photo;
    try {
      photo = await Photo.create({
        userId, areaId,
        fileName: req.file.filename,
        width, height,
        takenAt,
        slot: firstFree,
      });
    } catch (e) {
      // if slot conflict (rare race), recompute once
      if (e && e.code === 11000) {
        const usedNow = await Photo.find({ areaId }, { slot: 1, _id: 0 }).lean();
        const usedSet2 = new Set(usedNow.map(u => u.slot));
        const free2 = [1, 2, 3].find(n => !usedSet2.has(n));
        if (!free2) return res.status(409).json({ error: "area_photo_limit_reached" });
        photo = await Photo.create({
          userId, areaId,
          fileName: req.file.filename,
          width, height,
          takenAt,
          slot: free2,
        });
      } else {
        throw e;
      }
    }

    res.json({
      photo_id: photo._id.toString(),
      photo_url: `/static/photos/${photo.fileName}`,
      slot: photo.slot,
    });
  } catch (err) {
    console.error("createPhoto error:", err);
    res.status(500).json({ error: "internal_error" });
  }
};

exports.bulkUpsertPlants = async (req, res) => {
  try {
    const userId = toOid(req.query.user_id || (req.body && req.body.user_id));
    if (!userId) return res.status(400).json({ error: "user_id is invalid" });

    const rows = Array.isArray(req.body) ? req.body : [];
    if (!rows.length) return res.json([]);

    // Gather areas/photos referenced in batch
    const areaIds = [...new Set(rows.map(r => r.area_id).filter(Boolean))].map(toOid);
    const photoIds = [...new Set(rows.map(r => r.photo_id).filter(Boolean))].map(toOid);

    // Validate areas belong to user
    const areas = await Area.find({ _id: { $in: areaIds }, userId }).lean();
    const areaSet = new Set(areas.map(a => a._id.toString()));
    if (areaSet.size !== areaIds.length) {
      return res.status(400).json({ error: "one_or_more_areas_not_found_for_user" });
    }

    // Validate photos + get their areaIds
    const photos = await Photo.find({ _id: { $in: photoIds } }, { _id: 1, areaId: 1 }).lean();
    const photoToArea = new Map(photos.map(p => [p._id.toString(), p.areaId.toString()]));

    // Build upsert operations
    const ops = [];
    for (const r of rows) {
      const areaId = toOid(r.area_id);
      const photoId = toOid(r.photo_id);
      const idx = Number.isInteger(r.idx) ? r.idx : null;
      const coords = r.coords_px;

      if (!areaId || !photoId || !idx || !Array.isArray(coords) || coords.length !== 4) continue;
      if (!areaSet.has(areaId.toString())) continue;

      const expectedAreaStr = photoToArea.get(photoId.toString());
      if (!expectedAreaStr || expectedAreaStr !== areaId.toString()) continue;

      ops.push({
        update: {
          $setOnInsert: {
            areaId,            
            photoId,           
            idx,               
            createdAt: new Date(),
          },
          $set: {
            userId,            
            label: r.label || "Plant",
            container: r.container || "unknown",
            coordsPx: coords.map(Number),
            confidence: typeof r.confidence === "number" ? r.confidence : 0,
            notes: r.notes || "",
            updatedAt: new Date(),
          },
        },
      });
    }

    if (ops.length) await Plant.bulkWrite(ops, { ordered: false });

    // Return mapping to confirm what was saved
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
