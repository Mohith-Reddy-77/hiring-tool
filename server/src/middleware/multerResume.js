const multer = require('multer');
const path = require('path');

// allow .txt during development for easier testing; remove in production if undesired
const allowed = new Set(['.pdf', '.doc', '.docx', '.txt']);

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (!allowed.has(ext)) {
    return cb(new Error('Only PDF, Word, or text documents (.pdf, .doc, .docx, .txt) are allowed'));
  }
  cb(null, true);
};

const uploadResume = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
});

module.exports = { uploadResume };
