const { Feedback } = require('../models/Feedback');
const { InterviewRound } = require('../models/InterviewRound');
const supa = require('../services/supabase');

function normalizeFeedbackRow(row) {
  if (!row) return null;
  return {
    _id: row.id || row.supabaseId || null,
    ratings: row.ratings || null,
    notes: row.notes || row.note || null,
    submittedAt: row.submitted_at || row.submittedAt || row.created_at || null,
    createdAt: row.created_at || row.createdAt || null,
  };
}

async function create(req, res, next) {
  try {
    const { roundId, ratings, notes } = req.body;
    if (!roundId || ratings === undefined) {
      return res.status(400).json({ message: 'roundId and ratings are required' });
    }
    const client = supa.getClient && supa.getClient();
    const isUUID = (v) => typeof v === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);
    if (client && isUUID(roundId)) {
      const roundRow = await supa.getRoundById(roundId);
      if (!roundRow) return res.status(404).json({ message: 'Round not found' });
      if (roundRow.interviewer_id !== req.userId) return res.status(403).json({ message: 'Only the assigned interviewer can submit feedback' });
      const existingFb = await client.from('feedback').select('*').eq('round_id', roundId).maybeSingle();
      if (existingFb && existingFb.data) return res.status(409).json({ message: 'Feedback already submitted for this round' });
      // insert into Supabase
      const payload = { roundId, ratings, notes: notes || '', submittedAt: new Date() };
      const inserted = await supa.insertFeedback({ roundId, ratings, notes: notes || '', submittedAt: new Date() });
      if (!inserted || !inserted.length) return res.status(500).json({ message: 'Feedback insert failed' });
      // mark round completed
      try {
        await supa.updateRoundById(roundId, { status: 'COMPLETED' });
      } catch (e) {
        console.warn('Supabase update round status failed:', e?.message || e);
      }
      return res.status(201).json(normalizeFeedbackRow(inserted[0]));
    }

    // fallback to Mongo flow
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
    const client = supa.getClient && supa.getClient();
    const id = req.params.id;
    const isUUID = (v) => typeof v === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);
    if (client && isUUID(id)) {
      const roundRow = await supa.getRoundById(id);
      if (!roundRow) return res.status(404).json({ message: 'Round not found' });
      const isRecruiter = req.userRole === 'RECRUITER';
      const isAssigned = req.userRole === 'INTERVIEWER' && roundRow.interviewer_id === req.userId;
      if (!isRecruiter && !isAssigned) return res.status(403).json({ message: 'Forbidden' });
      const fb = await client.from('feedback').select('*').eq('round_id', id).maybeSingle();
      if (!fb || !fb.data) return res.status(404).json({ message: 'No feedback yet' });
      return res.json(normalizeFeedbackRow(fb.data));
    }

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
