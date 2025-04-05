const express = require('express');
const token = require('../controllers/token');
var router = express.Router();
router.post('/', token.createToken);
module.exports = router;