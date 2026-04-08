const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supa = require('../services/supabase');

function signToken(subjectId, role) {
  return jwt.sign({ sub: String(subjectId), role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// Exported for use by external auth flows (Google controller)
module.exports = { signToken, register, login, me };

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email, and password are required' });
    }
    // Hash password first
    const hashed = await bcrypt.hash(password, 10);
    // Create user in Supabase (primary)
    const client = supa.getClient && supa.getClient();
    if (!client) return res.status(500).json({ message: 'Supabase client not configured' });
    // Do NOT trust client-supplied role. New registrations receive the default PENDING role
    // so an admin must approve and assign a role before the user can access protected areas.
    const payload = { name, email: email.toLowerCase(), role: 'PENDING', password_hash: hashed, created_at: new Date() };
    const { data, error } = await client.from('users').upsert(payload).select();
    if (error || !data || !data.length) {
      console.warn('Supabase upsert user error:', error);
      return res.status(500).json({ message: 'User create failed' });
    }
    const row = data[0];
    const token = signToken(row.id, row.role || role);
    // Return profile where `id` is Supabase UUID (client expects `id`)
    res.status(201).json({ token, user: { id: row.id, name: row.name, email: row.email, role: row.role } });
  } catch (e) {
    next(e);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }
    // Supabase is primary: try Supabase users table
    const client = supa.getClient && supa.getClient();
    if (!client) return res.status(500).json({ message: 'Supabase client not configured' });
    const { data: rows, error } = await client.from('users').select('*').eq('email', email.toLowerCase()).limit(1);
    if (error || !rows || !rows.length) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const row = rows[0];
    const pwHash = row.password_hash || row.passwordHash || null;
    if (!pwHash) return res.status(401).json({ message: 'Invalid credentials' });
    const okRemote = await bcrypt.compare(password, pwHash);
    if (!okRemote) return res.status(401).json({ message: 'Invalid credentials' });
    const token = signToken(row.id, row.role || 'RECRUITER');
    res.json({ token, user: { id: row.id, name: row.name, email: row.email, role: row.role } });
  } catch (e) {
    next(e);
  }
}

async function me(req, res, next) {
  try {
    const client = supa.getClient && supa.getClient();
    if (!client) return res.status(500).json({ message: 'Supabase client not configured' });
    const supaId = req.userId;
    if (!supaId) return res.status(401).json({ message: 'Authentication required' });
    const { data, error } = await client.from('users').select('id, name, email, role').eq('id', supaId).maybeSingle();
    if (error) return res.status(500).json({ message: 'Failed to fetch profile' });
    if (!data) return res.status(404).json({ message: 'User not found' });
    // Sign a fresh token based on the authoritative Supabase role so clients can refresh their JWT after role changes
    const token = signToken(data.id, data.role);
    res.json({ token, user: { id: data.id, name: data.name, email: data.email, role: data.role } });
  } catch (e) {
    next(e);
  }
}

// Backwards-compatible: ensure default export shape still works for imports
module.exports.register = register;
module.exports.login = login;
module.exports.me = me;

