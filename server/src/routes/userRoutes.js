const express = require('express');
const userController = require('../controllers/userController');
const { authenticate, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/interviewers', authenticate, requireRoles('RECRUITER'), userController.listInterviewers);

module.exports = router;
