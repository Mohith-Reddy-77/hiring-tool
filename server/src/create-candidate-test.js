const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function run() {
  const url = `http://localhost:${process.env.PORT || 5002}/api/candidates`;
  const body = { name: 'Sync Test', email: `synctest+${Date.now()}@example.com`, roleApplied: 'QA' };
  console.log('Posting to', url, body);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log('Server response:', res.status, data);
}

run().catch((e) => { console.error(e); process.exit(1); });
