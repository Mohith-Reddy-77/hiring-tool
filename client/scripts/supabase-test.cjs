const fs = require('fs');
const path = require('path');

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
  const { createClient } = require('@supabase/supabase-js');
  const envPath = path.join(__dirname, '..', '.env.local');
  const env = loadEnv(envPath);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY in client/.env.local');
    process.exit(2);
  }

  const supabase = createClient(url, key);

  // `todos` table removed; skipping example query
  console.log('Skipping todos query (table removed)');

  console.log('\nTesting `resumes` bucket listing...');
  try {
    const { data: list, error: listErr } = await supabase.storage.from('resumes').list();
    if (listErr) {
      console.error('resumes list error:', listErr);
    } else {
      console.log('resumes list OK — items:', Array.isArray(list) ? list.length : 0);
      console.log(list);
    }
  } catch (e) {
    console.error('Unexpected storage error:', e?.message || e);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
