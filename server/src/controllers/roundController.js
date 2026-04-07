const mongoose = require('mongoose');
const { InterviewRound } = require('../models/InterviewRound');
const { Candidate } = require('../models/Candidate');
const { User } = require('../models/User');
const { Template } = require('../models/Template');
const { Feedback } = require('../models/Feedback');
const supa = require('../services/supabase');

async function create(req, res, next) {
  try {
    const { candidateId, interviewerId, templateId, name, status, scheduledAt } = req.body;
    if (!candidateId || !interviewerId || !templateId || !name) {
      return res
        .status(400)
        .json({ message: 'candidateId, interviewerId, templateId, and name are required' });
    }
    // Map provided Mongo IDs to Supabase IDs
    const [candidate, interviewer, template] = await Promise.all([
      Candidate.findById(candidateId),
      User.findById(interviewerId),
      Template.findById(templateId),
    ]);
    if (!candidate) return res.status(404).json({ message: 'Candidate not found' });
    if (!interviewer || interviewer.role !== 'INTERVIEWER') {
      return res.status(400).json({ message: 'interviewerId must be an INTERVIEWER user' });
    }
    if (!template) return res.status(404).json({ message: 'Template not found' });

    const client = supa.getClient && supa.getClient();
    if (client) {
      const payload = {
        candidate_id: candidate.supabaseId || null,
        interviewer_id: interviewer.supabaseId || null,
        template_id: template.supabaseId || null,
        name,
        status: status || 'PENDING',
        scheduled_at: scheduledAt ? new Date(scheduledAt) : null,
        created_at: new Date(),
      };
      if (!payload.candidate_id) return res.status(400).json({ message: 'Candidate not synced to Supabase yet' });
      if (!payload.interviewer_id) return res.status(400).json({ message: 'Interviewer not synced to Supabase yet' });
      if (!payload.template_id) return res.status(400).json({ message: 'Template not synced to Supabase yet' });
      try {
        const data = await supa.insertRound(payload);
        if (!data || !data.length) return res.status(500).json({ message: 'Supabase insert failed' });
        const row = data[0];
        // create local Mongo mapping referencing original Mongo ids
        let mongo = await InterviewRound.findOne({ supabaseId: row.id });
        if (!mongo) {
          mongo = await InterviewRound.create({
            candidateId,
            interviewerId,
            templateId,
            name: row.name,
            status: row.status,
            scheduledAt: row.scheduled_at,
            supabaseId: row.id,
            createdAt: row.created_at,
          });
        } else {
          mongo.name = row.name;
          mongo.status = row.status;
          mongo.scheduledAt = row.scheduled_at;
          await mongo.save();
        }
        const populated = await InterviewRound.findById(mongo._id)
          .populate('candidateId', 'name email roleApplied status resumeUrl')
          .populate('interviewerId', 'name email role')
          .populate('templateId');
        return res.status(201).json(populated);
      } catch (e) {
        console.warn('Supabase insertRound failed:', e?.message || e);
        return res.status(500).json({ message: 'Round create failed' });
      }
    }

    // Fallback to Mongo-only flow
    const round = await InterviewRound.create({
      candidateId,
      interviewerId,
      templateId,
      name,
      ...(status && { status }),
      ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
    });
    const populated = await InterviewRound.findById(round._id)
      .populate('candidateId', 'name email roleApplied status resumeUrl')
      .populate('interviewerId', 'name email role')
      .populate('templateId');
    try {
      const data = await supa.insertRound(populated);
      if (data && data.length && data[0].id) {
        const rr = await InterviewRound.findById(round._id);
        rr.supabaseId = data[0].id;
        await rr.save();
      }
    } catch (e) {
      console.warn('Supabase sync round failed:', e?.message || e);
    }
    res.status(201).json(populated);
  } catch (e) {
    next(e);
  }
}

