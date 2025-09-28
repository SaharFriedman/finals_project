const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/helperController");

// All routes expect req.userId to be set by your auth middleware
router.get("/context", ctrl.getContext);
router.post("/chat", ctrl.chat);
router.post("/chat/tip",ctrl.tip);
router.get("/chat/tip/recent",ctrl.loadRecentTip);
module.exports = router;