const express = require('express');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticate, authController.me);

// Google OAuth endpoints (popup flow)
const googleAuth = require('../controllers/googleAuthController');
router.get('/google', googleAuth.start);
router.get('/google/callback', googleAuth.callback);

module.exports = router;
