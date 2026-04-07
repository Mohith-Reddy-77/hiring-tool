const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
console.log('Loaded .env from', path.join(__dirname, '..', '.env'));
console.log('PWD:', process.cwd());
console.log('SUPABASE_SERVICE_ROLE_KEY=', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('SUPABASE_SERVICE_ROLE_KEY_VALUE=', process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.slice(0,20) + '...' : null);
console.log('MONGODB_URI=', !!process.env.MONGODB_URI);
console.log('MONGODB_URI_VALUE=', process.env.MONGODB_URI || null);
console.log('SUPABASE_URL=', process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
