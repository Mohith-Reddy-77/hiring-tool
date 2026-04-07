Deployment guide — Vercel frontend + Fly.io backend

Overview
- Frontend: deploy `client` to Vercel (static site from Vite).
- Backend: deploy `server` to Fly.io as a long-running container.

Backend (Fly.io)
1. Install Fly CLI: https://fly.io/docs/getting-started/install/
2. Login: `flyctl auth login`
3. From `server` folder, create app:
   ```bash
   cd server
   flyctl launch --name your-app-name --no-deploy
   ```
   Replace `your-app-name` with a unique name.
4. Provision secrets (do NOT commit):
   ```bash
   flyctl secrets set MONGODB_URI="<your-mongo-uri>" JWT_SECRET="<jwt>" \
     SUPABASE_URL="<supabase-url>" SUPABASE_SERVICE_ROLE_KEY="<service-role>"
   ```
5. Deploy:
   ```bash
   flyctl deploy
   ```
6. Check logs:
   ```bash
   flyctl logs -a your-app-name
   ```

Frontend (Vercel)
1. Create a Vercel account and connect your Git repository.
2. In Vercel dashboard, import the `client` project or point to the repo root and set the `client` directory as project root.
3. Build settings:
   - Framework: Other (Vite)
   - Build command: `npm run build`
   - Output directory: `dist`
4. Set environment variables (Vercel -> Project Settings -> Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
   - `VITE_API_URL` (or set `CLIENT_URL` in backend to this Vercel URL)
5. Deploy via Vercel; it will provide a URL (e.g. `https://your-app.vercel.app`).

DNS / Domains
- Point your domain root to Vercel for frontend, and `api.yourdomain.com` CNAME to Fly app.
- Update `CLIENT_URL` env on the backend to the frontend's URL, and `SUPABASE` keys in Vercel.

Notes
- Keep `SUPABASE_SERVICE_ROLE_KEY` only in server-side secrets (Fly secrets).
- If using Mongo, use a managed Mongo (MongoDB Atlas) and set `MONGODB_URI`.
- For local testing before deploy, ensure `MONGODB_URI` is set or the server will skip DB connect (dev mode).
