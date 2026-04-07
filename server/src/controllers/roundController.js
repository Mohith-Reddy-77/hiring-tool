const mongoose = require('mongoose');
const { InterviewRound } = require('../models/InterviewRound');
const { Candidate } = require('../models/Candidate');
const { User } = require('../models/User');
const { Template } = require('../models/Template');
const { Feedback } = require('../models/Feedback');
const supa = require('../services/supabase');

function normalizeFeedbackRow(row) {
  if (!row) return null;
  return {
    _id: row.id || row.supabaseId || null,
    ratings: row.ratings || row.ratings || null,
    notes: row.notes || row.note || null,
    submittedAt: row.submitted_at || row.submittedAt || row.created_at || null,
    createdAt: row.created_at || row.createdAt || null,
  };
}

async function create(req, res, next) {
  try {
    const { candidateId, interviewerId, templateId, name, status, scheduledAt } = req.body;
    if (!candidateId || !interviewerId || !templateId || !name) {
      return res.status(400).json({ message: 'candidateId, interviewerId, templateId, and name are required' });
    }
    const client = supa.getClient && supa.getClient();
    if (client) {
      // assume incoming IDs are Supabase UUIDs
      const payload = {
        candidate_id: candidateId,
        interviewer_id: interviewerId,
        template_id: templateId,
        name,
        status: status || 'PENDING',
        scheduled_at: scheduledAt ? new Date(scheduledAt) : null,
        created_at: new Date(),
      };
      try {
        const data = await supa.insertRound(payload);
        if (!data || !data.length) return res.status(500).json({ message: 'Supabase insert failed' });
        const row = data[0];
        // resolve interviewer and template details for client-friendly response
        const interviewerResp = await client.from('users').select('id,name,email,role').eq('id', row.interviewer_id).maybeSingle();
        const templateRow = row.template_id ? await supa.getTemplateById(row.template_id) : null;
        // try to fetch feedback if any
        const feedbackResp = await client.from('feedback').select('*').eq('round_id', row.id).maybeSingle();
        // fetch candidate details
        const candidateResp = row.candidate_id ? await client.from('candidates').select('id,name,email,resume_path').eq('id', row.candidate_id).maybeSingle() : null;
        let candidateObj = { _id: row.candidate_id };
        if (candidateResp && candidateResp.data) {
          const resumeLink = await supa.getResumeUrl(candidateResp.data.resume_path);
          candidateObj = { _id: candidateResp.data.id, name: candidateResp.data.name, email: candidateResp.data.email, resumeUrl: resumeLink || candidateResp.data.resume_path };
        }
        const resp = {
          _id: row.id,
          name: row.name,
          status: row.status,
          scheduledAt: row.scheduled_at,
          createdAt: row.created_at,
          candidateId: candidateObj,
          interviewerId: interviewerResp && interviewerResp.data ? { _id: interviewerResp.data.id, name: interviewerResp.data.name, email: interviewerResp.data.email, role: interviewerResp.data.role } : null,
          templateId: templateRow || null,
          feedback: feedbackResp && feedbackResp.data ? normalizeFeedbackRow(feedbackResp.data) : null,
        };
        return res.status(201).json(resp);
      } catch (e) {
        console.warn('Supabase insertRound failed:', e?.message || e);
        return res.status(500).json({ message: 'Round create failed' });
      }
    }

    // fallback to Mongo-only flow (unchanged)
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
    const client = supa.getClient && supa.getClient();
    // If Supabase client is configured, treat id as Supabase candidate id
    if (client) {
      const rows = await supa.listRoundsForCandidate(id, 200);
      if (!rows) return res.json([]);
      const mapped = await Promise.all(
        (rows || []).map(async (r) => {
          const interviewerResp = r.interviewer_id ? await client.from('users').select('id,name,email,role').eq('id', r.interviewer_id).maybeSingle() : null;
          const templateRow = r.template_id ? await supa.getTemplateById(r.template_id) : null;
          const feedbackResp = await client.from('feedback').select('*').eq('round_id', r.id).maybeSingle();
          let candidateIdField = r.candidate_id;
          if (candidateResp && candidateResp.data) {
            const resumeLink = await supa.getResumeUrl(candidateResp.data.resume_path);
            candidateIdField = { _id: candidateResp.data.id, name: candidateResp.data.name, email: candidateResp.data.email, resumeUrl: resumeLink || candidateResp.data.resume_path };
          }
          return {
            _id: r.id,
            name: r.name,
            status: r.status,
            scheduledAt: r.scheduled_at,
            createdAt: r.created_at,
            candidateId: candidateIdField,
            interviewerId: interviewerResp && interviewerResp.data ? { _id: interviewerResp.data.id, name: interviewerResp.data.name, email: interviewerResp.data.email, role: interviewerResp.data.role } : null,
            templateId: templateRow || null,
            feedback: feedbackResp && feedbackResp.data ? normalizeFeedbackRow(feedbackResp.data) : null,
          };
        })
      );
      return res.json(mapped);
    }

    // fallback to Mongo-only flow
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
    const client = supa.getClient && supa.getClient();
    if (client) {
      const { data, error } = await client.from('interview_rounds').select('*').eq('interviewer_id', req.userId).order('scheduled_at', { ascending: true }).limit(200);
      if (error) return res.status(500).json({ message: 'Failed to list rounds' });
      const mapped = await Promise.all((data || []).map(async (r) => {
        const interviewerResp = r.interviewer_id ? await client.from('users').select('id,name,email,role').eq('id', r.interviewer_id).maybeSingle() : null;
        const templateRow = r.template_id ? await supa.getTemplateById(r.template_id) : null;
        const feedbackResp = await client.from('feedback').select('*').eq('round_id', r.id).maybeSingle();
        const candidateResp = r.candidate_id ? await client.from('candidates').select('id,name,email,resume_path').eq('id', r.candidate_id).maybeSingle() : null;
        let candidateObj = { _id: r.candidate_id };
        if (candidateResp && candidateResp.data) {
          const resumeLink = await supa.getResumeUrl(candidateResp.data.resume_path);
          candidateObj = { _id: candidateResp.data.id, name: candidateResp.data.name, email: candidateResp.data.email, resumeUrl: resumeLink || candidateResp.data.resume_path };
        }
        return {
          _id: r.id,
          name: r.name,
          status: r.status,
          scheduledAt: r.scheduled_at,
          createdAt: r.created_at,
          candidateId: candidateObj,
          interviewerId: interviewerResp && interviewerResp.data ? { _id: interviewerResp.data.id, name: interviewerResp.data.name, email: interviewerResp.data.email, role: interviewerResp.data.role } : null,
          templateId: templateRow || null,
          feedback: feedbackResp && feedbackResp.data ? normalizeFeedbackRow(feedbackResp.data) : null,
        };
      }));
      return res.json(mapped);
    }

    // fallback to local mappings
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
    // Try Supabase-first update flow
    const client = supa.getClient && supa.getClient();
    if (client) {
      const row = await supa.getRoundById(req.params.id);
      if (!row) return res.status(404).json({ message: 'Round not found' });
      const isRecruiter = req.userRole === 'RECRUITER';
      const isAssignedInterviewer = req.userRole === 'INTERVIEWER' && row.interviewer_id === req.userId;
      if (!isRecruiter && !isAssignedInterviewer) return res.status(403).json({ message: 'Forbidden' });

      const { name, status, scheduledAt, interviewerId, templateId } = req.body;
      const updatesPayload = {};
      if (name !== undefined) updatesPayload.name = name;
      if (status !== undefined) updatesPayload.status = status;
      if (scheduledAt !== undefined) updatesPayload.scheduled_at = scheduledAt ? new Date(scheduledAt) : null;
      if (interviewerId !== undefined) {
        // validate interviewer exists
        const uResp = await client.from('users').select('id,role,name,email').eq('id', interviewerId).maybeSingle();
        if (!uResp || uResp.error || !uResp.data) return res.status(400).json({ message: 'interviewer not found' });
        if (uResp.data.role !== 'INTERVIEWER') return res.status(400).json({ message: 'interviewerId must be an INTERVIEWER' });
        updatesPayload.interviewer_id = interviewerId;
      }
      if (templateId !== undefined) {
        const t = await supa.getTemplateById(templateId);
        if (!t) return res.status(404).json({ message: 'Template not found' });
        updatesPayload.template_id = templateId;
      }

      const data = await supa.updateRoundById(req.params.id, updatesPayload);
      if (!data || !data.length) return res.status(500).json({ message: 'Supabase update failed' });
      const newRow = data[0];
      const interviewerResp = newRow.interviewer_id ? await client.from('users').select('id,name,email,role').eq('id', newRow.interviewer_id).maybeSingle() : null;
      const templateRow = newRow.template_id ? await supa.getTemplateById(newRow.template_id) : null;
      const feedbackResp = await client.from('feedback').select('*').eq('round_id', newRow.id).maybeSingle();
      const resp = {
        _id: newRow.id,
        name: newRow.name,
        status: newRow.status,
        scheduledAt: newRow.scheduled_at,
        createdAt: newRow.created_at,
        candidateId: newRow.candidate_id,
        interviewerId: interviewerResp && interviewerResp.data ? { _id: interviewerResp.data.id, name: interviewerResp.data.name, email: interviewerResp.data.email, role: interviewerResp.data.role } : null,
        templateId: templateRow || null,
        feedback: feedbackResp && feedbackResp.data ? feedbackResp.data : null,
      };
      return res.json(resp);
    }

    // fallback to Mongo update flow
    const round = await InterviewRound.findById(req.params.id);
    if (!round) {
      return res.status(404).json({ message: 'Round not found' });
    }
    const isRecruiter = req.userRole === 'RECRUITER';
    const isAssignedInterviewer = req.userRole === 'INTERVIEWER' && round.interviewerId.toString() === req.userId;
    if (!isRecruiter && !isAssignedInterviewer) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { name, status, scheduledAt, interviewerId, templateId } = req.body;
    if (isRecruiter) {
      if (name !== undefined) round.name = name;
      if (status !== undefined) round.status = status;
      if (scheduledAt !== undefined) round.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
      if (interviewerId !== undefined) {
        const isUUID = (v) => typeof v === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);
        let u = null;
        if (isUUID(interviewerId)) {
          u = await User.findOne({ supabaseId: interviewerId }).lean();
        } else {
          u = await User.findById(interviewerId);
        }
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
