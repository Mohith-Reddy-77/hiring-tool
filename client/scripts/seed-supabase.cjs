const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const raw = fs.readFileSync(envPath, 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    out[key] = val;
  }
  return out;
}

async function main() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const env = loadEnv(envPath);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY in client/.env.local');
    process.exit(2);
  }

  const supabase = createClient(url, key);

  console.log('Seeding sample data...');

  // 1) insert users (recruiter and interviewer)
  const users = [
    { name: 'Alice Recruiter', email: 'alice.recruiter@example.com', role: 'RECRUITER' },
    { name: 'Bob Interviewer', email: 'bob.interviewer@example.com', role: 'INTERVIEWER' },
  ];
  const { data: usersData, error: usersErr } = await supabase.from('users').insert(users).select();
  if (usersErr) {
    console.error('users insert error:', usersErr);
  } else {
    console.log('Inserted users:', usersData);
  }

  // 2) insert a candidate
  const candidatePayload = {
    name: 'Jane Doe',
    email: 'jane.doe@example.com',
    role_applied: 'Backend Engineer',
    status: 'APPLIED',
  };
  const { data: candidateData, error: candidateErr } = await supabase.from('candidates').insert(candidatePayload).select();
  if (candidateErr) {
    console.error('candidate insert error:', candidateErr);
  } else {
    console.log('Inserted candidate:', candidateData);
  }

  // 3) upload resume file to `resumes` bucket
  const resumePath = path.join(__dirname, 'sample_resume.txt');
  const resumeBuffer = fs.readFileSync(resumePath);
  const filename = `jane_doe_resume_${Date.now()}.txt`;
  try {
    const { data: uploadData, error: uploadErr } = await supabase.storage.from('resumes').upload(filename, resumeBuffer, {
      contentType: 'text/plain',
      upsert: false,
    });
    if (uploadErr) {
      console.error('upload error:', uploadErr);
    } else {
      console.log('Uploaded resume:', uploadData);
      // update candidate.resume_path
      const resume_db_path = uploadData?.path || `resumes/${filename}`;
      if (candidateData && candidateData[0] && resume_db_path) {
        const { data: upd, error: updErr } = await supabase
          .from('candidates')
          .update({ resume_path: resume_db_path })
          .eq('id', candidateData[0].id)
          .select();
        if (updErr) console.error('candidate update resume error:', updErr);
        else console.log('Updated candidate with resume path:', upd);
      }
    }
  } catch (e) {
    console.error('Unexpected upload error:', e?.message || e);
  }

  // 4) create a template
  const template = {
    name: 'Round 1 - Backend',
    structure: { fields: [ { key: 'ds', type: 'rating', label: 'Data Structures' }, { key: 'system', type: 'rating', label: 'System Design' }, { key: 'notes', type: 'textarea', label: 'Notes' } ] }
  };
  const { data: templateData, error: templateErr } = await supabase.from('templates').insert(template).select();
  if (templateErr) console.error('template insert error:', templateErr);
  else console.log('Inserted template:', templateData);

  // 5) create an interview round linking candidate -> interviewer -> template
  if (candidateData && candidateData[0] && usersData && usersData.length > 1 && templateData && templateData[0]) {
    const candidateId = candidateData[0].id;
    const interviewerId = usersData.find((u) => u.role === 'INTERVIEWER')?.id || usersData[1].id;
    const templateId = templateData[0].id;
    const round = { candidate_id: candidateId, interviewer_id: interviewerId, template_id: templateId, name: 'Initial technical screen' };
    const { data: roundData, error: roundErr } = await supabase.from('interview_rounds').insert(round).select();
    if (roundErr) console.error('round insert error:', roundErr);
    else console.log('Inserted round:', roundData);
  }

  console.log('Seeding complete');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
