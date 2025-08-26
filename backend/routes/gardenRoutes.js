const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/gardenController");

const multer = require("multer");
const fs = require("fs");
const path = require("path");

const PHOTOS_DIR = path.join(process.cwd(), "uploads/photos");

// ensure folder exists
if (!fs.existsSync(PHOTOS_DIR)) fs.mkdirSync(PHOTOS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PHOTOS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const name = `photo_${Date.now()}${ext}`;
    cb(null, name);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max, adjust if needed
});

// ⬇️ This route now accepts multipart/form-data with a file field named "photo"
router.post("/photos", upload.single("photo"), ctrl.createPhoto);

// unchanged
router.post("/plants", ctrl.bulkUpsertPlants);

module.exports = router;
