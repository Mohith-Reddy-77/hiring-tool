const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const supa = require('./services/supabase');

(async () => {
  try {
    const client = supa.getClient();
    if (!client) {
      console.error('Supabase client not available');
      process.exit(1);
    }
    const { data, error } = await client.from('candidates').select('*').limit(5);
    if (error) {
      console.error('Supabase query error:', error);
      process.exit(1);
    }
    console.log('Candidates rows (up to 5):', data);
  } catch (e) {
    console.error('Unexpected:', e);
    process.exit(1);
  }
})();
