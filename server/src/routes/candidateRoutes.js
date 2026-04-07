const express = require('express');
const candidateController = require('../controllers/candidateController');
const roundController = require('../controllers/roundController');
const { authenticate, requireRoles } = require('../middleware/auth');
const { uploadResume } = require('../middleware/multerResume');

const router = express.Router();

router.use(authenticate, requireRoles('RECRUITER'));

router.post('/', uploadResume.single('resume'), candidateController.create);
router.get('/', candidateController.list);
router.get('/:id/rounds', roundController.listForCandidate);
router.get('/:id', candidateController.getById);
router.patch('/:id', uploadResume.single('resume'), candidateController.update);

module.exports = router;
