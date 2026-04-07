This folder contains SQL and instructions to create the required database schema and storage bucket in Supabase for the Hiring Tool.

Files:
- `init.sql` — SQL to create tables: `users`, `candidates`, `templates`, `interview_rounds`, `feedback`, `todos`, and indexes. Also includes a commented line to create a `resumes` storage bucket via SQL.

How to run (recommended: Supabase SQL Editor)
1. Open your Supabase project dashboard -> SQL Editor -> New query.
2. Copy the contents of `supabase/init.sql` and run it.

Create storage bucket (two options)
- Option A: SQL (run in SQL Editor)
  ```sql
  SELECT storage.create_bucket('resumes', true);
  ```
  Note: this requires the Supabase `storage` extension which is available in managed projects.

- Option B: REST API (requires `service_role` key)
  ```bash
  SERVICE_ROLE_KEY="<your-service-role-key>"
  SUPABASE_URL="https://pjuxxrvcettkmobciefj.supabase.co"

  curl -X POST "$SUPABASE_URL/storage/v1/buckets" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"name":"resumes","public":true}'
  ```

Notes and permissions
- Admin operations (creating buckets, running arbitrary SQL) require a privileged key (the `service_role` key). Do NOT expose the service_role key in client-side code.
- For authentication and user management consider using Supabase Auth instead of maintaining `users.password_hash` yourself.

Optional: run SQL using psql
1. Get the connection string from Project -> Settings -> Database -> Connection string (use the postgres role and connection string).
2. From your machine with `psql` installed run:
   ```bash
   psql "<connection-string>" -f supabase/init.sql
   ```

If you want I can:
- Attempt to create the bucket automatically using the REST call if you provide the `service_role` key (I will not store it anywhere). OR
- Generate a small Node script that calls Supabase Admin endpoints; you can run it locally after adding your `service_role` key to an env file.
