#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path = require('path');
const userController = require(path.join(__dirname, '..', 'src', 'controllers', 'userController'));

const email = process.argv[2] || process.env.INVITE_EMAIL;
const name = process.argv[3] || process.env.INVITE_NAME || '';
const role = process.argv[4] || process.env.INVITE_ROLE || 'RECRUITER';

if (!email) {
  console.error('Usage: node scripts/run-invite.js email@example.com "Full Name" ROLE');
  process.exit(1);
}

// Minimal Express-like req/res mocks
const req = { body: { email, name, role }, userId: null };
const res = {
  status(code) {
    this._status = code; return this;
  },
  json(payload) {
    console.log('RESPONSE STATUS:', this._status || 200);
    console.log('RESPONSE PAYLOAD:', JSON.stringify(payload, null, 2));
    return payload;
  }
};

userController.invite(req, res, (err) => {
  console.error('Invite controller threw error:', err);
  process.exit(2);
});
 
