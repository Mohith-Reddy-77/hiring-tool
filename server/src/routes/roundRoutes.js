const express = require('express');
const roundController = require('../controllers/roundController');
const feedbackController = require('../controllers/feedbackController');
const { authenticate, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.post('/', authenticate, requireRoles('RECRUITER'), roundController.create);
router.get('/my-rounds', authenticate, requireRoles('INTERVIEWER'), roundController.myRounds);
router.get('/:id/feedback', authenticate, feedbackController.getForRound);
router.patch('/:id', authenticate, roundController.update);

module.exports = router;
