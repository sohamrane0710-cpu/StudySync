-- Compatibility shim for local PostgreSQL (Supabase provides 'authenticated' role and 'auth.uid()' natively)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
  SELECT NULL::uuid;
$$ LANGUAGE sql STABLE;

-- Partial unique index for one active personal timer per user
CREATE UNIQUE INDEX idx_timer_sessions_one_active 
ON timer_sessions (user_id) 
WHERE status IN ('RUNNING', 'PAUSED');

-- Partial unique index for active room timer
CREATE UNIQUE INDEX idx_room_study_sessions_one_active 
ON room_study_sessions (room_id) 
WHERE status IN ('RUNNING', 'PAUSED');

-- Case-insensitive lowercase username index
CREATE UNIQUE INDEX idx_profiles_username_lower 
ON profiles (LOWER(username));

-- Database CHECK constraints for domains
ALTER TABLE timer_modes 
  ADD CONSTRAINT check_focus_duration CHECK (focus_duration > 0),
  ADD CONSTRAINT check_short_break CHECK (short_break_duration > 0),
  ADD CONSTRAINT check_long_break CHECK (long_break_duration > 0),
  ADD CONSTRAINT check_long_interval CHECK (long_break_interval >= 1);

ALTER TABLE user_preferences 
  ADD CONSTRAINT check_sound_volume CHECK (sound_volume >= 0.0 AND sound_volume <= 1.0);

ALTER TABLE timer_sessions
  ADD CONSTRAINT check_timer_session_durations CHECK (target_duration > 0 AND remaining_seconds >= 0);

ALTER TABLE study_sessions
  ADD CONSTRAINT check_study_session_durations CHECK (target_duration >= 0 AND actual_duration >= 0),
  ADD CONSTRAINT check_study_session_timestamps CHECK (ended_at >= started_at);

ALTER TABLE rooms 
  ADD CONSTRAINT check_max_participants CHECK (max_participants > 0);

ALTER TABLE room_invites 
  ADD CONSTRAINT check_uses_count CHECK (uses_count >= 0),
  ADD CONSTRAINT check_max_uses CHECK (max_uses IS NULL OR max_uses > 0);

ALTER TABLE room_study_session_participants 
  ADD CONSTRAINT check_credited_seconds CHECK (credited_seconds >= 0);

-- Row Level Security (RLS) Foundations for Supabase deployment
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE timer_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE timer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_session_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_session_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_study_session_participants ENABLE ROW LEVEL SECURITY;

-- Canonical RLS policies evaluated when clients query through Supabase directly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Public profiles viewable by authenticated'
  ) THEN
    CREATE POLICY "Public profiles viewable by authenticated" ON profiles 
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_preferences' AND policyname = 'Users own their preferences'
  ) THEN
    CREATE POLICY "Users own their preferences" ON user_preferences 
      FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'timer_sessions' AND policyname = 'Users own their timer sessions'
  ) THEN
    CREATE POLICY "Users own their timer sessions" ON timer_sessions 
      FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'study_sessions' AND policyname = 'Users own their study sessions'
  ) THEN
    CREATE POLICY "Users own their study sessions" ON study_sessions 
      FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'session_categories' AND policyname = 'Users own their categories'
  ) THEN
    CREATE POLICY "Users own their categories" ON session_categories 
      FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'session_labels' AND policyname = 'Users own their labels'
  ) THEN
    CREATE POLICY "Users own their labels" ON session_labels 
      FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;