const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
function getClient() {
  if (supabase) return supabase;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  return supabase;
}

// Warn at load time if Supabase service key is not configured — many sync operations require it
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn('Supabase service client not configured. Set SUPABASE_SERVICE_ROLE_KEY in server/.env to enable server-side sync and storage uploads.');
}

async function insertCandidate(candidate) {
  try {
    const client = getClient();
    if (!client) return null;
    // If candidate._id is not a valid UUID, omit `id` so Postgres will generate one.
    const isUUID = (v) => typeof v === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);
    const payload = {
      ...(isUUID(candidate._id) ? { id: String(candidate._id) } : {}),
      name: candidate.name,
      email: candidate.email,
      role_applied: candidate.roleApplied || candidate.role_applied || null,
      resume_path: candidate.resumeUrl || candidate.resume_path || null,
      status: candidate.status || null,
      // preserve owner mapping when available
      created_by_mongo_id: candidate.createdByMongoId || candidate.created_by_mongo_id || null,
      created_by_supabase_id: candidate.createdBySupabaseId || candidate.created_by_supabase_id || null,
      created_at: candidate.createdAt || candidate.created_at || null,
    };
    let { data, error } = await client.from('candidates').upsert(payload).select();
    if (error) {
      console.warn('Supabase insertCandidate error:', error);
      // If schema doesn't have owner columns, retry without them (schema may be older)
      if (error.code === 'PGRST204' || (error.message && error.message.includes("Could not find the 'created_by"))) {
        const fallback = {
          ...(isUUID(candidate._id) ? { id: String(candidate._id) } : {}),
          name: candidate.name,
          email: candidate.email,
          role_applied: candidate.roleApplied || candidate.role_applied || null,
          resume_path: candidate.resumeUrl || candidate.resume_path || null,
          status: candidate.status || null,
          created_at: candidate.createdAt || candidate.created_at || null,
        };
        const retry = await client.from('candidates').upsert(fallback).select();
        if (retry.error) {
          console.warn('Supabase insertCandidate retry error:', retry.error);
          return null;
        }
        return retry.data;
      }
      return null;
    }
    return data;
  } catch (e) {
    console.warn('Supabase insertCandidate unexpected:', e?.message || e);
    return null;
  }
}

async function updateCandidateResume(candidateId, resumePath) {
  try {
    const client = getClient();
    if (!client) return null;
    const { data, error } = await client.from('candidates').update({ resume_path: resumePath }).eq('id', candidateId).select();
    if (error) {
      console.warn('Supabase updateCandidateResume error:', error);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('Supabase updateCandidateResume unexpected:', e?.message || e);
    return null;
  }
}

async function insertTemplate(template) {
  try {
    const client = getClient();
    if (!client) return null;
    const isUUID = (v) => typeof v === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);
    const payload = {
      ...(isUUID(template._id) ? { id: String(template._id) } : {}),
      name: template.name,
      structure: template.structure || template,
      // owner mapping support
      created_by_mongo_id: template.createdBy || template.created_by_mongo_id || null,
      created_by_supabase_id: template.createdBySupabaseId || template.created_by_supabase_id || null,
      created_at: template.createdAt || template.created_at || null,
    };
    let { data, error } = await client.from('templates').upsert(payload).select();
    if (error) {
      console.warn('Supabase insertTemplate error:', error);
      // If schema doesn't include owner columns, retry without them
      if (error.code === 'PGRST204' || (error.message && error.message.includes("Could not find the 'created_by"))) {
        const fallback = {
          ...(isUUID(template._id) ? { id: String(template._id) } : {}),
          name: template.name,
          structure: template.structure || template,
          created_at: template.createdAt || template.created_at || null,
        };
        const retry = await client.from('templates').upsert(fallback).select();
        if (retry.error) {
          console.warn('Supabase insertTemplate retry error:', retry.error);
          return null;
        }
        return retry.data;
      }
      return null;
    }
    return data;
  } catch (e) {
    console.warn('Supabase insertTemplate unexpected:', e?.message || e);
    return null;
  }
}

