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

router.post("/photos", upload.single("photo"), ctrl.createPhoto);

router.post("/plants", ctrl.bulkUpsertPlants);

// ---- Areas ----
router.get("/areas", ctrl.listAreas);            // ?user_id=<oid>
router.post("/areas", ctrl.createArea);          // { user_id, name? } -> auto "Area N" if no name
router.patch("/areas/:id", ctrl.renameArea);     // { user_id, name }

// ---- Photos ----
router.post("/photos", upload.single("photo"), ctrl.createPhoto); // multipart: photo + user_id + area_id + taken_at?

// ---- Plants ----
router.post("/plants", ctrl.bulkUpsertPlants);   // body: rows[], ?user_id= in query or body.user_id

module.exports = router;
