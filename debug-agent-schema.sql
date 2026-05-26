-- Debug Multi-Agent System Schema
-- 2026-05-24

-- debug_sessions 表
CREATE TABLE debug_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),

  -- 分类（Orchestrator写入）
  bug_type text NOT NULL,           -- 'prompt' | 'code' | 'reset'
  severity text,                    -- 'light' | 'heavy'
  related_upgrade_id text,          -- A类专用：相关Upgrade

  -- 症状描述（追问层写入）
  bug_description text,             -- 精确症状描述
  trigger_condition text,           -- B类专用：触发条件

  -- A类（Prompt Tool）专用
  root_cause text,                  -- 学生说出的原因
  student_understood boolean,
  fix_quality text,                 -- 'vague' | 'specific' | 'precise'

  -- C类（Reset Tool）专用
  kept_upgrades jsonb,              -- 学生选择保留的Upgrade列表
  reset_insight text,               -- Phase 2学生说出的反思

  -- 执行层（学生自己写的）
  final_fix_prompt text,            -- Prompt Tool：学生写的修复描述
  final_fix_request text,           -- Code Tool：学生写的功能级修复指令
  final_new_prompt text,            -- Reset Tool：学生写的新prompt
  execution_attempts int DEFAULT 0, -- 执行了几次

  -- 验证层
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  needs_ta_help boolean DEFAULT false,

  -- 报告素材
  best_debug_quote text,
  insight_note text
);

-- 索引
CREATE INDEX idx_debug_student ON debug_sessions(student_id);
CREATE INDEX idx_debug_unresolved
  ON debug_sessions(student_id, resolved)
  WHERE resolved = false;

-- RLS
ALTER TABLE debug_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_debug_sessions" ON debug_sessions
  FOR ALL USING (true) WITH CHECK (true);
