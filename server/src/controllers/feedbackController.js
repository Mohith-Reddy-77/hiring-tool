const { Feedback } = require('../models/Feedback');
const { InterviewRound } = require('../models/InterviewRound');
const supa = require('../services/supabase');

async function create(req, res, next) {
  try {
    const { roundId, ratings, notes } = req.body;
    if (!roundId || ratings === undefined) {
      return res.status(400).json({ message: 'roundId and ratings are required' });
    }
    const round = await InterviewRound.findById(roundId);
    if (!round) {
      return res.status(404).json({ message: 'Round not found' });
    }
    if (round.interviewerId.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only the assigned interviewer can submit feedback' });
    }
    const existing = await Feedback.findOne({ roundId });
    if (existing) {
      return res.status(409).json({ message: 'Feedback already submitted for this round' });
    }
    const feedback = await Feedback.create({
      roundId,
      ratings,
      notes: notes || '',
      submittedAt: new Date(),
    });
    round.status = 'COMPLETED';
    await round.save();
    try {
      const data = await supa.insertFeedback(feedback);
      if (data && data.length && data[0].id) {
        feedback.supabaseId = data[0].id;
        await feedback.save();
      }
    } catch (e) {
      console.warn('Supabase sync feedback failed:', e?.message || e);
    }
    res.status(201).json(feedback);
  } catch (e) {
    if (e.code === 11000) {
      return res.status(409).json({ message: 'Feedback already submitted for this round' });
    }
    next(e);
  }
}

async function getForRound(req, res, next) {
  try {
    const round = await InterviewRound.findById(req.params.id);
    if (!round) {
      return res.status(404).json({ message: 'Round not found' });
    }
    const isRecruiter = req.userRole === 'RECRUITER';
    const isAssigned =
      req.userRole === 'INTERVIEWER' && round.interviewerId.toString() === req.userId;
    if (!isRecruiter && !isAssigned) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    const feedback = await Feedback.findOne({ roundId: round._id });
    if (!feedback) {
      return res.status(404).json({ message: 'No feedback yet' });
    }
    res.json(feedback);
  } catch (e) {
    next(e);
  }
}

module.exports = { create, getForRound };
