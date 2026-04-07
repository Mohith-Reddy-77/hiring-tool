const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models/User');
const supa = require('../services/supabase');

function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function register(req, res, next) {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'name, email, password, and role are required' });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    // Hash password first
    const hashed = await bcrypt.hash(password, 10);

    // Prefer creating the user in Supabase (primary) then create local Mongo mapping for compatibility
    let supaId = null;
    try {
      const client = supa.getClient && supa.getClient();
      if (client) {
        const payload = {
          name,
          email: email.toLowerCase(),
          role,
          password_hash: hashed,
          created_at: new Date(),
        };
        console.log('Inserting user to Supabase:', { email: payload.email, role: payload.role });
        const { data, error } = await client.from('users').upsert(payload).select();
        console.log('Supabase upsert response:', { data: data && data[0], error });
        if (!error && data && data.length) {
          supaId = data[0].id || null;
        } else if (error) {
          console.warn('Supabase upsert user error:', error);
        }
      }
    } catch (e) {
      console.warn('Supabase upsert user unexpected:', e?.message || e);
    }

    // Create local Mongo user mapping for compatibility (so existing code that expects Mongo _id keeps working)
    const user = await User.create({ name, email: email.toLowerCase(), password: hashed, role, supabaseId: supaId });

    const token = signToken(user);
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
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
    // Supabase is primary: try Supabase users table first
    let user = null;
    try {
      const client = supa.getClient && supa.getClient();
      if (client) {
        const { data: rows, error } = await client.from('users').select('*').eq('email', email.toLowerCase()).limit(1);
        if (!error && rows && rows.length) {
          const row = rows[0];
          const pwHash = row.password_hash || row.passwordHash || null;
          if (pwHash) {
            const okRemote = await bcrypt.compare(password, pwHash);
            if (okRemote) {
              // ensure local mapping exists (create or update)
              const existing = await User.findOne({ email: email.toLowerCase() });
              if (existing) {
                existing.supabaseId = row.id || existing.supabaseId;
                await existing.save();
                user = existing;
              } else {
                // create local user mapping using same hashed password
                const hashed = await bcrypt.hash(password, 10);
                user = await User.create({ name: row.name || email.split('@')[0], email: email.toLowerCase(), password: hashed, role: row.role || 'RECRUITER', supabaseId: row.id || null });
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Supabase auth check failed:', e?.message || e);
    }

    // If not authenticated via Supabase, fallback to local Mongo users
    if (!user) {
      user = await User.findOne({ email: email.toLowerCase() });
    }
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = signToken(user);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (e) {
    next(e);
  }
}

module.exports = { register, login };
