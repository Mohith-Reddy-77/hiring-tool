const express = require('express');
const userController = require('../controllers/userController');
const { authenticate, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/interviewers', authenticate, requireRoles('RECRUITER'), userController.listInterviewers);
// Admin-only: list all users
router.get('/', authenticate, requireRoles('ADMIN'), userController.listUsers);
// Admin can assign roles to any user
router.post('/:id/role', authenticate, requireRoles('ADMIN'), userController.assignRole);
// Admin can create an invite for a user (will upsert user record with the given role)
router.post('/invite', authenticate, requireRoles('ADMIN'), userController.invite);
// (route above handles role assignment)

module.exports = router;
