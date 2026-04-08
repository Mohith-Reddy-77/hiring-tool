const mongoose = require('mongoose');

const ROLES = ['PENDING', 'ADMIN', 'RECRUITER', 'INTERVIEWER'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ROLES, required: true },
    supabaseId: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = {
  User: mongoose.model('User', userSchema),
  ROLES,
};
