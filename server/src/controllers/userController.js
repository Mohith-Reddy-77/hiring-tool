const supa = require('../services/supabase');
const { User, ROLES } = require('../models/User');
const mailer = require('../services/mailer');

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

async function invite(req, res, next) {
  try {
    const { email, role, name } = req.body || {};
    if (!email || !role) return res.status(400).json({ message: 'email and role are required' });
    const r = String(role).toUpperCase();
    if (!ROLES.includes(r)) return res.status(400).json({ message: 'Invalid role' });

    const client = supa.getClient && supa.getClient();
    if (!client) return res.status(500).json({ message: 'Supabase client not configured' });

    // Upsert a user record with the invited role. Keep payload minimal to avoid schema mismatch.
    const payload = { email: String(email).toLowerCase(), role: r, name: name || '' };
    let data = null;
    let upsertError = null;
    // Retry upsert a few times in case of transient network errors
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const resp = await client.from('users').upsert(payload).select();
        if (resp && !resp.error) {
          data = resp.data;
          upsertError = null;
          break;
        }
        upsertError = resp.error || new Error('Unknown upsert error');
        console.warn(`Supabase invite user attempt ${attempt} error:`, upsertError);
      } catch (e) {
        upsertError = e;
        console.warn(`Supabase invite user attempt ${attempt} threw:`, e?.message || e);
      }
      // small backoff
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }

    if (!data && upsertError) {
      console.warn('Supabase invite user final error:', upsertError);
      // do NOT fail the whole request — continue to send invite email and return the error info
    }

    // Also update local Mongo mapping if a local user exists; do not create Mongo user here.
    try {
      const up = data && data[0] ? data[0] : null;
      if (up && up.id) {
        await User.findOneAndUpdate({ supabaseId: up.id }, { role: r }, { upsert: false });
      }
    } catch (e) {
      console.warn('Local user invite mapping failed:', e?.message || e);
    }

    // Attempt to send invite email (if mailer configured). Include inviter name when possible.
    let emailResult = null;
    let emailError = null;
    try {
      const inviterName = (async () => {
        try {
          if (!req.userId) return null;
          const inv = await client.from('users').select('name').eq('id', req.userId).maybeSingle();
          return inv && inv.data ? inv.data.name : null;
        } catch (e) {
          return null;
        }
      })();
      const resolvedName = await inviterName;
      emailResult = await mailer.sendInviteEmail({ to: String(email).toLowerCase(), name: name || null, role: r, inviteerName: resolvedName });
      if (!emailResult.ok) {
        console.warn('Invite email not sent:', emailResult.reason);
        emailError = emailResult.reason || String(emailResult);
      }
    } catch (e) {
      console.warn('Invite email sending failed:', e?.message || e);
      emailError = e?.message || String(e);
    }

    // Include any email delivery error in response so UI can surface it.
    const responseBody = { user: (data && data[0]) ? data[0] : null, emailSent: !!(emailResult && emailResult.ok) };
    if (emailError) responseBody.emailError = emailError;
    res.status(201).json(responseBody);
  } catch (e) {
    next(e);
  }
}

module.exports.invite = invite;
