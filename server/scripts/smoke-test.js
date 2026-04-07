/**
 * End-to-end smoke test against a running API.
 * Usage: node scripts/smoke-test.js
 * Env:   API_BASE (default http://localhost:5001/api)
 */
const API_BASE = (process.env.API_BASE || 'http://localhost:5001/api').replace(/\/$/, '');

async function jsonReq(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(`${method} ${path} -> ${res.status}: ${text}`);
    err.body = data;
    throw err;
  }
  return data;
}

async function main() {
  const suffix = Date.now().toString(36);
  const recEmail = `rec_${suffix}@test.local`;
  const intEmail = `int_${suffix}@test.local`;
  const candEmail = `cand_${suffix}@test.local`;

  console.log('1. Register recruiter');
  const r1 = await jsonReq('POST', '/auth/register', {
    body: { name: 'Rec', email: recEmail, password: 'testpass123', role: 'RECRUITER' },
  });
  const recToken = r1.token;

  console.log('2. Register interviewer');
  const r2 = await jsonReq('POST', '/auth/register', {
    body: { name: 'Int', email: intEmail, password: 'testpass123', role: 'INTERVIEWER' },
  });
  const intToken = r2.token;
  const intId = r2.user.id;

  console.log('3. Create template');
  const template = await jsonReq('POST', '/templates', {
    token: recToken,
    body: {
      name: 'Round 1 DS',
      structure: {
        fields: [
          { key: 'algo', type: 'rating', label: 'DS/Algo' },
          { key: 'notes', type: 'textarea', label: 'Notes' },
        ],
      },
    },
  });
  const templateId = template._id;

  console.log('4. Create candidate (multipart, no resume)');
  const boundary = `----form${Date.now()}`;
  const parts = [
    `--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\nJane Doe\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="email"\r\n\r\n${candEmail}\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="roleApplied"\r\n\r\nBackend\r\n`,
    `--${boundary}\r\nContent-Disposition: form-data; name="status"\r\n\r\nAPPLIED\r\n`,
    `--${boundary}--\r\n`,
  ].join('');
  const cRes = await fetch(`${API_BASE}/candidates`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${recToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: parts,
  });
  const cText = await cRes.text();
  const candidate = JSON.parse(cText);
  if (!cRes.ok) throw new Error(`POST /candidates -> ${cRes.status}: ${cText}`);
  const candId = candidate._id;

  console.log('5. Create round');
  const round = await jsonReq('POST', '/rounds', {
    token: recToken,
    body: {
      candidateId: candId,
      interviewerId: intId,
      templateId,
      name: 'Round 1',
    },
  });
  const roundId = round._id;

  console.log('6. Interviewer my-rounds');
  const mine = await jsonReq('GET', '/rounds/my-rounds', { token: intToken });
  if (!Array.isArray(mine) || mine.length < 1) throw new Error('Expected >= 1 round for interviewer');

  console.log('7. Submit feedback');
  await jsonReq('POST', '/feedback', {
    token: intToken,
    body: { roundId, ratings: { algo: 5 }, notes: 'Strong problem solving.' },
  });

  console.log('8. Get feedback (recruiter)');
  const fb = await jsonReq('GET', `/rounds/${roundId}/feedback`, { token: recToken });
  if (!fb.ratings) throw new Error('Missing feedback');

  console.log('9. Candidate rounds list includes feedback (recruiter)');
  const roundsList = await jsonReq('GET', `/candidates/${candId}/rounds`, { token: recToken });
  const withFb = roundsList.find((x) => String(x._id) === String(roundId));
  if (!withFb?.feedback?.ratings) throw new Error('Expected round.feedback from candidate rounds API');

  console.log('\nAll smoke checks passed.');
  console.log(`  Candidate: ${candId}`);
  console.log(`  Round: ${roundId}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
