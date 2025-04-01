const express = require('express');
var router = express.Router();
//We are using the identify controller.
const identify = require('../controllers/identify');
//We are using the get method to get the identification.
router.get('/', identify.getIdentification);
module.exports = router;