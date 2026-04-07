const { Candidate } = require('../models/Candidate');
const { User } = require('../models/User');
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
    if (client) {
      // Use Supabase as primary
      // attach owner mapping where possible so Supabase records can be filtered per recruiter
      const mongoUser = await User.findById(req.userId).lean();
      const payload = {
        name,
        email,
        role_applied: roleApplied,
        resume_path: resumeUrl || null,
        status: status || 'APPLIED',
        created_by_mongo_id: req.userId,
        created_by_supabase_id: mongoUser && mongoUser.supabaseId ? mongoUser.supabaseId : null,
        created_at: new Date(),
      };
      console.log('Supabase payload:', payload);
      const data = await supa.insertCandidate(payload);
      console.log('Supabase insert result:', Array.isArray(data) ? data[0] : data);
      if (!data || !data.length) {
        return res.status(500).json({ message: 'Supabase insert failed' });
      }
      // Persist a lightweight Mongo mapping so other controllers (rounds, feedback)
      // can reference a Mongo ObjectId. Prefer updating existing mapping if present.
      const row = data[0];
      let mongoCandidate = await Candidate.findOne({ supabaseId: row.id });
      if (!mongoCandidate) {
        mongoCandidate = await Candidate.create({
          name: row.name,
          email: row.email,
          roleApplied: row.role_applied,
          resumeUrl: row.resume_path,
          status: row.status,
          supabaseId: row.id,
          createdAt: row.created_at,
          createdBy: req.userId,
        });
      } else {
        // keep Mongo doc reasonably in sync
        mongoCandidate.name = row.name;
        mongoCandidate.email = row.email;
        mongoCandidate.roleApplied = row.role_applied;
        mongoCandidate.resumeUrl = row.resume_path;
        mongoCandidate.status = row.status;
        await mongoCandidate.save();
      }
      // Return the Mongo document so the client can navigate using a valid Mongo ObjectId
      return res.status(201).json(mongoCandidate);
    }
    // fallback to Mongo
    const candidate = await Candidate.create({
      name,
      email,
      roleApplied,
      resumeUrl,
      ...(status && { status }),
      createdBy: req.userId,
    });
    // try to sync to Supabase if configured (best-effort)
    try {
      const data = await supa.insertCandidate(candidate);
      if (data && data.length && data[0].id) {
        candidate.supabaseId = data[0].id;
        await candidate.save();
      }
    } catch (e) {
      console.warn('Supabase sync candidate failed:', e?.message || e);
    }
    res.status(201).json(candidate);
  } catch (e) {
    next(e);
  }
}

async function list(req, res, next) {
  try {
    const client = supa.getClient && supa.getClient();
    if (client) {
      // Filter candidates to the authenticated recruiter only
      const mongoUser = await User.findById(req.userId).lean();
      const owner = { mongoId: req.userId, supaId: mongoUser && mongoUser.supabaseId ? mongoUser.supabaseId : null };
      const rows = await supa.listCandidates(200, owner);
      // Ensure we return Mongo _id values for client compatibility by mapping
      const mapped = await Promise.all(
        (rows || []).map(async (r) => {
          let mongo = await Candidate.findOne({ supabaseId: r.id }).lean();
          if (!mongo) {
            // create lightweight mapping
            const created = await Candidate.create({
              name: r.name,
              email: r.email,
              roleApplied: r.role_applied,
              resumeUrl: r.resume_path,
              status: r.status,
              supabaseId: r.id,
              createdAt: r.created_at,
              createdBy: req.userId,
            });
            mongo = created.toObject();
          }
          return {
            _id: mongo._id,
            name: r.name,
            email: r.email,
            roleApplied: r.role_applied,
            resumeUrl: r.resume_path,
            status: r.status,
            supabaseId: r.id,
            createdAt: r.created_at,
          };
        })
      );
      return res.json(mapped);
    }
    // For Mongo fallback, recruiters should only see their own candidates
    const query = req.userRole === 'RECRUITER' ? { createdBy: req.userId } : {};
    const candidates = await Candidate.find(query).sort({ createdAt: -1 });
    res.json(candidates);
  } catch (e) {
    next(e);
  }
}

