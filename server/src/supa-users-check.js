const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const supa = require('./services/supabase');
(async () => {
  const client = supa.getClient();
  if (!client) {
    console.error('Supabase client not available');
    process.exit(1);
  }
  const { data, error } = await client.from('users').select('*').order('created_at', { ascending: false }).limit(10);
  if (error) {
    console.error('Supabase users query error:', error);
    process.exit(1);
  }
  console.log('Recent Supabase users:', data);
  process.exit(0);
})();
