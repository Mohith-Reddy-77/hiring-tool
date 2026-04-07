const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');
const supaSvc = require('./supabase');
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_ROOT)) {
    fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
  }
}

/**
 * Persists a file buffer to local storage. Returns a relative path suitable for DB storage.
 * Swap this implementation later for Supabase (upload blob, return public URL or path key).
 */
function uploadFile(file) {
  ensureUploadDir();
  if (!file || !file.buffer) {
    throw new Error('Invalid file');
  }
  const ext = path.extname(file.originalname || '') || '';
  const unique = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;

  // If a Supabase service client is configured, upload to the 'resumes' bucket
  const client = supaSvc.getClient && supaSvc.getClient();
  if (client) {
    const bucketPath = unique;
    try {
      // supabase-js accepts Buffer in Node
      // upload returns { data, error }
      const res = client.storage.from('resumes').upload(bucketPath, file.buffer, {
        contentType: file.mimetype || 'application/octet-stream',
        upsert: false,
      });
      // res may be a promise; ensure resolution
      return Promise.resolve(res).then(({ data, error }) => {
        if (error) {
          // fallback to local file if upload fails
          console.warn('Supabase upload failed, falling back to local storage:', error.message || error);
          const dest = path.join(UPLOAD_ROOT, unique);
          fs.writeFileSync(dest, file.buffer);
          return path.join('uploads', unique).replace(/\\/g, '/');
        }
        // store only the path within the bucket for DB (consistent with seeder)
        return data?.path || bucketPath;
      });
    } catch (e) {
      console.warn('Supabase upload unexpected error, falling back to local:', e?.message || e);
      const dest = path.join(UPLOAD_ROOT, unique);
      fs.writeFileSync(dest, file.buffer);
      return path.join('uploads', unique).replace(/\\/g, '/');
    }
  }

  const dest = path.join(UPLOAD_ROOT, unique);
  fs.writeFileSync(dest, file.buffer);
  return path.join('uploads', unique).replace(/\\/g, '/');
}

/**
 * Resolves a stored path to a URL the client can use to fetch the file.
 * For local dev, this is /files/<relativePath under uploads/>.
 */
function getFileUrl(storedPath) {
  if (!storedPath) return null;
  const normalized = String(storedPath).replace(/\\/g, '/');
  const base = process.env.PUBLIC_FILE_BASE || '';
  if (base) {
    return `${base.replace(/\/$/, '')}/${normalized.replace(/^uploads\//, '')}`;
  }
  // If storedPath looks like a Supabase bucket path (no uploads/ prefix) and SUPABASE_URL is set,
  // return the public object URL for the 'resumes' bucket. Otherwise, return local /files/ URL.
  if (!normalized.startsWith('uploads/') && SUPABASE_URL) {
    return `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/resumes/${normalized.replace(/^resumes\//, '')}`;
  }
  return `/files/${normalized.replace(/^uploads\//, '')}`;
}

module.exports = {
  uploadFile,
  getFileUrl,
  UPLOAD_ROOT,
};
