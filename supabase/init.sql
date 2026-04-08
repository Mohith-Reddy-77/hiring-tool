-- Supabase / Postgres schema for Hiring Tool
-- Run this in Supabase SQL Editor (recommended) or via psql

-- required extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users (application users; passwords stored as hashes if using Supabase Auth skip storing passwords)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text,
  role text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Candidates
CREATE TABLE IF NOT EXISTS candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  role_applied text NOT NULL,
  resume_path text,
  status text DEFAULT 'APPLIED',
  created_at timestamptz DEFAULT now()
);

-- Add optional owner mapping columns to candidates so we can filter by recruiter
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS created_by_mongo_id text;
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS created_by_supabase_id uuid REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_candidates_created_by_supa ON candidates(created_by_supabase_id);
CREATE INDEX IF NOT EXISTS idx_candidates_created_by_mongo ON candidates(created_by_mongo_id);

-- Templates (feedback templates stored as JSON)
CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  structure jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add optional owner mapping columns to templates so templates can be scoped to recruiters
ALTER TABLE templates ADD COLUMN IF NOT EXISTS created_by_mongo_id text;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS created_by_supabase_id uuid REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_templates_created_by_supa ON templates(created_by_supabase_id);
CREATE INDEX IF NOT EXISTS idx_templates_created_by_mongo ON templates(created_by_mongo_id);

-- Interview rounds
CREATE TABLE IF NOT EXISTS interview_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  interviewer_id uuid NOT NULL REFERENCES users(id),
  template_id uuid NOT NULL REFERENCES templates(id),
  name text NOT NULL,
  status text DEFAULT 'PENDING',
  scheduled_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Feedback (one per round)
CREATE TABLE IF NOT EXISTS feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL UNIQUE REFERENCES interview_rounds(id) ON DELETE CASCADE,
  ratings jsonb NOT NULL,
  notes text,
  submitted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Small example table used by example page
-- Small example table used by example page
-- `todos` table removed: not used in production schema

-- Indexes
CREATE INDEX IF NOT EXISTS idx_interview_rounds_candidate ON interview_rounds(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interview_rounds_interviewer ON interview_rounds(interviewer_id);

-- Add google_id column for OAuth provider mapping
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);

-- Create storage bucket for resumes (public). Requires "storage" extension available in Supabase.
-- If you prefer private storage set the second arg to false.
-- Run this line in the SQL editor or use the Storage API/CLI.
-- SELECT storage.create_bucket('resumes', true);
