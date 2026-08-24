-- ==============================================================================
-- SMART INDIA HACKATHON (SIH 2026) PRODUCTION DATABASE SCHEMA & SECURITY POLICIES
-- Target Platform: Supabase PostgreSQL
-- Features: Auth Sync, RLS Policies, Atomic Member Rules (RPC), Audit Logging, Private Storage
-- ==============================================================================

-- 1. EXTENSIONS & TYPES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('STUDENT', 'SPOC_ADMIN');
CREATE TYPE submission_status_type AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'VALID',
  'INVALID',
  'NEEDS_CORRECTION'
);
CREATE TYPE gender_type AS ENUM ('Male', 'Female', 'Other');

-- 2. USER PROFILES TABLE (Extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'STUDENT',
  full_name TEXT NOT NULL,
  college_name TEXT NOT NULL DEFAULT 'SIH Host College',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TEAMS TABLE
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_name TEXT NOT NULL UNIQUE,
  problem_statement_id TEXT NOT NULL,
  problem_statement_title TEXT NOT NULL,
  problem_statement_description TEXT,
  solution_title TEXT NOT NULL,
  solution_description TEXT NOT NULL,
  team_lead_user_id UUID UNIQUE NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  submission_status submission_status_type NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. TEAM MEMBERS TABLE (Exactly 6 required, 1 female mandatory)
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  roll_number TEXT NOT NULL,
  email TEXT NOT NULL,
  mobile TEXT NOT NULL,
  gender gender_type NOT NULL,
  branch TEXT NOT NULL,
  year TEXT NOT NULL,
  faculty TEXT DEFAULT 'Faculty of Engineering',
  is_team_lead BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_team_member_email UNIQUE (email),
  CONSTRAINT unique_team_member_roll UNIQUE (roll_number)
);

-- Ensure faculty column exists on existing deployments
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS faculty TEXT DEFAULT 'Faculty of Engineering';

-- 5. SUBMISSIONS TABLE (PPT/PDF Details & Validation Results)
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  detected_slide_count INT NOT NULL DEFAULT 0,
  validation_status submission_status_type NOT NULL DEFAULT 'SUBMITTED',
  validation_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  admin_remarks TEXT DEFAULT '',
  version_number INT NOT NULL DEFAULT 1,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.user_profiles(id)
);

-- 6. SUBMISSION HISTORY TABLE (Preserves versions on replacement)
CREATE TABLE IF NOT EXISTS public.submission_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  detected_slide_count INT NOT NULL,
  validation_status submission_status_type NOT NULL,
  validation_issues JSONB NOT NULL,
  admin_remarks TEXT,
  version_number INT NOT NULL,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  performed_by UUID REFERENCES public.user_profiles(id),
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_teams_lead ON public.teams(team_lead_user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_submissions_team ON public.submissions(team_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- 9. ROW LEVEL SECURITY (RLS) POLICIES

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper Function to check if caller is SPOC Admin
CREATE OR REPLACE FUNCTION public.is_spoc_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'SPOC_ADMIN'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- User Profiles Policies
CREATE POLICY "Users can read own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id OR public.is_spoc_admin());

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Teams Policies
CREATE POLICY "Student read own team / Admin read all" ON public.teams
  FOR SELECT USING (team_lead_user_id = auth.uid() OR public.is_spoc_admin());

CREATE POLICY "Student update own team / Admin update all" ON public.teams
  FOR UPDATE USING (team_lead_user_id = auth.uid() OR public.is_spoc_admin());

CREATE POLICY "Student insert own team" ON public.teams
  FOR INSERT WITH CHECK (team_lead_user_id = auth.uid());

-- Team Members Policies
CREATE POLICY "Read team members if team owner or admin" ON public.team_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_members.team_id AND (t.team_lead_user_id = auth.uid() OR public.is_spoc_admin())
    )
  );

-- Submissions Policies
CREATE POLICY "Read submission if team owner or admin" ON public.submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = submissions.team_id AND (t.team_lead_user_id = auth.uid() OR public.is_spoc_admin())
    )
  );

-- Admin Audit Log Policy
CREATE POLICY "Admin full access to audit logs" ON public.audit_logs
  FOR ALL USING (public.is_spoc_admin());

