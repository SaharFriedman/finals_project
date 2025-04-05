const express = require('express');
const signup = require('../controllers/signup');
var router = express.Router();
router.post('/', signup.signUp);
module.exports = router;