# Student Login Redesign - 6位身份码 + 4位课堂码

## 概述

将学生登录流程拆分为两个独立概念：
- **6位 Shortcode（身份码）**：学生账户标识，长期有效
- **4位 Session Code（课堂码）**：特定课堂入口，每节课不同

---

## 当前设计 vs 新设计

| 项目 | 当前设计 | 新设计 |
|------|----------|--------|
| 6位码作用 | 自动加入机构的 active session | 仅用于识别/创建学生账户 |
| 4位码作用 | 加入 session + 输入名字 | 加入 session（已识别身份时跳过名字） |
| 学生身份 | 每次输入名字 | 首次用6位码注册，之后自动识别 |
| 跨设备 | 需重新输入名字 | 用6位码恢复身份 |

---

## 用户流程

### 流程 1：首次使用（新学生）

```
打开 App
    ↓
检测 localStorage → 无账户
    ↓
显示登录页（两个选项）
┌─────────────────────────────────┐
│  加入课堂                        │
│  ┌─────────────────────────┐    │
│  │     [4位课堂码]          │    │
│  └─────────────────────────┘    │
│           [加入]                 │
│                                  │
│  ─────────── 或 ───────────     │
│                                  │
│  首次使用？输入学生码            │
│  ┌─────────────────────────┐    │
│  │     [6位学生码]          │    │
│  └─────────────────────────┘    │
│         [注册/登录]              │
└─────────────────────────────────┘
    ↓
学生输入 6位码
    ↓
verify-shortcode API → 返回 { student_name, organization_id }
    ↓
创建/恢复学生账户 → 保存到 localStorage
    ↓
显示：「欢迎，Jason Lin！」
    ↓
提示输入 4位课堂码
    ↓
输入 4位码 → 加入 session
```

### 流程 2：再次使用（已注册学生）

```
打开 App
    ↓
检测 localStorage → 有账户 { student_name: "Jason Lin", shortcode: "154100" }
    ↓
显示登录页
┌─────────────────────────────────┐
│  👋 欢迎回来，Jason Lin         │
│                      [切换账户]  │
│                                  │
│  输入课堂码加入                   │
│  ┌─────────────────────────┐    │
│  │     [4位课堂码]          │    │
│  └─────────────────────────┘    │
│           [加入]                 │
└─────────────────────────────────┘
    ↓
输入 4位码 → 查询 session
    ↓
检查该 session 是否有此学生记录
├─ 有 → 恢复学生记录
└─ 无 → 创建新记录（用已知的 student_name）
    ↓
进入课堂
```

### 流程 3：换设备/清缓存

```
打开 App（新设备）
    ↓
检测 localStorage → 无账户
    ↓
学生输入 6位码
    ↓
恢复身份 → 保存到 localStorage
    ↓
输入 4位码 → 加入 session
```

---

## 数据模型

### localStorage 结构

```javascript
// 学生身份（长期保存）
{
  "student_identity": {
    "shortcode": "154100",
    "student_name": "Jason Lin",
    "organization_id": "uuid",
    "enrollment_id": "uuid"
  }
}

// 当前 session（临时）
{
  "current_session": {
    "session_id": "uuid",
    "student_id": "uuid"  // students 表的 id
  }
}
```

### 数据库关系

```
student_enrollments (报名记录 - shortcode 唯一权威来源)
├── shortcode (6位字母数字混合，唯一)
├── student_name
├── organization_id
└── status: enrolled

sessions (课堂)
├── join_code (4位码)
├── organization_id
└── status: active/ended

students (学生参与记录，每个 session 一条)
├── session_id
├── enrollment_id (关联报名，可为 null)
├── name
└── ❌ 不存储 shortcode（避免冗余）
```

**设计原则**：
- `shortcode` 只存在 `student_enrollments` 表
- `students` 表通过 `enrollment_id` 关联到报名记录
- 查询学生身份时：`students.enrollment_id → student_enrollments.shortcode`

---

## API 设计

### 1. verify-shortcode（已有，需修改）

**用途**：验证6位码，返回学生身份信息（不再查找 session）

**输入**：
```json
{ "shortcode": "154100" }
```

**输出**：
```json
{
  "success": true,
  "student_name": "Jason Lin",
  "organization_id": "uuid",
  "enrollment_id": "uuid",
  "grade": "G6"
}
```

**不再做**：
- ❌ 查找 active session
- ❌ 创建 students 记录

