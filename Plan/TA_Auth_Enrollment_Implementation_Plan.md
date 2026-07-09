# TA 认证 + 报名系统实施方案

## 一、现状分析

### 当前系统
| 模块 | 现状 | 问题 |
|------|------|------|
| TA 登录 | 无认证，输入名字即可进入 | 任何人都能访问 Dashboard |
| 学生入口 | 4位码 + 输入姓名 | 无持久身份，每次重新输入 |
| 数据隔离 | 无 | 所有 TA 能看到所有 session |
| 组织概念 | 无 organizations 表 | 无法支持多机构 |

### 目标系统
```
机构 A                    机构 B
  ↓                         ↓
TA (Magic Link 登录)      TA (Magic Link 登录)
  ↓                         ↓
只看机构 A 数据            只看机构 B 数据
  ↓                         ↓
上传 CSV → 生成报名链接    上传 CSV → 生成报名链接
  ↓                         ↓
家长报名 → OTP → shortcode  家长报名 → OTP → shortcode
  ↓                         ↓
学生上课：输入 shortcode    学生上课：输入 shortcode
```

---

## 二、实施阶段

### Phase 1: 数据库准备 (1天)

**新建表**
```sql
-- 1. organizations 机构表
-- 2. ta_profiles TA账户表
-- 3. enrollment_batches 报名批次表
-- 4. student_enrollments 学生报名表
```

**修改现有表**
```sql
-- sessions 表新增
ALTER TABLE sessions ADD COLUMN organization_id uuid;

-- students 表新增
ALTER TABLE students ADD COLUMN auth_user_id uuid;
ALTER TABLE students ADD COLUMN organization_id uuid;
ALTER TABLE students ADD COLUMN enrollment_id uuid;
ALTER TABLE students ADD COLUMN parent_phone text;
ALTER TABLE students ADD COLUMN shortcode text UNIQUE;
```

**RLS 策略**
- ta_profiles: TA 只能看自己机构
- enrollment_batches: TA 只能看自己机构
- student_enrollments: TA 只能看自己机构
- students: 修复匿名漏洞，限制查询范围
- sessions: 新增 organization_id 过滤

**数据迁移**
- 创建默认机构 "AI Creative Class"
- 现有 sessions 归属默认机构
- 为你创建 super_admin 账户

---

### Phase 2: TA 登录系统 (1天)

**文件变更**
```
ta-dashboard/
├── src/
│   ├── App.jsx                    # 修改：添加 Auth Guard
│   ├── lib/
│   │   └── supabase.js            # 已有，无需修改
│   ├── pages/
│   │   ├── Login.jsx              # 新增：Magic Link 登录页
│   │   └── AuthCallback.jsx       # 新增：处理登录回调
│   └── components/
│       ├── Setup.jsx              # 修改：移除名字输入，改用登录用户
│       └── AuthGuard.jsx          # 新增：未登录重定向
```

**流程**
```
访问 ta-dashboard
    ↓
AuthGuard 检查登录状态
    ↓
未登录 → Login.jsx (输入邮箱 → Magic Link)
    ↓
点击邮件链接 → AuthCallback.jsx
    ↓
验证 ta_profiles 记录 → 进入 Dashboard
```

**Supabase 配置**
- Authentication → Email → 确认 Magic Link 启用
- 不需要密码，不需要 Confirm Email

---

### Phase 3: CSV 上传 + Edge Function (2天)

**文件变更**
```
ta-dashboard/
├── src/
│   ├── pages/
│   │   └── Enrollment.jsx         # 新增：报名管理页
│   └── components/
│       ├── CSVUploader.jsx        # 新增：CSV 上传组件
│       └── EnrollmentTable.jsx    # 新增：报名列表组件

supabase/
└── functions/
    └── process-enrollment-csv/
        └── index.ts               # 新增：CSV 处理 Edge Function
```

**流程**
```
TA 上传 CSV
    ↓
前端上传到 Storage (enrollment-csvs bucket)
    ↓
调用 Edge Function
    ↓
Edge Function (Service Role):
  - 读取 CSV
  - 为每个学生生成 32位 token
  - 插入 student_enrollments
  - 返回成功数量
    ↓
前端显示结果
```

**Supabase 配置**
- Storage → 新建 bucket: `enrollment-csvs` (Private)
- Edge Function 部署

---

