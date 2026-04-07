const mongoose = require('mongoose');

const CANDIDATE_STATUSES = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'REJECTED', 'HIRED'];

const candidateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    roleApplied: { type: String, required: true, trim: true },
    resumeUrl: { type: String, default: '' },
    supabaseId: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: CANDIDATE_STATUSES, default: 'APPLIED' },
  },
  { timestamps: true }
);

module.exports = {
  Candidate: mongoose.model('Candidate', candidateSchema),
  CANDIDATE_STATUSES,
};
