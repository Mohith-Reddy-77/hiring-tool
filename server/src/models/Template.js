const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    structure: { type: mongoose.Schema.Types.Mixed, required: true },
    supabaseId: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdBySupabaseId: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = { Template: mongoose.model('Template', templateSchema) };