### Phase 4: 家长报名页 (2天)

**文件变更**
```
student-app/
├── src/
│   ├── main.jsx                   # 修改：添加 /enroll/:token 路由
│   └── pages/
│       └── Enroll.jsx             # 新增：报名页

supabase/
└── functions/
    ├── verify-enrollment-token/
    │   └── index.ts               # 新增：验证 token 的 Edge Function
    └── complete-enrollment/
        └── index.ts               # 新增：完成报名的 Edge Function
```

**流程**
```
家长点击报名链接 /enroll/abc123...
    ↓
前端调用 verify-enrollment-token Edge Function
    ↓
Edge Function (Service Role):
  - 查询 student_enrollments WHERE enrollment_token = ?
  - 验证 status = 'pending' AND token_expires_at > now()
  - 返回 { student_name, organization_name, organization_logo }
  - 不暴露敏感数据
    ↓
显示学生姓名 + 机构 logo
    ↓
输入手机号 → 发送 OTP (Supabase Auth)
    ↓
验证 OTP
    ↓
前端调用 complete-enrollment Edge Function
    ↓
Edge Function (Service Role):
  - 验证 token + OTP 已通过
  - 创建 students 记录 + 生成 shortcode
  - 更新 student_enrollments 状态
  - 返回 shortcode
    ↓
显示 shortcode: MING-7823
```

**为什么用 Edge Function 而不是直接查询？**
- 安全：前端直接查询会暴露所有 pending 记录给有心人（轮询攻击）
- RLS 无法验证 URL 中的 token（token 不在 JWT 里）
- Edge Function 用 Service Role 绕过 RLS，精确返回单条记录

**Shortcode 生成逻辑**
```javascript
// 处理中文名字的 shortcode 生成
const generateShortcode = (studentName) => {
  // 提取英文字母
  const englishPart = studentName.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase();

  // 如果有足够的英文字母（>=2），使用英文
  // 否则使用通用前缀 "STUD"
  const namePart = englishPart.length >= 2
    ? englishPart.padEnd(4, 'X')  // 不足4位用X填充
    : 'STUD';

  // 4位随机数字
  const numPart = Math.floor(1000 + Math.random() * 9000);

  return `${namePart}-${numPart}`;
};

// 示例:
// "John Smith" → "JOHN-7823"
// "小明" → "STUD-4521"
// "王Lei" → "LEI-3892" (只取英文部分)
// "Amy" → "AMYX-6134" (填充X)
```

**Supabase 配置**
- Authentication → Phone → 启用
- SMS Provider: 阿里云短信 或 Twilio

---

### Phase 5: 学生 Shortcode 登录 (1天)

**文件变更**
```
student-app/
├── src/
│   ├── App.jsx                    # 修改：添加 shortcode 入口
│   └── components/
│       └── ShortcodeLogin.jsx     # 新增：shortcode 登录组件
```

**流程**
```
学生访问 student-app
    ↓
显示两个入口：
  1. [已有 shortcode] → 输入 MING-7823
  2. [第一次来] → 输入姓名（现有流程）
    ↓
Shortcode 路径：
  查询 students.shortcode → 找到学生
  → 显示 "Welcome back, 小明!"
  → 输入 4位课程码 → 进入课堂
    ↓
姓名路径（保持现有）：
  输入姓名 → 输入 4位课程码 → 进入课堂
```

---

### Phase 6: TA 报名管理页面 (1天)

**文件变更**
```
ta-dashboard/
├── src/
│   ├── App.jsx                    # 修改：添加 Enrollment 路由
│   └── pages/
│       └── Enrollment.jsx         # 完善：批次列表 + 学生列表
```

**功能**
- 查看报名批次列表
- 每个批次的学生列表
- 报名状态：pending / enrolled / expired
- 复制单个报名链接
- 导出所有链接为 CSV
- 显示已报名学生的 shortcode

---

## 三、数据库 Schema

