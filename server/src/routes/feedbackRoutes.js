const express = require('express');
const feedbackController = require('../controllers/feedbackController');
const { authenticate, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticate, requireRoles('INTERVIEWER'), feedbackController.create);

module.exports = router;
