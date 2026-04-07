const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const supa = require('./services/supabase');

(async () => {
  const client = supa.getClient();
  if (!client) {
    console.error('Supabase client not available');
    process.exit(1);
  }
  // Template
  const { randomUUID } = require('crypto');
  const templateId = randomUUID();
  const template = { _id: templateId, name: 'T1', structure: { fields: [] }, createdAt: new Date() };
  console.log('Inserting template...');
  const t = await supa.insertTemplate(template);
  console.log('Template result:', t && t.length ? t[0] : t);

  // Candidate (must exist before round due to FK)
  console.log('Inserting candidate...');
  const candidateId = randomUUID();
  const candidate = { _id: candidateId, name: 'Supa Candidate', email: `supa-${Date.now()}@example.com`, roleApplied: 'Engineer', status: 'APPLIED', createdAt: new Date() };
  const c = await supa.insertCandidate(candidate);
  console.log('Candidate result:', c && c.length ? c[0] : c);

  // Round
  const roundId = randomUUID();
  const interviewerId = randomUUID();
  const round = { _id: roundId, candidateId, interviewerId, templateId, name: 'Phone Screen', status: 'SCHEDULED', scheduledAt: new Date(), createdAt: new Date() };
  // Ensure interviewer user exists
  console.log('Upserting interviewer user...');
  const { data: udata, error: uerr } = await client.from('users').upsert({ id: interviewerId, email: `int-${Date.now()}@example.com`, name: 'Interviewer Test', role: 'INTERVIEWER' }).select();
  if (uerr) console.warn('User upsert error:', uerr);
  else console.log('Interviewer upserted:', udata && udata[0]);
  console.log('Inserting round...');
  const r = await supa.insertRound(round);
  console.log('Round result:', r && r.length ? r[0] : r);

  // Feedback
  const feedback = { _id: randomUUID(), roundId: roundId, ratings: { overall: 4 }, notes: 'Looks good', submittedAt: new Date(), createdAt: new Date() };
  console.log('Inserting feedback...');
  const f = await supa.insertFeedback(feedback);
  console.log('Feedback result:', f && f.length ? f[0] : f);

  process.exit(0);
})();
