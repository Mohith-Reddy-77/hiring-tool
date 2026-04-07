const { Template } = require('../models/Template');
const { User } = require('../models/User');
const supa = require('../services/supabase');

async function create(req, res, next) {
  try {
    const { name, structure } = req.body;
    if (!name || structure === undefined) {
      return res.status(400).json({ message: 'name and structure are required' });
    }
    const client = supa.getClient && supa.getClient();
    const userId = req.userId || null;
    const user = userId ? await User.findById(userId).lean() : null;
    if (client) {
      // Supabase primary
      const payload = {
        name,
        structure,
        created_at: new Date(),
        created_by_mongo_id: userId || null,
        created_by_supabase_id: user ? user.supabaseId || null : null,
      };
      try {
        const data = await supa.insertTemplate(payload);
        if (!data || !data.length) return res.status(500).json({ message: 'Supabase insert failed' });
        const row = data[0];
          // create or update local mapping for compatibility, but return Supabase-centric id
          try {
            let mongo = await Template.findOne({ supabaseId: row.id });
            if (!mongo) {
              await Template.create({ name: row.name, structure: row.structure, supabaseId: row.id, createdAt: row.created_at, createdBy: userId, createdBySupabaseId: user ? user.supabaseId || null : null });
            } else {
              mongo.name = row.name;
              mongo.structure = row.structure;
              if (userId) mongo.createdBy = userId;
              if (user && user.supabaseId) mongo.createdBySupabaseId = user.supabaseId;
              await mongo.save();
            }
          } catch (e) {
            console.warn('Template local mapping failed:', e?.message || e);
          }
          return res.status(201).json({ _id: row.id, name: row.name, structure: row.structure, supabaseId: row.id, createdAt: row.created_at });
      } catch (e) {
        console.warn('Supabase insertTemplate failed:', e?.message || e);
        return res.status(500).json({ message: 'Template create failed' });
      }
    }

    // fallback to Mongo
    const template = await Template.create({ name, structure });
    try {
      const data = await supa.insertTemplate(template);
      if (data && data.length && data[0].id) {
        template.supabaseId = data[0].id;
        await template.save();
      }
    } catch (e) {
      console.warn('Supabase sync template failed:', e?.message || e);
    }
    res.status(201).json(template);
  } catch (e) {
    next(e);
  }
}

async function list(req, res, next) {
  try {
    const client = supa.getClient && supa.getClient();
    const userId = req.userId || null;
    const user = userId ? await User.findById(userId).lean() : null;
    if (client) {
      // If recruiter, filter templates to those created by this recruiter
      let rows = null;
      if (req.userRole === 'RECRUITER') {
        rows = await supa.listTemplates(200, { mongoId: userId, supaId: user ? user.supabaseId || null : null });
      } else {
        rows = await supa.listTemplates(200);
      }
      const mapped = (rows || []).map((r) => ({ _id: r.id, name: r.name, structure: r.structure, supabaseId: r.id, createdAt: r.created_at }));
      // attempt to ensure local mappings exist (best-effort)
      (async () => {
        try {
          for (const r of rows || []) {
            const exists = await Template.findOne({ supabaseId: r.id }).lean();
            if (!exists) {
              await Template.create({ name: r.name, structure: r.structure, supabaseId: r.id, createdAt: r.created_at, createdBy: r.created_by_mongo_id || null, createdBySupabaseId: r.created_by_supabase_id || null });
            }
          }
        } catch (e) {
          console.warn('Template mapping background sync failed:', e?.message || e);
        }
      })();
      return res.json(mapped);
    }
    const templates = await Template.find().sort({ createdAt: -1 });
    res.json(templates);
  } catch (e) {
    next(e);
  }
}

async function getById(req, res, next) {
  try {
    const client = supa.getClient && supa.getClient();
    const id = req.params.id;
    if (client) {
      // if id looks like UUID, read from Supabase directly; otherwise use Mongo mapping
      const isUUID = (v) => typeof v === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);
      let row = null;
      if (isUUID(id)) {
        row = await supa.getTemplateById ? await supa.getTemplateById(id) : null;
      } else {
        const mongo = await Template.findById(id).lean();
        if (mongo && mongo.supabaseId) {
          row = await supa.getTemplateById ? await supa.getTemplateById(mongo.supabaseId) : null;
        } else if (mongo) return res.json(mongo);
      }
      if (!row) return res.status(404).json({ message: 'Template not found' });
      const mongoMap = await Template.findOne({ supabaseId: row.id }).lean();
      return res.json(mongoMap ? mongoMap : { _id: row.id, name: row.name, structure: row.structure, supabaseId: row.id, createdAt: row.created_at });
    }
    const template = await Template.findById(req.params.id);
    if (!template) return res.status(404).json({ message: 'Template not found' });
    res.json(template);
  } catch (e) {
    next(e);
  }
}

module.exports = { create, list, getById };