async function insertRound(round) {
  try {
    const client = getClient();
    if (!client) return null;
    const isUUID = (v) => typeof v === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);
    const payload = {
      ...(isUUID(round._id) ? { id: String(round._id) } : {}),
      candidate_id: isUUID(round.candidateId) ? String(round.candidateId) : round.candidate_id || null,
      interviewer_id: isUUID(round.interviewerId) ? String(round.interviewerId) : round.interviewer_id || null,
      template_id: isUUID(round.templateId) ? String(round.templateId) : round.template_id || null,
      name: round.name,
      status: round.status || null,
      scheduled_at: round.scheduledAt || round.scheduled_at || null,
      created_at: round.createdAt || round.created_at || null,
    };
    const { data, error } = await client.from('interview_rounds').upsert(payload).select();
    if (error) {
      console.warn('Supabase insertRound error:', error);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('Supabase insertRound unexpected:', e?.message || e);
    return null;
  }
}

async function insertFeedback(feedback) {
  try {
    const client = getClient();
    if (!client) return null;
    const isUUID = (v) => typeof v === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);
    const payload = {
      ...(isUUID(feedback._id) ? { id: String(feedback._id) } : {}),
      round_id: isUUID(feedback.roundId) ? String(feedback.roundId) : feedback.round_id || null,
      ratings: feedback.ratings,
      notes: feedback.notes || null,
      submitted_at: feedback.submittedAt || feedback.submitted_at || null,
      created_at: feedback.createdAt || feedback.created_at || null,
    };
    const { data, error } = await client.from('feedback').upsert(payload).select();
    if (error) {
      console.warn('Supabase insertFeedback error:', error);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('Supabase insertFeedback unexpected:', e?.message || e);
    return null;
  }
}

module.exports = {
  getClient,
  insertCandidate,
  updateCandidateResume,
  insertTemplate,
  insertRound,
  insertFeedback,
};

