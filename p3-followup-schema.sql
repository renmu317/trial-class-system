-- P3.1 Follow-up System Schema
-- Run this in Supabase SQL Editor

-- 第二次跟进消息字段
ALTER TABLE reports ADD COLUMN IF NOT EXISTS followup_content_zh text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS followup_content_en text;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS followup_sent_at timestamptz;

-- 验证
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'reports';
