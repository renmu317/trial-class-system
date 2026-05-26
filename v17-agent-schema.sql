-- V17 Agent Schema
-- 认知对抗 Agent 数据表

-- ============================================
-- 1. sessions 表新增 scheduled_end_at 列
-- ============================================
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS scheduled_end_at timestamptz;

-- ============================================
-- 2. agent_sessions 表（完整 schema）
-- ============================================
CREATE TABLE IF NOT EXISTS agent_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),

  -- 扩展端口2：课程类型
  lesson_type text,

  -- Upgrade 信息
  upgrade_sequence int NOT NULL,
  target_upgrade_id text NOT NULL,
  target_upgrade_label text,
  upgrade_difficulty text,
  language_dimensions_total int,
  language_dimensions_covered int DEFAULT 0,

  -- Gate 1 状态
  gate1_completed boolean DEFAULT false,
  actual_rounds int,
  early_release boolean DEFAULT false,

  -- Round 1
  round_1_input text,
  round_1_mode text,
  round_1_score_specificity int,
  round_1_score_causality int,
  round_1_score_autonomy int,
  round_1_total int,

  -- Round 2
  round_2_input text,
  round_2_mode text,
  round_2_score_specificity int,
  round_2_score_causality int,
  round_2_score_autonomy int,
  round_2_total int,

  -- Round 3
  round_3_input text,
  round_3_mode text,
  round_3_score_specificity int,
  round_3_score_causality int,
  round_3_score_autonomy int,
  round_3_total int,

  -- Gate 2 字段
  upgrade_appeared boolean,
  upgrade_matched boolean,    -- Hard专用：描述是否匹配游戏结果
  mismatch_detail text,       -- Hard专用：不匹配时的具体差异描述
  student_attributed boolean,
  gate2_failure_type text,    -- 'no_prompt'(A类) | 'prompt_ignored'(B类)
  gate2_mode text,            -- 'retry' | 'diagnose'
  gate2_input text,
  student_diagnosed boolean,
  retry_count int DEFAULT 0,
  retry_appeared boolean,

  -- 报告素材
  best_student_quote text,
  language_growth_note text,
  final_prompt_quality text
);

-- ============================================
-- 3. 索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_agent_sessions_student ON agent_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_session ON agent_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_pending ON agent_sessions(student_id, gate1_completed, upgrade_appeared);

-- ============================================
-- 4. RLS 策略
-- ============================================
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

-- 允许匿名访问（与现有 students 表策略一致）
DROP POLICY IF EXISTS "anon_agent_sessions_select" ON agent_sessions;
DROP POLICY IF EXISTS "anon_agent_sessions_insert" ON agent_sessions;
DROP POLICY IF EXISTS "anon_agent_sessions_update" ON agent_sessions;
DROP POLICY IF EXISTS "anon_agent_sessions_delete" ON agent_sessions;

CREATE POLICY "anon_agent_sessions_select" ON agent_sessions FOR SELECT USING (true);
CREATE POLICY "anon_agent_sessions_insert" ON agent_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_agent_sessions_update" ON agent_sessions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anon_agent_sessions_delete" ON agent_sessions FOR DELETE USING (true);

-- ============================================
-- 5. 扩展端口3：students 预留跨课时字段
-- ============================================
ALTER TABLE students ADD COLUMN IF NOT EXISTS project_id uuid DEFAULT NULL;

-- ============================================
-- 说明
-- ============================================
--
-- 三个扩展端口：
-- 1. lesson.js agent.demo_description - 每节课的示范作品描述
-- 2. agent_sessions.lesson_type - 区分不同课程的数据
-- 3. DIMENSION_LIBRARY - 跨课程复用维度描述
--
-- Gate 1 字段说明：
-- - round_X_mode: 'open' | 'fill' | 'choice'
-- - round_X_score_*: 0-3 分
-- - early_release: 第1轮就达到6/9分直接放行
--
-- Gate 2 字段说明：
-- - gate2_failure_type: 'no_prompt'(A类-没写) | 'prompt_ignored'(B类-写了但AI没做)
-- - gate2_mode: 'retry'(时间充裕) | 'diagnose'(时间紧张)
-- - student_diagnosed: 学生是否识别出缺失原因
--
-- Hard Upgrade Gate 2 专用字段：
-- - upgrade_matched: 描述是否匹配游戏结果（不同于 appeared，因为 Hard 肯定会"出现"某些东西）
-- - mismatch_detail: 不匹配时学生描述的具体差异
--

-- ============================================
-- 6. 增量更新（已有数据库添加新字段）
-- ============================================
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS upgrade_matched boolean;
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS mismatch_detail text;