```sql
-- ========================================
-- Phase 1: 新建表
-- ========================================

-- 机构表
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  is_active boolean DEFAULT true
);

-- TA 账户表
CREATE TABLE ta_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  role text DEFAULT 'ta',  -- 'ta' | 'org_admin' | 'super_admin'
  is_active boolean DEFAULT true
);

-- 报名批次表
CREATE TABLE enrollment_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  ta_id uuid REFERENCES ta_profiles(id),
  batch_name text,
  total_students int DEFAULT 0,
  enrolled_count int DEFAULT 0,
  expires_at timestamptz,
  status text DEFAULT 'active'  -- 'active' | 'expired' | 'closed'
);

-- 学生报名表
CREATE TABLE student_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  batch_id uuid REFERENCES enrollment_batches(id),

  -- CSV 导入
  student_name text NOT NULL,
  parent_phone text,
  grade text,

  -- 报名完成后
  parent_phone_verified text,
  student_auth_id uuid REFERENCES auth.users(id),

  -- Token
  enrollment_token text UNIQUE,
  token_expires_at timestamptz,

  -- 状态
  status text DEFAULT 'pending',  -- 'pending' | 'enrolled' | 'expired'
  enrolled_at timestamptz
);

-- ========================================
-- Phase 1: 修改现有表
-- ========================================

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id);

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS enrollment_id uuid REFERENCES student_enrollments(id),
  ADD COLUMN IF NOT EXISTS parent_phone text,
  ADD COLUMN IF NOT EXISTS shortcode text UNIQUE;

-- ========================================
-- Phase 1: RLS 策略
-- ========================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ta_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- TA 只能看自己机构
CREATE POLICY "ta_own_org" ON ta_profiles
  FOR ALL USING (
    organization_id = (
      SELECT organization_id FROM ta_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "batches_own_org" ON enrollment_batches
  FOR ALL USING (
    organization_id = (
      SELECT organization_id FROM ta_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "enrollments_own_org" ON student_enrollments
  FOR ALL USING (
    organization_id = (
      SELECT organization_id FROM ta_profiles WHERE id = auth.uid()
    )
  );

-- ========================================
-- students 表 RLS（修复匿名漏洞）
-- ========================================

-- 1. TA 只能看自己机构的学生
CREATE POLICY "students_ta_own_org" ON students
  FOR ALL USING (
    organization_id = (
      SELECT organization_id FROM ta_profiles WHERE id = auth.uid()
    )
  );

-- 2. 学生自己可以查看自己的记录
CREATE POLICY "students_self_access" ON students
  FOR SELECT USING (
    auth_user_id = auth.uid()
  );

-- 3. 匿名用户只能访问近8小时内有效 session 的学生
CREATE POLICY "students_anon_session" ON students
  FOR ALL USING (
    auth.uid() IS NULL
    AND id IN (
      SELECT student_id FROM session_students
      WHERE session_id IN (
        SELECT id FROM sessions
        WHERE created_at > now() - interval '8 hours'
      )
    )
  );

-- ========================================
-- student_enrollments 表 RLS
-- ========================================

-- 注意：不再有 enrollment_pending_read 策略
-- 原因：匿名用户不能直接查询 student_enrollments
-- 报名页通过 Edge Function (Service Role) 验证 token

-- ========================================
-- Phase 1: 初始数据
-- ========================================

-- 创建默认机构
INSERT INTO organizations (id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000001', 'AI Creative Class', 'ai-creative-class');

-- 现有 sessions 归属默认机构
UPDATE sessions SET organization_id = '00000000-0000-0000-0000-000000000001'
  WHERE organization_id IS NULL;
```

---

## 四、文件变更清单

| 阶段 | 文件 | 操作 | 说明 |
|------|------|------|------|
| **P1** | `ta-auth-schema.sql` | 新建 | 数据库迁移脚本 |
| **P2** | `ta-dashboard/src/pages/Login.jsx` | 新建 | Magic Link 登录页 |
| **P2** | `ta-dashboard/src/pages/AuthCallback.jsx` | 新建 | 登录回调处理 |
| **P2** | `ta-dashboard/src/components/AuthGuard.jsx` | 新建 | 登录状态守卫 |
| **P2** | `ta-dashboard/src/App.jsx` | 修改 | 添加路由和 Auth |
| **P2** | `ta-dashboard/src/components/Setup.jsx` | 修改 | 移除名字输入 |
| **P3** | `supabase/functions/process-enrollment-csv/index.ts` | 新建 | CSV 处理 |
| **P3** | `ta-dashboard/src/pages/Enrollment.jsx` | 新建 | 报名管理页 |
| **P3** | `ta-dashboard/src/components/CSVUploader.jsx` | 新建 | CSV 上传组件 |
| **P4** | `supabase/functions/verify-enrollment-token/index.ts` | 新建 | Token 验证（安全） |
| **P4** | `supabase/functions/complete-enrollment/index.ts` | 新建 | 完成报名 + Shortcode |
| **P4** | `student-app/src/pages/Enroll.jsx` | 新建 | 家长报名页 |
| **P4** | `student-app/src/main.jsx` | 修改 | 添加路由 |
| **P5** | `student-app/src/components/ShortcodeLogin.jsx` | 新建 | Shortcode 登录 |
| **P5** | `student-app/src/App.jsx` | 修改 | 添加入口选择 |
| **P6** | `ta-dashboard/src/components/EnrollmentTable.jsx` | 新建 | 报名列表 |

