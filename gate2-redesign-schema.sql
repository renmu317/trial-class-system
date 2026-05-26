-- Gate 2 重设计：静默标记
-- 2026-05-26

-- 新增字段：标记 upgrade_appeared 是推断值还是真实值
ALTER TABLE agent_sessions
  ADD COLUMN IF NOT EXISTS gate2_inferred boolean DEFAULT false;

-- gate2_inferred 含义：
-- true  = 推断值：学生返回 Prompt Tab 但没去 Debug
-- false = 真实值：学生确认或 Debug 记录的值

-- 数据逻辑：
-- upgrade_appeared = true,  gate2_inferred = true  → 推断值（学生没去 Debug）
-- upgrade_appeared = true,  gate2_inferred = false → 旧数据（迁移前的 Gate 2 确认）
-- upgrade_appeared = false, gate2_inferred = false → Debug 记录：学生遇到问题
-- upgrade_appeared = null                          → 还没有返回过 Prompt Tab

COMMENT ON COLUMN agent_sessions.gate2_inferred IS 'true = inferred (student did not debug), false = confirmed (via Debug Agent)';
