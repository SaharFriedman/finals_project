const express = require('express');
const identify = require('../controllers/identify');
var router = express.Router();
//We are using the identify controller.
//We are using the get method to get the identification.
console.log("hellllllloooo1");
router.get('/', identify.getIdentification);
module.exports = router;