const express = require('express');
const templateController = require('../controllers/templateController');
const { authenticate, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.post('/', requireRoles('RECRUITER'), templateController.create);
router.get('/', templateController.list);
router.get('/:id', templateController.getById);
router.delete('/:id', requireRoles('RECRUITER'), templateController.delete);

module.exports = router;
