const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    roundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InterviewRound',
      required: true,
      unique: true,
    },
    supabaseId: { type: String, default: null },
    ratings: { type: mongoose.Schema.Types.Mixed, required: true },
    notes: { type: String, default: '' },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = { Feedback: mongoose.model('Feedback', feedbackSchema) };
