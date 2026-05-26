-- V17 Agent 架构重构 Phase B - 数据库表
-- 执行顺序: 1. session_timeline, 2. session_summaries, 3. student_profiles

-- =====================================================
-- 1. session_timeline（核心热记忆）
-- 存储当前 session 内所有事件的时间线
-- =====================================================

CREATE TABLE IF NOT EXISTS session_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  project_id uuid DEFAULT NULL,
  created_at timestamptz DEFAULT now(),

  -- 事件类型
  event_type text NOT NULL,
  -- 事件类型包括:
  -- build_complete, prompt_generated, prompt_copied
  -- gate1_round, gate1_complete
  -- gate2_verify
  -- debug_message, debug_complete
  -- game_regenerated

  upgrade_id text,
  lesson_type text,
  role text,  -- 'student' | 'agent' | 'system'
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',

  -- 可见性控制
  visible_to_agent boolean DEFAULT true,
  is_system_marker boolean DEFAULT false,
  display_in_ui boolean DEFAULT true
);

-- 索引：按学生和 session 查询，按时间排序
CREATE INDEX IF NOT EXISTS idx_timeline_student_session
  ON session_timeline(student_id, session_id, created_at);

-- 索引：按 project 查询（可选）
CREATE INDEX IF NOT EXISTS idx_timeline_project
  ON session_timeline(project_id, created_at)
  WHERE project_id IS NOT NULL;

-- RLS 策略（如果需要）
ALTER TABLE session_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can read their own timeline"
  ON session_timeline FOR SELECT
  USING (student_id = auth.uid() OR true);  -- 暂时允许所有读取

CREATE POLICY "Service role can insert timeline"
  ON session_timeline FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update timeline"
  ON session_timeline FOR UPDATE
  USING (true);

-- =====================================================
-- 2. session_summaries（温记忆）
-- 课程结束后压缩的 session 摘要
-- =====================================================

CREATE TABLE IF NOT EXISTS session_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),

  -- 摘要内容
  summary_text text,  -- 人类可读的摘要
  summary_data jsonb  -- 结构化数据
  -- summary_data 结构:
  -- {
  --   lesson_type: string,
  --   upgrade_summaries: [{ upgrade, best_quote, rounds }],
  --   debug_insights: [string],
  --   metrics: { early_releases, total_upgrades, debug_sessions }
  -- }
);

-- 索引：按学生查询，按时间倒序
CREATE INDEX IF NOT EXISTS idx_summaries_student
  ON session_summaries(student_id, created_at DESC);

-- RLS 策略
ALTER TABLE session_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage summaries"
  ON session_summaries FOR ALL
  USING (true);

-- =====================================================
-- 3. student_profiles（冷记忆）
-- 跨 session 的学生能力画像
-- =====================================================

CREATE TABLE IF NOT EXISTS student_profiles (
  student_id uuid PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  updated_at timestamptz DEFAULT now(),

  -- 画像内容
  profile_text text,  -- 人类可读的画像
  profile_data jsonb  -- 结构化数据
  -- profile_data 结构:
  -- {
  --   total_sessions: number,
  --   avg_early_release: number,
  --   debug_frequency: number,
  --   lesson_history: [string],
  --   strengths: [string],
  --   areas_to_improve: [string]
  -- }
);

-- RLS 策略
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage profiles"
  ON student_profiles FOR ALL
  USING (true);

-- =====================================================
-- 辅助函数：自动更新 updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_student_profiles_updated_at
  BEFORE UPDATE ON student_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 验证查询（执行后检查）
-- =====================================================

-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('session_timeline', 'session_summaries', 'student_profiles');