async function listForCandidate(req, res, next) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid candidate id' });
    }
    const client = supa.getClient && supa.getClient();
    const candidate = await Candidate.findById(id).lean();
    if (!candidate) return res.status(404).json({ message: 'Candidate not found' });
    if (client && candidate.supabaseId) {
      // fetch rounds from Supabase
      const rows = await supa.listRoundsForCandidate(candidate.supabaseId, 200);
      const mappedRounds = await Promise.all(
        (rows || []).map(async (r) => {
          // find or create local mapping
          let mongoDoc = await InterviewRound.findOne({ supabaseId: r.id });
          if (!mongoDoc) {
            // resolve interviewer and template Mongo ids via supabaseId mapping
            const interviewer = await User.findOne({ supabaseId: r.interviewer_id });
            const template = await Template.findOne({ supabaseId: r.template_id });
            mongoDoc = await InterviewRound.create({
              candidateId: id,
              interviewerId: interviewer ? interviewer._id : null,
              templateId: template ? template._id : null,
              name: r.name,
              status: r.status,
              scheduledAt: r.scheduled_at,
              supabaseId: r.id,
              createdAt: r.created_at,
            });
          }
          // return populated round so client has interviewer/template objects
          const populated = await InterviewRound.findById(mongoDoc._id)
            .populate('interviewerId', 'name email role')
            .populate('templateId')
            .lean();
          return populated;
        })
      );

      const roundIds = mappedRounds.map((r) => r._id);
      const feedbackDocs =
        roundIds.length > 0
          ? await Feedback.find({ roundId: { $in: roundIds } })
              .select('roundId ratings notes submittedAt createdAt')
              .lean()
          : [];
      const feedbackByRound = new Map(feedbackDocs.map((f) => [f.roundId.toString(), f]));
      const roundsWithFeedback = mappedRounds.map((r) => ({ ...r, feedback: feedbackByRound.get(r._id.toString()) || null }));
      return res.json(roundsWithFeedback);
    }

    const rounds = await InterviewRound.find({ candidateId: id })
      .populate('interviewerId', 'name email role')
      .populate('templateId')
      .sort({ scheduledAt: 1, createdAt: 1 })
      .lean();

    const roundIds = rounds.map((r) => r._id);
    const feedbackDocs =
      roundIds.length > 0
        ? await Feedback.find({ roundId: { $in: roundIds } })
            .select('roundId ratings notes submittedAt createdAt')
            .lean()
        : [];
    const feedbackByRound = new Map(feedbackDocs.map((f) => [f.roundId.toString(), f]));

    const roundsWithFeedback = rounds.map((r) => ({
      ...r,
      feedback: feedbackByRound.get(r._id.toString()) || null,
    }));

    res.json(roundsWithFeedback);
  } catch (e) {
    next(e);
  }
}

async function myRounds(req, res, next) {
  try {
    // Use local mappings for now (they are created when rounds are inserted into Supabase)
    const rounds = await InterviewRound.find({ interviewerId: req.userId })
      .populate('candidateId', 'name email roleApplied status resumeUrl')
      .populate('templateId')
      .sort({ scheduledAt: 1, createdAt: 1 });
    res.json(rounds);
  } catch (e) {
    next(e);
  }
}

async function update(req, res, next) {
  try {
    const round = await InterviewRound.findById(req.params.id);
    if (!round) {
      return res.status(404).json({ message: 'Round not found' });
    }
    const isRecruiter = req.userRole === 'RECRUITER';
    const isAssignedInterviewer =
      req.userRole === 'INTERVIEWER' && round.interviewerId.toString() === req.userId;

    if (!isRecruiter && !isAssignedInterviewer) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { name, status, scheduledAt, interviewerId, templateId } = req.body;
    if (isRecruiter) {
      if (name !== undefined) round.name = name;
      if (status !== undefined) round.status = status;
      if (scheduledAt !== undefined) round.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
      if (interviewerId !== undefined) {
        const u = await User.findById(interviewerId);
        if (!u || u.role !== 'INTERVIEWER') {
          return res.status(400).json({ message: 'interviewerId must be an INTERVIEWER' });
        }
        round.interviewerId = interviewerId;
      }
      if (templateId !== undefined) {
        const t = await Template.findById(templateId);
        if (!t) return res.status(404).json({ message: 'Template not found' });
        round.templateId = templateId;
      }
    } else {
      if (status !== undefined) round.status = status;
    }

    const client = supa.getClient && supa.getClient();
    if (client && round.supabaseId) {
      // update in Supabase
      const updatesPayload = {};
      if (name !== undefined) updatesPayload.name = name;
      if (status !== undefined) updatesPayload.status = status;
      if (scheduledAt !== undefined) updatesPayload.scheduled_at = scheduledAt ? new Date(scheduledAt) : null;
      if (interviewerId !== undefined) {
        const u = await User.findById(interviewerId);
        if (!u) return res.status(400).json({ message: 'interviewer not found' });
        updatesPayload.interviewer_id = u.supabaseId || null;
      }
      if (templateId !== undefined) {
        const t = await Template.findById(templateId);
        if (!t) return res.status(404).json({ message: 'Template not found' });
        updatesPayload.template_id = t.supabaseId || null;
      }
      const data = await supa.updateRoundById(round.supabaseId, updatesPayload);
      if (!data || !data.length) return res.status(500).json({ message: 'Supabase update failed' });
      const row = data[0];
      // sync local mapping
      round.name = row.name;
      round.status = row.status;
      round.scheduledAt = row.scheduled_at;
      await round.save();
      const populated = await InterviewRound.findById(round._id)
        .populate('candidateId', 'name email roleApplied status resumeUrl')
        .populate('interviewerId', 'name email role')
        .populate('templateId');
      return res.json(populated);
    }

    await round.save();
    const populated = await InterviewRound.findById(round._id)
      .populate('candidateId', 'name email roleApplied status resumeUrl')
      .populate('interviewerId', 'name email role')
      .populate('templateId');
    res.json(populated);
  } catch (e) {
    next(e);
  }
}

module.exports = { create, listForCandidate, myRounds, update };
