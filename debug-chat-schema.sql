-- DebugChat Schema Update
-- 2026-05-24: 持久对话界面支持

-- debug_sessions 表新增对话历史和标题字段
ALTER TABLE debug_sessions
  ADD COLUMN IF NOT EXISTS conversation_history jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS chat_title text,
  ADD COLUMN IF NOT EXISTS current_mode text DEFAULT 'debug_orchestrator',
  ADD COLUMN IF NOT EXISTS started_at timestamptz DEFAULT now();

-- conversation_history 格式：
-- [
--   { "role": "assistant", "content": "你遇到了什么问题？", "timestamp": "..." },
--   { "role": "user", "content": "the rock is blocking", "timestamp": "..." },
--   ...
-- ]

-- 索引（左边列表查询优化）
CREATE INDEX IF NOT EXISTS idx_debug_chat_list
  ON debug_sessions(student_id, started_at DESC);

-- 注释
COMMENT ON COLUMN debug_sessions.conversation_history IS 'JSON array of chat messages with role, content, timestamp';
COMMENT ON COLUMN debug_sessions.chat_title IS 'Auto-generated from first user message (max 30 chars)';
COMMENT ON COLUMN debug_sessions.current_mode IS 'Current debug mode: debug_orchestrator, debug_prompt, debug_code, debug_reset_phase1, debug_reset_phase2';
COMMENT ON COLUMN debug_sessions.started_at IS 'When this debug chat session started';
