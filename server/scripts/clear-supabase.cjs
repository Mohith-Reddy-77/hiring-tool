const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server/.env');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    console.log('Deleting feedback rows...');
    let del = await supabase.from('feedback').delete().not('id', 'is', null).throwOnError();
    console.log('feedback delete result:', del && del.data ? del.data.length : 'ok');

    console.log('Deleting interview_rounds rows...');
    del = await supabase.from('interview_rounds').delete().not('id', 'is', null).throwOnError();
    console.log('interview_rounds delete result:', del && del.data ? del.data.length : 'ok');

    console.log('Deleting candidates rows...');
    del = await supabase.from('candidates').delete().not('id', 'is', null).throwOnError();
    console.log('candidates delete result:', del && del.data ? del.data.length : 'ok');

    console.log('Deleting templates rows...');
    del = await supabase.from('templates').delete().not('id', 'is', null).throwOnError();
    console.log('templates delete result:', del && del.data ? del.data.length : 'ok');

    console.log('Deleting users rows...');
    del = await supabase.from('users').delete().not('id', 'is', null).throwOnError();
    console.log('users delete result:', del && del.data ? del.data.length : 'ok');

    // `todos` table removed; skipping todos deletion

    // Delete storage objects in 'resumes' bucket
    try {
      console.log('Listing objects in resumes bucket...');
      const bucket = 'resumes';
      let toRemove = [];
      let offset = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase.storage.from(bucket).list('', { limit: pageSize, offset });
        if (error) {
          if (error.message && error.message.includes('The resource was not found')) {
            console.log('Bucket not found or empty:', bucket);
            break;
          }
          throw error;
        }
        if (!data || data.length === 0) break;
        toRemove.push(...data.map((d) => (d.name ? d.name : d.id)));
        if (data.length < pageSize) break;
        offset += data.length;
      }
      if (toRemove.length > 0) {
        console.log('Removing', toRemove.length, 'objects from', bucket);
        // remove in batches of 100
        for (let i = 0; i < toRemove.length; i += 100) {
          const batch = toRemove.slice(i, i + 100);
          const { error } = await supabase.storage.from(bucket).remove(batch);
          if (error) console.warn('Error removing batch:', error);
        }
      } else {
        console.log('No objects to remove in bucket', bucket);
      }
    } catch (e) {
      console.warn('Storage cleanup failed:', e.message || e);
    }

    console.log('Supabase cleanup complete.');
  } catch (err) {
    console.error('Error while clearing Supabase tables:', err.message || err);
    process.exit(2);
  }
}

main();