-- 10. ATOMIC RPC FUNCTION: SAVE TEAM & 6 MEMBERS (WITH FEMALE MEMBER VALIDATION)
CREATE OR REPLACE FUNCTION public.save_team_with_members(
  p_team_name TEXT,
  p_ps_id TEXT,
  p_ps_title TEXT,
  p_ps_desc TEXT,
  p_sol_title TEXT,
  p_sol_desc TEXT,
  p_members JSONB
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_team_id UUID;
  v_member_count INT;
  v_female_count INT;
  m RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized. User must be logged in.';
  END IF;

  -- 1. Enforce Member Count = 6
  v_member_count := jsonb_array_length(p_members);
  IF v_member_count <> 6 THEN
    RAISE EXCEPTION 'Validation Error: A team must have exactly 6 members. (Provided: %)', v_member_count;
  END IF;

  -- 2. Enforce At least 1 Female Member
  SELECT COUNT(*) INTO v_female_count
  FROM jsonb_to_recordset(p_members) AS x(gender TEXT)
  WHERE LOWER(x.gender) = 'female';

  IF v_female_count < 1 THEN
    RAISE EXCEPTION 'Validation Error: At least one female team member is mandatory as per SIH team requirements.';
  END IF;

  -- 3. Upsert Team Record
  SELECT id INTO v_team_id FROM public.teams WHERE team_lead_user_id = v_user_id;

  IF v_team_id IS NULL THEN
    INSERT INTO public.teams (
      team_name, problem_statement_id, problem_statement_title,
      problem_statement_description, solution_title, solution_description, team_lead_user_id
    ) VALUES (
      p_team_name, p_ps_id, p_ps_title, p_ps_desc, p_sol_title, p_sol_desc, v_user_id
    ) RETURNING id INTO v_team_id;
  ELSE
    UPDATE public.teams SET
      team_name = p_team_name,
      problem_statement_id = p_ps_id,
      problem_statement_title = p_ps_title,
      problem_statement_description = p_ps_desc,
      solution_title = p_sol_title,
      solution_description = p_sol_desc,
      updated_at = NOW()
    WHERE id = v_team_id;

    -- Delete old members for atomic refresh
    DELETE FROM public.team_members WHERE team_id = v_team_id;
  END IF;

  -- 4. Insert Team Members
  FOR m IN SELECT * FROM jsonb_to_recordset(p_members) AS x(
    name TEXT, roll_number TEXT, email TEXT, mobile TEXT,
    gender gender_type, branch TEXT, year TEXT, is_team_lead BOOLEAN
  ) LOOP
    INSERT INTO public.team_members (
      team_id, name, roll_number, email, mobile, gender, branch, year, is_team_lead
    ) VALUES (
      v_team_id, m.name, m.roll_number, m.email, m.mobile, m.gender, m.branch, m.year, COALESCE(m.is_team_lead, false)
    );
  END LOOP;

  RETURN v_team_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. RPC FUNCTION: SPOC ADMIN REVIEW SUBMISSION
CREATE OR REPLACE FUNCTION public.review_submission(
  p_submission_id UUID,
  p_status submission_status_type,
  p_remarks TEXT
)
RETURNS VOID AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_team_id UUID;
  v_old_status submission_status_type;
  v_old_remarks TEXT;
BEGIN
  IF NOT public.is_spoc_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only SPOC Admin can review submissions.';
  END IF;

  SELECT team_id, validation_status, admin_remarks INTO v_team_id, v_old_status, v_old_remarks
  FROM public.submissions WHERE id = p_submission_id;

  -- Update Submission Status & Remarks
  UPDATE public.submissions SET
    validation_status = p_status,
    admin_remarks = p_remarks,
    reviewed_at = NOW(),
    reviewed_by = v_admin_id
  WHERE id = p_submission_id;

  -- Update Team Submission Status
  UPDATE public.teams SET
    submission_status = p_status,
    updated_at = NOW()
  WHERE id = v_team_id;

  -- Audit Log
  INSERT INTO public.audit_logs (entity_type, entity_id, action, performed_by, old_value, new_value)
  VALUES (
    'submission',
    p_submission_id,
    'ADMIN_REVIEW',
    v_admin_id,
    jsonb_build_object('status', v_old_status, 'remarks', v_old_remarks),
    jsonb_build_object('status', p_status, 'remarks', p_remarks)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. STORAGE BUCKET & RLS POLICIES FOR PRIVATE FILE UPLOAD
INSERT INTO storage.buckets (id, name, public)
VALUES ('sih-submissions', 'sih-submissions', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Read Policy (Team lead or Admin)
CREATE POLICY "Read SIH Submissions" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'sih-submissions' AND (
      public.is_spoc_admin() OR
      (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)
    )
  );

-- Storage Write Policy (Team lead upload)
CREATE POLICY "Upload SIH Submissions" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'sih-submissions' AND
    auth.uid() IS NOT NULL AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 13. GRANT PERMISSIONS TO ANON & AUTHENTICATED ROLES
GRANT ALL ON TABLE public.user_profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.teams TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.team_members TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.submissions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.submission_history TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.audit_logs TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 14. SPOC ADMIN INITIAL SEED INSTRUCTIONS
-- To create the initial SPOC Admin account:
-- 1. Create user in Supabase Auth Dashboard or SQL:
--    Email: rpkumar2024@chaitanya.edu.in
--    Password: SIH@2026
-- 2. Elevate role in public.user_profiles to 'SPOC_ADMIN':
--    UPDATE public.user_profiles SET role = 'SPOC_ADMIN' WHERE email = 'rpkumar2024@chaitanya.edu.in';