---

## 五、风险和注意事项

### 1. 向后兼容
- **现有 session 数据**：自动归属默认机构，不影响使用
- **现有学生入口**：保留姓名入口，shortcode 是新增入口
- **现有 TA 流程**：需要为现有 TA 创建账户后才能登录

### 2. SMS 成本
- Twilio: ~$0.01/条（国际）
- 阿里云: ~¥0.045/条（国内，需备案）
- 建议：先用 Twilio 测试，上线后切阿里云

### 3. 安全考虑
- **Magic Link 有效期**：默认 1 小时
- **报名 Token 有效期**：30 天
- **OTP 有效期**：默认 60 秒
- **students 表 RLS**：三条策略 (TA机构/自己/session限时)
- **enrollment 表 RLS**：无匿名读取策略，防止枚举攻击
- **Token 验证**：必须通过 Edge Function，不直接暴露给前端
- **RLS 测试**：上线前用匿名用户测试所有表的直接查询

### 4. 部署顺序
```
1. 执行数据库迁移（不影响现有功能）
2. 部署 Edge Function
3. 部署 ta-dashboard（需要为 TA 创建账户）
4. 部署 student-app（新功能，不影响现有流程）
```

---

## 六、验收标准

### TA 登录
- [ ] TA 输入邮箱 → 收到 Magic Link 邮件
- [ ] 点击链接 → 进入 Dashboard
- [ ] 不在 ta_profiles 的邮箱 → 显示错误
- [ ] 不同机构的 TA 互相看不到数据

### CSV 上传
- [ ] 上传 CSV → Edge Function 处理成功
- [ ] 每个学生生成唯一 token
- [ ] 大文件（1000 行）正常处理

### 家长报名
- [ ] 有效 token → 显示学生姓名和机构 logo
- [ ] 无效/过期 token → 显示错误页
- [ ] OTP 验证成功 → 创建 students 记录
- [ ] 显示 shortcode（格式：XXXX-1234）
- [ ] 已使用的 token 不能重复使用

### 学生上课
- [ ] 输入 shortcode → 显示 "Welcome back, 小明!"
- [ ] 错误的 shortcode → 显示错误提示
- [ ] 点 "Enter your name" → 现有流程正常
- [ ] 两条路径都能正常进入课堂

### 数据安全
- [ ] 匿名用户不能查询所有学生（students 表 RLS 验证）
- [ ] 匿名用户不能枚举 pending enrollments（无直接查询策略）
- [ ] 报名页只能通过 Edge Function 验证 token（单条返回）
- [ ] TA 只能看自己机构的 enrollment
- [ ] TA 只能看自己机构的 students
- [ ] CSV 文件在 Storage 里私有
- [ ] 学生只能查看自己的 student 记录（auth_user_id 匹配）
- [ ] 无效 token 返回通用错误（不泄露是否存在）

---

## 七、工期估算

| 阶段 | 天数 | 备注 |
|------|------|------|
| Phase 1: 数据库 | 1 | 迁移脚本 + 测试 |
| Phase 2: TA 登录 | 1 | Magic Link + Auth Guard |
| Phase 3: CSV 上传 | 2 | Edge Function + 前端 |
| Phase 4: 家长报名 | 2 | OTP + shortcode |
| Phase 5: Shortcode 登录 | 1 | 学生入口 |
| Phase 6: 报名管理 | 1 | TA Dashboard 页面 |
| **总计** | **8 天** | |

---

## 八、下一步

1. **确认方案**：是否有需要调整的地方？
2. **SMS Provider 选择**：Twilio 还是阿里云？
3. **开始 Phase 1**：执行数据库迁移
