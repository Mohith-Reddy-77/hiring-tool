#!/usr/bin/env node
// Simple test script to send an invite email using server/src/services/mailer.js
const path = require('path');
// Ensure server code can resolve modules
const mailer = require(path.join(__dirname, '..', 'src', 'services', 'mailer'));

const to = process.argv[2] || process.env.TEST_TO;
if (!to) {
  console.error('Usage: node server/scripts/test-mail.js recipient@example.com');
  process.exit(1);
}

(async () => {
  try {
    const name = process.env.TEST_NAME || 'Test Recipient';
    const role = process.env.TEST_ROLE || 'RECRUITER';
    const inviteerName = process.env.TEST_INVITER || 'Admin';
    console.log(`Sending test invite to ${to}...`);
    const res = await mailer.sendInviteEmail({ to, name, role, inviteerName });
    console.log('Result:', res);
    process.exit(res && res.ok ? 0 : 2);
  } catch (e) {
    console.error('Unexpected error:', e);
    process.exit(3);
  }
})();
