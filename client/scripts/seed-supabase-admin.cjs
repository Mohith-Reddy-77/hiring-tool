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
  const env = loadEnv(path.join(__dirname, '..', '.env.local'));
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  // service role key is sensitive; prefer passing via environment variable SERVICE_ROLE_KEY
  const serviceRoleKey = process.env.SERVICE_ROLE_KEY || env.SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error('Missing SUPABASE URL or service role key. Provide SERVICE_ROLE_KEY env or add SERVICE_ROLE_KEY to client/.env.local');
    process.exit(2);
  }

  const supabase = createClient(url, serviceRoleKey);

  // find candidate
  const { data: candidates } = await supabase.from('candidates').select('*').limit(1);
  if (!candidates || candidates.length === 0) {
    console.error('No candidate found; run seed-supabase.cjs first to insert candidate.');
    process.exit(1);
  }
  const candidate = candidates[0];

  // upload file
  const resumePath = path.join(__dirname, 'sample_resume.txt');
  const buffer = fs.readFileSync(resumePath);
  const filename = `jane_doe_resume_${Date.now()}.txt`;
  console.log('Uploading', filename);
  const { data: uploadData, error: uploadErr } = await supabase.storage.from('resumes').upload(filename, buffer, {
    contentType: 'text/plain',
    upsert: false,
  });
  if (uploadErr) {
    console.error('Upload failed:', uploadErr);
    process.exit(1);
  }
  console.log('Uploaded:', uploadData);

  // update candidate
  const resume_db_path = uploadData?.path || `resumes/${filename}`;
  const { data: upd, error: updErr } = await supabase.from('candidates').update({ resume_path: resume_db_path }).eq('id', candidate.id).select();
  if (updErr) {
    console.error('Failed to update candidate:', updErr);
    process.exit(1);
  }
  console.log('Candidate updated:', upd);
}

main().then(()=>process.exit(0)).catch((e)=>{console.error(e);process.exit(1);});
