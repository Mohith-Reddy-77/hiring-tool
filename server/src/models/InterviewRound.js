const mongoose = require('mongoose');

const ROUND_STATUSES = ['PENDING', 'COMPLETED'];

const interviewRoundSchema = new mongoose.Schema(
  {
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
    name: { type: String, required: true, trim: true },
    interviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Template', required: true },
    supabaseId: { type: String, default: null },
    status: { type: String, enum: ROUND_STATUSES, default: 'PENDING' },
    scheduledAt: { type: Date },
  },
  { timestamps: true }
);

interviewRoundSchema.index({ candidateId: 1, interviewerId: 1 });

module.exports = {
  InterviewRound: mongoose.model('InterviewRound', interviewRoundSchema),
  ROUND_STATUSES,
};
