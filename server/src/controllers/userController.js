const { User } = require('../models/User');

async function listInterviewers(req, res, next) {
  try {
    const users = await User.find({ role: 'INTERVIEWER' })
      .select('name email role')
      .sort({ name: 1 });
    res.json(users);
  } catch (e) {
    next(e);
  }
}

module.exports = { listInterviewers };
