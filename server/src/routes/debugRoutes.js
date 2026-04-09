const express = require('express');
const router = express.Router();
const debugController = require('../controllers/debugController');

router.get('/smtp', debugController.smtpCheck);

module.exports = router;