// Additional helpers for primary CRUD usage
async function getCandidateById(supabaseId) {
  try {
    const client = getClient();
    if (!client) return null;
    const { data, error } = await client.from('candidates').select('*').eq('id', supabaseId).maybeSingle();
    if (error) {
      console.warn('Supabase getCandidateById error:', error);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('Supabase getCandidateById unexpected:', e?.message || e);
    return null;
  }
}

async function listCandidates(limit = 100) {
  try {
    const client = getClient();
    if (!client) return null;
    // Support optional owner filtering by passing an owner object as second arg
    // listCandidates(limit, { mongoId, supaId })
    let query = client.from('candidates').select('*').order('created_at', { ascending: false }).limit(limit);
    // backward-compatible: if caller passed an owner object in place of limit, handle that
    // (function signature preserved for most callers)
    // However if second param provided, treat it as owner
    // This function accepts optional second parameter through arguments[1]
    const owner = arguments[1] || null;
    if (owner) {
      const { mongoId, supaId } = owner;
      if (mongoId && supaId) {
        // either mapping matches
        query = client.from('candidates').select('*').or(`created_by_mongo_id.eq.${mongoId},created_by_supabase_id.eq.${supaId}`).order('created_at', { ascending: false }).limit(limit);
      } else if (mongoId) {
        query = client.from('candidates').select('*').eq('created_by_mongo_id', mongoId).order('created_at', { ascending: false }).limit(limit);
      } else if (supaId) {
        query = client.from('candidates').select('*').eq('created_by_supabase_id', supaId).order('created_at', { ascending: false }).limit(limit);
      }
    }
    let { data, error } = await query;
    if (error) {
      console.warn('Supabase listCandidates error:', error);
      // If owner filtering failed because columns don't exist, fall back to unfiltered list
      if ((arguments[1] || null) && (error.code === 'PGRST204' || (error.message && error.message.includes("Could not find the 'created_by")))) {
        const fallback = await client.from('candidates').select('*').order('created_at', { ascending: false }).limit(limit);
        if (fallback.error) {
          console.warn('Supabase listCandidates fallback error:', fallback.error);
          return null;
        }
        return fallback.data;
      }
      return null;
    }
    return data;
  } catch (e) {
    console.warn('Supabase listCandidates unexpected:', e?.message || e);
    return null;
  }
}

async function updateCandidateById(supabaseId, updates) {
  try {
    const client = getClient();
    if (!client) return null;
    const { data, error } = await client.from('candidates').update(updates).eq('id', supabaseId).select();
    if (error) {
      console.warn('Supabase updateCandidateById error:', error);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('Supabase updateCandidateById unexpected:', e?.message || e);
    return null;
  }
}

// Export new helpers
module.exports.getCandidateById = getCandidateById;
module.exports.listCandidates = listCandidates;
module.exports.updateCandidateById = updateCandidateById;

async function getRoundById(supabaseId) {
  try {
    const client = getClient();
    if (!client) return null;
    const { data, error } = await client.from('interview_rounds').select('*').eq('id', supabaseId).maybeSingle();
    if (error) {
      console.warn('Supabase getRoundById error:', error);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('Supabase getRoundById unexpected:', e?.message || e);
    return null;
  }
}

async function listRoundsForCandidate(candidateSupabaseId, limit = 100) {
  try {
    const client = getClient();
    if (!client) return null;
    const { data, error } = await client
      .from('interview_rounds')
      .select('*')
      .eq('candidate_id', candidateSupabaseId)
      .order('scheduled_at', { ascending: true })
      .limit(limit);
    if (error) {
      console.warn('Supabase listRoundsForCandidate error:', error);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('Supabase listRoundsForCandidate unexpected:', e?.message || e);
    return null;
  }
}

module.exports.getRoundById = getRoundById;
module.exports.listRoundsForCandidate = listRoundsForCandidate;

async function updateRoundById(supabaseId, updates) {
  try {
    const client = getClient();
    if (!client) return null;
    const { data, error } = await client.from('interview_rounds').update(updates).eq('id', supabaseId).select();
    if (error) {
      console.warn('Supabase updateRoundById error:', error);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('Supabase updateRoundById unexpected:', e?.message || e);
    return null;
  }
}

module.exports.updateRoundById = updateRoundById;

async function getTemplateById(supabaseId) {
  try {
    const client = getClient();
    if (!client) return null;
    const { data, error } = await client.from('templates').select('*').eq('id', supabaseId).maybeSingle();
    if (error) {
      console.warn('Supabase getTemplateById error:', error);
      return null;
    }
    return data;
  } catch (e) {
    console.warn('Supabase getTemplateById unexpected:', e?.message || e);
    return null;
  }
}

async function listTemplates(limit = 100) {
  try {
    const client = getClient();
    if (!client) return null;
    // Support optional owner filtering by passing an owner object as second arg
    // listTemplates(limit, { mongoId, supaId })
    const owner = arguments[1] || null;
    let query = client.from('templates').select('*').order('created_at', { ascending: false }).limit(limit);
    if (owner) {
      const { mongoId, supaId } = owner;
      if (mongoId && supaId) {
        query = client.from('templates').select('*').or(`created_by_mongo_id.eq.${mongoId},created_by_supabase_id.eq.${supaId}`).order('created_at', { ascending: false }).limit(limit);
      } else if (mongoId) {
        query = client.from('templates').select('*').eq('created_by_mongo_id', mongoId).order('created_at', { ascending: false }).limit(limit);
      } else if (supaId) {
        query = client.from('templates').select('*').eq('created_by_supabase_id', supaId).order('created_at', { ascending: false }).limit(limit);
      }
    }
    let { data, error } = await query;
    if (error) {
      console.warn('Supabase listTemplates error:', error);
      // If owner filtering failed because columns don't exist, fall back to unfiltered list
      if (owner && (error.code === 'PGRST204' || (error.message && error.message.includes("Could not find the 'created_by")))) {
        const fallback = await client.from('templates').select('*').order('created_at', { ascending: false }).limit(limit);
        if (fallback.error) {
          console.warn('Supabase listTemplates fallback error:', fallback.error);
          return null;
        }
        return fallback.data;
      }
      return null;
    }
    return data;
  } catch (e) {
    console.warn('Supabase listTemplates unexpected:', e?.message || e);
    return null;
  }
}

module.exports.getTemplateById = getTemplateById;
module.exports.listTemplates = listTemplates;

async function getResumeUrl(fileKey, expires = 60) {
  try {
    if (!fileKey) return null;
    const client = getClient();
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    if (client && SUPABASE_URL) {
      try {
        const { data, error } = await client.storage.from('resumes').createSignedUrl(fileKey, expires);
        if (!error && data && data.signedUrl) return data.signedUrl;
      } catch (e) {
        console.warn('Supabase createSignedUrl failed:', e?.message || e);
      }
      return `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/resumes/${encodeURIComponent(fileKey)}`;
    }
    return null;
  } catch (e) {
    console.warn('getResumeUrl unexpected:', e?.message || e);
    return null;
  }
}

module.exports.getResumeUrl = getResumeUrl;
