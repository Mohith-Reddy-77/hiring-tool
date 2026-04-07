const fs = require('fs');
const path = require('path');
const fetch = global.fetch;

async function run() {
  const base = `http://localhost:${process.env.PORT || 5002}`;
  // Register a temp recruiter
  const regRes = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'E2E Recruiter', email: `e2e+${Date.now()}@example.com`, password: 'password', role: 'RECRUITER' }),
  });
  const reg = await regRes.json();
  if (!reg.token) {
    console.error('Register failed', reg);
    process.exit(1);
  }
  const token = reg.token;
  console.log('Registered recruiter, token present');

  // Server will upsert user into Supabase during registration when configured.

  // Prepare multipart form
  const form = new FormData();
  form.append('name', 'E2E Candidate');
  form.append('email', `e2e-candidate+${Date.now()}@example.com`);
  form.append('roleApplied', 'Backend');
  const resumePath = path.join(__dirname, '..', '..', 'client', 'scripts', 'sample_resume.txt');
  if (fs.existsSync(resumePath)) {
    const file = fs.readFileSync(resumePath);
    form.append('resume', new Blob([file]), 'sample_resume.txt');
  }

  const res = await fetch(`${base}/api/candidates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json();
  console.log('Create candidate response:', res.status, data);
}

run().catch((e) => { console.error(e); process.exit(1); });
