const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supa = require('../services/supabase');

function signToken(subjectId, role) {
  return jwt.sign({ sub: String(subjectId), role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

async function register(req, res, next) {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'name, email, password, and role are required' });
    }
    // Hash password first
    const hashed = await bcrypt.hash(password, 10);
    // Create user in Supabase (primary)
    const client = supa.getClient && supa.getClient();
    if (!client) return res.status(500).json({ message: 'Supabase client not configured' });
    const payload = { name, email: email.toLowerCase(), role, password_hash: hashed, created_at: new Date() };
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

module.exports = { register, login };
