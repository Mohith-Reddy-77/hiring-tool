const supa = require('../services/supabase');
const { User, ROLES } = require('../models/User');

async function assignRole(req, res, next) {
  try {
    const { id } = req.params; // Supabase user id (UUID)
    let { role } = req.body;
    if (!role) return res.status(400).json({ message: 'role is required' });
    role = String(role).toUpperCase();
    if (!ROLES.includes(role)) return res.status(400).json({ message: 'Invalid role' });

    const client = supa.getClient && supa.getClient();
    if (!client) return res.status(500).json({ message: 'Supabase client not configured' });
    const { data, error } = await client.from('users').update({ role }).eq('id', id).select();
    if (error) {
      console.warn('Supabase update user role error:', error);
      return res.status(500).json({ message: 'Failed to update user role' });
    }

    // Also update local Mongo mapping if present
    try {
      await User.findOneAndUpdate({ supabaseId: id }, { role });
    } catch (e) {
      console.warn('Local user role update failed:', e?.message || e);
    }

    res.json({ user: (data && data[0]) ? data[0] : null });
  } catch (e) {
    next(e);
  }
}

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

async function listUsers(req, res, next) {
  try {
    const client = supa.getClient && supa.getClient();
    if (!client) return res.status(500).json({ message: 'Supabase client not configured' });
    const { data, error } = await client.from('users').select('id, name, email, role').order('name', { ascending: true }).limit(1000);
    if (error) return res.status(500).json({ message: 'Failed to list users' });
    const mapped = (data || []).map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role }));
    res.json(mapped);
  } catch (e) {
    next(e);
  }
}

module.exports = { listInterviewers, listUsers, assignRole };
