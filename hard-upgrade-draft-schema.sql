-- Hard Upgrade draft_prompt Schema Update
-- 2026-05-24: Gate 1 完成时生成 draft_prompt 预填 textarea

-- agent_sessions 表新增 draft_prompt 字段
ALTER TABLE agent_sessions
  ADD COLUMN IF NOT EXISTS draft_prompt text;

-- 注释说明
COMMENT ON COLUMN agent_sessions.draft_prompt IS 'Hard upgrade: AI-generated draft prompt from Gate 1 conversation (3-5 sentences)';

-- 示例数据格式:
-- draft_prompt = "Add a hidden passage on the left side of the maze near the starting point.
--                 When the player touches the golden-colored wall section, it disappears for 3 seconds
--                 to reveal a secret shortcut. The hidden wall should look slightly different
--                 from normal walls with a golden color to hint at the secret."
