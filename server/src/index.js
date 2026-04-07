const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const { connectDb } = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const candidateRoutes = require('./routes/candidateRoutes');
const templateRoutes = require('./routes/templateRoutes');
const roundRoutes = require('./routes/roundRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const userRoutes = require('./routes/userRoutes');
const app = express();
const PORT = Number(process.env.PORT) || 5001;

const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: clientUrl,
    credentials: true,
  })
);
app.use(express.json());

const uploadsDir = path.join(__dirname, '..', 'uploads');
// Serve file requests: prefer local uploads, otherwise proxy/redirect to Supabase storage
app.get('/files/:file(*)', async (req, res, next) => {
  try {
    const fileKey = req.params.file;
    const localPath = path.join(uploadsDir, fileKey);
    if (fs.existsSync(localPath)) {
      return res.sendFile(localPath);
    }
    // If Supabase is configured, try to generate a signed URL then redirect
    const supa = require('./services/supabase');
    const client = supa.getClient && supa.getClient();
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    if (client && SUPABASE_URL) {
      try {
        // Attempt signed URL for private buckets (expires in 60s)
        const { data, error } = await client.storage.from('resumes').createSignedUrl(fileKey, 60);
        if (!error && data && data.signedUrl) {
          return res.redirect(data.signedUrl);
        }
      } catch (e) {
        console.warn('Signed URL generation failed:', e?.message || e);
      }
      // Fallback to public storage URL
      const publicUrl = `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/resumes/${encodeURIComponent(fileKey)}`;
      return res.redirect(publicUrl);
    }
    return res.status(404).send('File not found');
  } catch (e) {
    next(e);
  }
});

app.use('/files', express.static(uploadsDir));

app.use('/api/auth', authRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/rounds', roundRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/users', userRoutes);

// Health check and root route
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Root redirect: redirect to the client app (set via CLIENT_URL env)
app.get('/', (req, res) => {
  const redirectTo = process.env.CLIENT_URL || 'https://example.com';
  return res.redirect(redirectTo);
});
app.use((err, req, res, next) => {
  if (err.name === 'MulterError') {
    return res.status(400).json({ message: err.message || 'File upload error' });
  }
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

async function start() {
  if (!process.env.JWT_SECRET) {
    console.warn('Warning: JWT_SECRET is not set. Set it in .env for production.');
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SERVICE_ROLE_KEY) {
    console.warn('Supabase service role key not found in environment. Server-side sync to Supabase will be disabled.');
  } else {
    console.log('Supabase service role key detected; server will attempt to sync to Supabase.');
  }
  await connectDb();
  const server = app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\nPort ${PORT} is already in use.\n` +
          'Fix: set a different PORT in server/.env (e.g. PORT=5002), or stop the other process.\n' +
          `Windows: netstat -ano | findstr :${PORT}\n` +
          'Then: taskkill /PID <pid> /F\n'
      );
    } else {
      console.error(err);
    }
    process.exit(1);
  });
}

start().catch((e) => {
  console.error(e);
  process.exit(1);
});
