const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/gardenController");

router.post("/photos", ctrl.createPhoto);
router.post("/plants", ctrl.bulkUpsertPlants); // array in, array out

module.exports = router;