### 2. join-session（新增）

**用途**：用4位码加入课堂，可选传入学生身份

**输入**：
```json
{
  "session_code": "1234",
  "enrollment_id": "uuid",  // 可选，有则用已知身份
  "student_name": "Jason Lin"  // 可选，无 enrollment_id 时必填
}
```

**输出**：
```json
{
  "success": true,
  "session_id": "uuid",
  "session_name": "AI Creative Class",
  "student_id": "uuid",
  "lesson_type": "lesson1"
}
```

**逻辑**：
```javascript
async function joinSession(sessionCode, enrollmentId, studentName) {
  // 1. 查找 session
  const session = await findSessionByCode(sessionCode)
  if (!session || session.status !== 'active') {
    throw new Error('Invalid or inactive session')
  }

  // 2. 有 enrollment_id：用身份查重
  if (enrollmentId) {
    const existing = await findStudentByEnrollment(session.id, enrollmentId)
    if (existing) return existing  // 已有记录，直接返回

    // 创建新记录，关联 enrollment
    return await createStudent(session.id, studentName, enrollmentId)
  }

  // 3. 无 enrollment_id：用名字查重（防止同设备/不同设备重复创建）
  const existing = await findStudentByName(session.id, studentName)
  if (existing) {
    // 显示确认弹窗：「已有同名学生，是你吗？」
    return { existing, needsConfirmation: true }
  }

  // 4. 创建匿名学生记录
  return await createStudent(session.id, studentName, null)
}
```

**边界情况处理**：
- 同一学生在同一 session 用不同设备加入 → 用 enrollment_id 或 name 查重
- 设备 A 有 localStorage，设备 B 没有 → 都能关联到同一条记录

---

## UI 组件设计

### StudentLogin.jsx（新组件）

```jsx
function StudentLogin({ onLogin }) {
  const [identity, setIdentity] = useState(null);  // localStorage 的身份
  const [mode, setMode] = useState('session');     // 'session' | 'register'

  useEffect(() => {
    const saved = localStorage.getItem('student_identity');
    if (saved) setIdentity(JSON.parse(saved));
  }, []);

  // 已有身份：直接显示 4位码输入
  if (identity) {
    return (
      <div>
        <WelcomeBack name={identity.student_name} onSwitch={() => setIdentity(null)} />
        <SessionCodeInput onJoin={(code) => handleJoinSession(code, identity)} />
      </div>
    );
  }

  // 无身份：显示两个选项
  return (
    <div>
      <SessionCodeInput onJoin={(code) => handleJoinSession(code, null)} />
      <Divider text="首次使用？" />
      <ShortcodeInput onRegister={handleRegister} />
    </div>
  );
}
```

### 组件结构

```
StudentLogin.jsx (主组件)
├── WelcomeBack.jsx (已登录状态)
├── SessionCodeInput.jsx (4位码输入)
├── ShortcodeInput.jsx (6位码输入)
└── NameInput.jsx (匿名学生名字输入，保留兼容)
```

---

## 文件变更清单

| 文件 | 操作 | 状态 | 说明 |
|------|------|------|------|
| `supabase/functions/complete-enrollment/index.ts` | 修改 | ✅ | 改为字母数字混合码 |
| `supabase/functions/verify-shortcode/index.ts` | 修改 | ✅ | 移除 session 查找逻辑 |
| `supabase/functions/join-session/index.ts` | **新建** | ✅ | 用 4位码加入 session |
| `student-app/src/components/StudentLogin.jsx` | **新建** | ✅ | 新登录组件（含所有子组件） |
| `student-app/src/components/CodeInput.jsx` | 保留 | ✅ | 作为 legacy fallback |
| `student-app/src/App.jsx` | 修改 | ✅ | 使用新登录流程 |

---

## 实施步骤

### Phase 1: 后端 API - ✅ 已完成 (2026-05-29)

1. ✅ 修改 `complete-enrollment`：改为字母数字混合码 (32^6 = 10.7亿种)
2. ✅ 修改 `verify-shortcode`：移除 session 查找，只返回身份信息
3. ✅ 新建 `join-session`：用 4位码加入 session，支持身份关联和去重
4. ✅ 部署 Edge Functions

### Phase 2: 前端组件 - ✅ 已完成 (2026-05-29)

