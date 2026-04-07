const { fileStorage } = require('../services');
const supa = require('../services/supabase');

async function create(req, res, next) {
  try {
    console.log('POST /api/candidates called - auth:', { userId: req.userId, userRole: req.userRole });
    const { name, email, roleApplied, status } = req.body;
    if (!name || !email || !roleApplied) {
      return res.status(400).json({ message: 'name, email, and roleApplied are required' });
    }
    let resumeUrl = '';
    if (req.file) {
      resumeUrl = await fileStorage.uploadFile(req.file);
    }
    const client = supa.getClient && supa.getClient();
    if (!client) return res.status(500).json({ message: 'Supabase client not configured' });

    const payload = {
      name,
      email,
      role_applied: roleApplied,
      resume_path: resumeUrl || null,
      status: status || 'APPLIED',
      created_by_supabase_id: req.userId || null,
      created_at: new Date(),
    };
    const data = await supa.insertCandidate(payload);
    if (!data || !data.length) return res.status(500).json({ message: 'Supabase insert failed' });
    const row = data[0];
    // Return object with `_id` for client compatibility (use Supabase UUID)
    const resumeLink = await supa.getResumeUrl(row.resume_path);
    const mapped = {
      _id: row.id,
      name: row.name,
      email: row.email,
      roleApplied: row.role_applied,
      resumeUrl: resumeLink || row.resume_path,
      status: row.status,
      supabaseId: row.id,
      createdAt: row.created_at,
    };
    return res.status(201).json(mapped);
  } catch (e) {
    next(e);
  }
}

async function list(req, res, next) {
  try {
    const client = supa.getClient && supa.getClient();
    if (!client) return res.status(500).json({ message: 'Supabase client not configured' });
    const owner = { supaId: req.userId };
    const rows = await supa.listCandidates(200, owner);
    const mapped = await Promise.all((rows || []).map(async (r) => {
      const resumeLink = await supa.getResumeUrl(r.resume_path);
      return {
        _id: r.id,
        name: r.name,
        email: r.email,
        roleApplied: r.role_applied,
        resumeUrl: resumeLink || r.resume_path,
        status: r.status,
        supabaseId: r.id,
        createdAt: r.created_at,
      };
    }));
    return res.json(mapped);
  } catch (e) {
    next(e);
  }
}

async function getById(req, res, next) {
  try {
    const client = supa.getClient && supa.getClient();
    if (!client) return res.status(500).json({ message: 'Supabase client not configured' });
    const id = req.params.id;
    // Treat id as Supabase UUID
    const row = await supa.getCandidateById(id);
    if (!row) return res.status(404).json({ message: 'Candidate not found' });
    const resumeLink = await supa.getResumeUrl(row.resume_path);
    const mapped = {
      _id: row.id,
      name: row.name,
      email: row.email,
      roleApplied: row.role_applied,
      resumeUrl: resumeLink || row.resume_path,
      status: row.status,
      supabaseId: row.id,
      createdAt: row.created_at,
    };
    return res.json(mapped);
  } catch (e) {
    next(e);
  }
}

async function update(req, res, next) {
  try {
    const { name, email, roleApplied, status, resumeUrl } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (roleApplied !== undefined) updates.roleApplied = roleApplied;
    if (status !== undefined) updates.status = status;
    if (resumeUrl !== undefined) updates.resumeUrl = resumeUrl;
    if (req.file) {
      updates.resumeUrl = await fileStorage.uploadFile(req.file);
    }
    const client = supa.getClient && supa.getClient();
    if (!client) return res.status(500).json({ message: 'Supabase client not configured' });
    const supaId = req.params.id;
    // prepare updates payload for Supabase
    const updatesPayload = {};
    if (updates.name !== undefined) updatesPayload.name = updates.name;
    if (updates.email !== undefined) updatesPayload.email = updates.email;
    if (updates.roleApplied !== undefined) updatesPayload.role_applied = updates.roleApplied;
    if (updates.resumeUrl !== undefined) updatesPayload.resume_path = updates.resumeUrl;
    if (updates.status !== undefined) updatesPayload.status = updates.status;
    const data = await supa.updateCandidateById(supaId, updatesPayload);
    if (!data || !data.length) return res.status(500).json({ message: 'Supabase update failed' });
    const row = data[0];
    const resumeLink = await supa.getResumeUrl(row.resume_path);
    const mapped = {
      _id: row.id,
      name: row.name,
      email: row.email,
      roleApplied: row.role_applied,
      resumeUrl: resumeLink || row.resume_path,
      status: row.status,
      supabaseId: row.id,
      createdAt: row.created_at,
    };
    return res.json(mapped);
  } catch (e) {
    next(e);
  }
}

module.exports = { create, list, getById, update };
