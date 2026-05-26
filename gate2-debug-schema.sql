-- Gate 2 → Debug Direct Connection Schema Update
-- 2026-05-24: When Gate 2 verification fails, seamlessly switch to Debug mode

-- agent_sessions 表新增 gate2_failure_context 字段
ALTER TABLE agent_sessions
  ADD COLUMN IF NOT EXISTS gate2_failure_context jsonb;

-- gate2_failure_context 格式：
-- {
--   "failed_upgrade": "Timer",
--   "failed_upgrade_id": "timer",
--   "student_said": "No, I don't see a countdown timer",
--   "failure_type": "not_appeared"  -- or "not_matched" for Hard upgrades
-- }

-- 注释说明
COMMENT ON COLUMN agent_sessions.gate2_failure_context IS 'Gate 2 failure context when upgrade did not appear or match, used for Debug session continuation';
