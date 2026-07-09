-- ========================================
-- 添加新机构 + TA 账户
-- ========================================

-- 1. 创建新机构
INSERT INTO organizations (id, name, slug) VALUES
  (gen_random_uuid(), 'Emmerse Education', 'emmerse')
RETURNING id, name, slug;

-- 2. 为新 TA 创建账户（需要先通过 Supabase Auth 邀请邮箱）
-- 步骤：
--   a) 在 Supabase Dashboard > Authentication > Users > Invite
--   b) 输入 TA 邮箱，发送邀请
--   c) TA 点击邮件链接完成注册
--   d) 获取 auth.users 中的 user id
--   e) 运行下面的 SQL 创建 ta_profiles 记录

-- 示例：假设新 TA 的 auth user id 是 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
-- 假设新机构的 id 是 'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy'

-- INSERT INTO ta_profiles (id, organization_id, name, email, role) VALUES
--   ('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', 'yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy', 'TA Name', 'ta@emmerse.com', 'ta');

-- ========================================
-- 验证 RLS 策略
-- ========================================

-- 检查 RLS 是否启用
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('sessions', 'students', 'student_enrollments', 'ta_profiles', 'enrollment_batches');

-- 查看现有策略
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';
