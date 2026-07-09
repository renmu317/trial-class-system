-- ============================================
-- TA 认证 + 报名系统 - 数据库迁移脚本
-- Phase 1: 数据库准备
-- 执行位置: Supabase Dashboard > SQL Editor
-- ============================================

-- ============================================
-- 1. 新建表
-- ============================================

-- 机构表
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  is_active boolean DEFAULT true
);

-- TA 账户表
CREATE TABLE IF NOT EXISTS ta_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  role text DEFAULT 'ta' CHECK (role IN ('ta', 'org_admin', 'super_admin')),
  is_active boolean DEFAULT true
);

-- 报名批次表
CREATE TABLE IF NOT EXISTS enrollment_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  ta_id uuid REFERENCES ta_profiles(id),
  batch_name text,
  total_students int DEFAULT 0,
  enrolled_count int DEFAULT 0,
  expires_at timestamptz,
  status text DEFAULT 'active' CHECK (status IN ('active', 'expired', 'closed'))
);

-- 学生报名表
CREATE TABLE IF NOT EXISTS student_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  batch_id uuid REFERENCES enrollment_batches(id),

  -- CSV 导入的信息
  student_name text NOT NULL,
  parent_phone text,
  grade text,

  -- 报名完成后填充
  parent_phone_verified text,
  student_auth_id uuid REFERENCES auth.users(id),
  student_id uuid,  -- 关联到 students 表

  -- Token
  enrollment_token text UNIQUE,
  token_expires_at timestamptz,

  -- 状态
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'enrolled', 'expired')),
  enrolled_at timestamptz
);

-- ============================================
-- 2. 修改现有表
-- ============================================

-- sessions 表新增 organization_id
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

-- students 表新增字段
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS enrollment_id uuid REFERENCES student_enrollments(id),
  ADD COLUMN IF NOT EXISTS parent_phone text,
  ADD COLUMN IF NOT EXISTS shortcode text UNIQUE;

-- 创建 shortcode 索引（查询优化）
CREATE INDEX IF NOT EXISTS idx_students_shortcode ON students(shortcode) WHERE shortcode IS NOT NULL;

-- ============================================
-- 3. 删除旧的 RLS 策略（全开放策略）
-- ============================================

-- 删除 students 表的旧策略
DROP POLICY IF EXISTS "anon_students" ON students;

-- 删除 sessions 表的旧策略
DROP POLICY IF EXISTS "anon_sessions" ON sessions;

-- ============================================
-- 4. 新表 RLS 策略
-- ============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ta_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY;

-- organizations: 所有人可读（显示机构 logo 等）
CREATE POLICY "organizations_public_read" ON organizations
  FOR SELECT USING (true);

-- organizations: 只有 super_admin 可写
CREATE POLICY "organizations_admin_write" ON organizations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM ta_profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- ta_profiles: TA 只能看自己机构
CREATE POLICY "ta_profiles_own_org" ON ta_profiles
  FOR SELECT USING (
    organization_id = (
      SELECT organization_id FROM ta_profiles WHERE id = auth.uid()
    )
  );

-- ta_profiles: 自己可以更新自己
CREATE POLICY "ta_profiles_self_update" ON ta_profiles
  FOR UPDATE USING (id = auth.uid());

-- enrollment_batches: TA 只能看/操作自己机构
CREATE POLICY "batches_own_org" ON enrollment_batches
  FOR ALL USING (
    organization_id = (
      SELECT organization_id FROM ta_profiles WHERE id = auth.uid()
    )
  );

-- student_enrollments: TA 只能看/操作自己机构
CREATE POLICY "enrollments_own_org" ON student_enrollments
  FOR ALL USING (
    organization_id = (
      SELECT organization_id FROM ta_profiles WHERE id = auth.uid()
    )
  );

-- 注意：student_enrollments 没有匿名读取策略
-- 报名页通过 Edge Function (Service Role) 验证 token

-- ============================================
-- 5. students 表 RLS 策略（修复匿名漏洞）
-- ============================================

-- 策略 1: TA 只能看自己机构的学生
CREATE POLICY "students_ta_own_org" ON students
  FOR ALL USING (
    organization_id IS NOT NULL
    AND organization_id = (
      SELECT organization_id FROM ta_profiles WHERE id = auth.uid()
    )
  );

-- 策略 2: 学生自己可以查看自己的记录
CREATE POLICY "students_self_access" ON students
  FOR SELECT USING (
    auth_user_id IS NOT NULL
    AND auth_user_id = auth.uid()
  );

-- 策略 3: 匿名用户只能访问近8小时内 session 的学生（兼容现有流程）
CREATE POLICY "students_anon_session" ON students
  FOR ALL USING (
    auth.uid() IS NULL
    AND session_id IN (
      SELECT id FROM sessions
      WHERE created_at > now() - interval '8 hours'
    )
  );

-- ============================================
-- 6. sessions 表 RLS 策略
-- ============================================

-- 策略 1: TA 只能看自己机构的 session
CREATE POLICY "sessions_ta_own_org" ON sessions
  FOR ALL USING (
    organization_id IS NOT NULL
    AND organization_id = (
      SELECT organization_id FROM ta_profiles WHERE id = auth.uid()
    )
  );

-- 策略 2: 匿名用户可以访问近8小时内的 session（兼容现有学生入口）
CREATE POLICY "sessions_anon_recent" ON sessions
  FOR SELECT USING (
    auth.uid() IS NULL
    AND created_at > now() - interval '8 hours'
  );

-- 策略 3: 匿名用户可以创建 session（兼容 TA 未登录时创建）
-- 注意：Phase 2 完成后可以移除此策略
CREATE POLICY "sessions_anon_insert" ON sessions
  FOR INSERT WITH CHECK (auth.uid() IS NULL);

-- ============================================
-- 7. 初始数据
-- ============================================

-- 创建默认机构
INSERT INTO organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000001', 'AI Creative Class', 'ai-creative-class')
ON CONFLICT (id) DO NOTHING;

-- 现有 sessions 归属默认机构
UPDATE sessions
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- 现有 students 归属默认机构（通过 session 关联）
UPDATE students s
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE s.organization_id IS NULL
  AND EXISTS (
    SELECT 1 FROM sessions
    WHERE sessions.id = s.session_id
  );

-- ============================================
-- 8. 创建索引（查询优化）
-- ============================================

CREATE INDEX IF NOT EXISTS idx_ta_profiles_org ON ta_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_batches_org ON enrollment_batches(organization_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_org ON student_enrollments(organization_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_token ON student_enrollments(enrollment_token);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_status ON student_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_sessions_org ON sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_students_org ON students(organization_id);

-- ============================================
-- 完成！
-- 下一步：Phase 2 - TA 登录系统
-- ============================================