async function getById(req, res, next) {
  try {
    const client = supa.getClient && supa.getClient();
    const id = req.params.id;
    if (client) {
      // If id looks like UUID, treat as supabaseId, else attempt to query by supabaseId stored in Mongo
      const isUUID = (v) => typeof v === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);
      let row = null;
      if (isUUID(id)) {
        row = await supa.getCandidateById(id);
      } else {
        // try to find Mongo doc with this id and read its supabaseId
        const mongo = await Candidate.findById(id).lean();
        if (mongo && mongo.supabaseId) {
          row = await supa.getCandidateById(mongo.supabaseId);
        } else if (mongo) {
          // Supabase client is present but this candidate hasn't been mirrored yet — return Mongo data
          return res.json(mongo);
        }
      }
      if (!row) return res.status(404).json({ message: 'Candidate not found' });
      // Prefer returning the Mongo mapping _id when available
      const mongoMap = await Candidate.findOne({ supabaseId: row.id }).lean();
      const mapped = {
        _id: mongoMap ? mongoMap._id : row.id,
        name: row.name,
        email: row.email,
        roleApplied: row.role_applied,
        resumeUrl: row.resume_path,
        status: row.status,
        supabaseId: row.id,
        createdAt: row.created_at,
      };
      return res.json(mapped);
    }
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }
    res.json(candidate);
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
    if (client) {
      // Determine supabase id
      const isUUID = (v) => typeof v === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);
      let supaId = null;
      if (isUUID(req.params.id)) supaId = req.params.id;
      else {
        const mongo = await Candidate.findById(req.params.id).lean();
        if (mongo && mongo.supabaseId) supaId = mongo.supabaseId;
      }
      if (!supaId) return res.status(404).json({ message: 'Candidate not found' });
      // update in Supabase
      const updatesPayload = {};
      if (updates.name !== undefined) updatesPayload.name = updates.name;
      if (updates.email !== undefined) updatesPayload.email = updates.email;
      if (updates.roleApplied !== undefined) updatesPayload.role_applied = updates.roleApplied;
      if (updates.resumeUrl !== undefined) updatesPayload.resume_path = updates.resumeUrl;
      if (updates.status !== undefined) updatesPayload.status = updates.status;
      const data = await supa.updateCandidateById(supaId, updatesPayload);
      if (!data || !data.length) return res.status(500).json({ message: 'Supabase update failed' });
      const row = data[0];
      // update Mongo mapping if present and return Mongo document for consistency
      let mongo = await Candidate.findOne({ supabaseId: row.id });
      if (mongo) {
        mongo.name = row.name;
        mongo.email = row.email;
        mongo.roleApplied = row.role_applied;
        mongo.resumeUrl = row.resume_path;
        mongo.status = row.status;
        await mongo.save();
        return res.json(mongo);
      }
      const mapped = {
        _id: row.id,
        name: row.name,
        email: row.email,
        roleApplied: row.role_applied,
        resumeUrl: row.resume_path,
        status: row.status,
        supabaseId: row.id,
        createdAt: row.created_at,
      };
      return res.json(mapped);
    }
    const candidate = await Candidate.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!candidate) {
      return res.status(404).json({ message: 'Candidate not found' });
    }
    try {
      // sync updated resume path if present
      if (candidate && candidate.resumeUrl) {
        const data = await supa.updateCandidateResume(String(candidate._id), String(candidate.resumeUrl));
        if (data && data.length && data[0].id) {
          // update supabaseId if available
          candidate.supabaseId = data[0].id;
          await candidate.save();
        }
      } else if (candidate) {
        const data = await supa.insertCandidate(candidate);
        if (data && data.length && data[0].id) {
          candidate.supabaseId = data[0].id;
          await candidate.save();
        }
      }
    } catch (e) {
      console.warn('Supabase sync candidate update failed:', e?.message || e);
    }
    res.json(candidate);
  } catch (e) {
    next(e);
  }
}

module.exports = { create, list, getById, update };