1. ✅ 新建 `StudentLogin.jsx` 主组件（含 WelcomeBack, SessionCodeInput, ShortcodeInput）
2. ✅ 修改 `App.jsx` 集成新登录流程
3. ✅ 部署到 Vercel (trial-class-system.vercel.app)

### Phase 3: 测试

1. 测试首次注册流程
2. 测试再次登录流程
3. 测试换设备恢复身份
4. 测试匿名学生（只用4位码+名字）

---

## 数据库迁移

### 修改 shortcode 格式

```sql
-- 1. 修改 complete-enrollment Edge Function 生成字母数字混合码
-- 2. 已有的纯数字码继续有效，不需要迁移

-- 3. 移除 students 表的 shortcode 列（如果有）
ALTER TABLE students DROP COLUMN IF EXISTS shortcode;

-- 4. 确保 enrollment_id 索引
CREATE INDEX IF NOT EXISTS idx_students_enrollment_id
  ON students(enrollment_id) WHERE enrollment_id IS NOT NULL;
```

---

## 兼容性考虑

### 匿名学生支持

保留现有流程：学生可以只输入4位码 + 名字加入，不需要6位身份码。

```
输入 4位码 → 无身份 → 显示名字输入框 → 创建匿名学生记录
```

### 现有学生数据

- 已有 students 记录保持不变
- 新增 enrollment_id 关联（可选）
- shortcode 字段用于身份恢复

---

## 安全考虑

### 1. Shortcode 防枚举

**问题**：6位纯数字只有 100 万种可能，可被暴力枚举。

**解决方案**：改为 6 位字母数字混合（大写 + 数字，排除易混淆字符）

```javascript
// 可用字符：排除 0/O, 1/I/L
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'  // 32 字符
// 32^6 = 10.7 亿种可能

function generateShortcode() {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return code
}
// 示例：「K3MN7P」「X9HJ2V」
```

**Rate Limiting（可选）**：
```javascript
// verify-shortcode Edge Function
const clientIP = req.headers.get('x-forwarded-for')
const attempts = await getAttempts(clientIP)
if (attempts > 10) {
  return { error: 'Too many attempts. Try again later.' }
}
```

### 2. 4位课堂码时效性

- 已有 RLS 策略限制 8 小时内 session
- Session 结束后 4 位码自动失效
- 保持现有安全机制

### 3. localStorage 不可靠

**问题**：学生经常清缓存、换浏览器、用隐私模式。

**解决方案**：UI 明确提示

```
┌─────────────────────────────────────────┐
│  🎉 注册成功！                           │
│                                          │
│  你的学生码：K3MN7P                      │
│                                          │
│  ⚠️ 重要：请保存这个码！                 │
│  下次上课或换设备时需要用它登录          │
│                                          │
│  [截图保存]  [复制]  [继续]               │
└─────────────────────────────────────────┘
```

报名完成页也要强调：「请把学生码告诉孩子，每次上课都需要！」

---

## 问题解决汇总

| 问题 | 解决方案 |
|------|----------|
| shortcode 两张表冗余 | 只存 `student_enrollments`，`students` 通过 `enrollment_id` 关联 |
| localStorage 不可靠 | UI 明确提示保存 6 位码，fallback 到首次流程可接受 |
| 同 session 重复创建 | `join-session` 先用 enrollment_id 查重，再用 name 查重 |
| 6 位纯数字可枚举 | 改为字母数字混合（32^6 = 10.7 亿种），可选加 rate limiting |

---

## 最终流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                        家长报名流程                              │
├─────────────────────────────────────────────────────────────────┤
│  TA 上传 CSV → 生成 enrollment link                             │
│       ↓                                                          │
│  家长打开链接 → 输入手机号 → 获得 6 位学生码（如 K3MN7P）         │
│       ↓                                                          │
│  页面提示：「请把学生码告诉孩子，每次上课都需要！」              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        学生上课流程                              │
├─────────────────────────────────────────────────────────────────┤
│  打开 App → 检查 localStorage                                    │
│       ↓                                                          │
│  ┌─ 有身份 ─────────────────────────────────────────────────┐   │
│  │  显示「欢迎回来，Jason！」                                │   │
│  │  输入 4 位课堂码 → 加入 session                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│       或                                                         │
│  ┌─ 无身份 ─────────────────────────────────────────────────┐   │
│  │  选项 A：输入 6 位学生码 → 恢复身份 → 输入 4 位课堂码      │   │
│  │  选项 B：输入 4 位课堂码 + 名字（匿名学生）                │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```
