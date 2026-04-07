const supa = require('../services/supabase');

async function listInterviewers(req, res, next) {
  try {
    const client = supa.getClient && supa.getClient();
    if (!client) return res.status(500).json({ message: 'Supabase client not configured' });
    const { data, error } = await client.from('users').select('id, name, email, role').eq('role', 'INTERVIEWER').order('name', { ascending: true });
    if (error) return res.status(500).json({ message: 'Failed to list users' });
    const mapped = (data || []).map((u) => ({ _id: u.id, name: u.name, email: u.email, role: u.role }));
    res.json(mapped);
  } catch (e) {
    next(e);
  }
}

module.exports = { listInterviewers };
