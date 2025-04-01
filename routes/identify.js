const express = require('express');
const identify = require('../controllers/identify');
var router = express.Router();
router.post('/', identify.getIdentification);
module.exports = router;