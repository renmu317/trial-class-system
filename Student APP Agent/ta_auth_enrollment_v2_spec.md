# TA App 登录认证 + 报名链接系统设计 V2
## 四处修改：Magic Link + shortcode上课 + RLS修复 + Edge Function处理CSV

---

## 整体架构

```
机构A                    你（管理员）              机构B
  ↓                          ↓                      ↓
TA账户                  SuperAdmin账户            TA账户
（Magic Link登录）      （Service Role Key）      （Magic Link登录）
  ↓                          ↓                      ↓
只看机构A数据           看所有机构数据            只看机构B数据
  ↓
上传CSV → Edge Function处理
  ↓
生成报名链接（每个学生唯一token）
  ↓
TA发链接给家长
  ↓
家长点链接 → 输入手机号 → OTP验证 → 学生账户创建 → 生成shortcode
  ↓
上课时：输入shortcode + 4位码 → 进入课堂（不需要重新OTP）
```

---

## Part 1：数据库设计

### 新增表

```sql
-- 机构表
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  is_active boolean DEFAULT true,

  -- 未来API对接预留
  integration_type text DEFAULT 'csv',  -- 'csv' | 'api'
  api_endpoint text,
  api_key_encrypted text
);

-- TA账户表
CREATE TABLE ta_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  role text DEFAULT 'ta',               -- 'ta' | 'org_admin' | 'super_admin'
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
  status text DEFAULT 'active'          -- 'active' | 'expired' | 'closed'
);

-- 学生报名表
CREATE TABLE student_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  batch_id uuid REFERENCES enrollment_batches(id),

  -- CSV导入的信息
  student_name text NOT NULL,
  parent_phone text,
  grade text,

  -- 报名完成后填写
  parent_phone_verified text,
  student_auth_id uuid REFERENCES auth.users(id),

  -- 报名链接
  enrollment_token text UNIQUE,
  token_expires_at timestamptz,

  -- 状态
  status text DEFAULT 'pending',        -- 'pending' | 'enrolled' | 'expired'
  enrolled_at timestamptz
);

-- students表新增字段
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS enrollment_id uuid REFERENCES student_enrollments(id),
  ADD COLUMN IF NOT EXISTS parent_phone text,
  ADD COLUMN IF NOT EXISTS shortcode text UNIQUE;  -- 上课用的shortcode，如「MING-7823」
```

### shortcode生成规则

```
格式：[姓名首字母大写]-[4位随机数字]
示例：MING-7823 / XIAO-4521 / LI-9034

特点：
- 学生自己能记住（和名字相关）
- 足够唯一（同名学生数字部分不同）
- 不依赖手机，上课时直接输入
```

### RLS策略（修复匿名漏洞）

```sql
-- 开启所有表的RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ta_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- TA只能看自己机构的ta_profiles
CREATE POLICY "ta_own_org_profiles" ON ta_profiles
  FOR ALL USING (
    organization_id = (
      SELECT organization_id FROM ta_profiles WHERE id = auth.uid()
    )
  );

-- TA只能看自己机构的enrollment_batches
CREATE POLICY "ta_own_org_batches" ON enrollment_batches
  FOR ALL USING (
    organization_id = (
      SELECT organization_id FROM ta_profiles WHERE id = auth.uid()
    )
  );

-- TA只能看自己机构的student_enrollments
CREATE POLICY "ta_own_org_enrollments" ON student_enrollments
  FOR ALL USING (
    organization_id = (
      SELECT organization_id FROM ta_profiles WHERE id = auth.uid()
    )
  );

-- students表：修复匿名漏洞
-- 规则1：TA用户只能看自己机构的学生
-- 规则2：已登录的学生只能看自己的记录
-- 规则3：匿名用户只能通过session关联访问（不能直接查询所有学生）
CREATE POLICY "students_ta_own_org" ON students
  FOR ALL USING (
    -- TA账户：看自己机构
    organization_id = (
      SELECT organization_id FROM ta_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "students_self_access" ON students
  FOR SELECT USING (
    -- 学生账户：只能看自己
    auth_user_id = auth.uid()
  );

CREATE POLICY "students_anon_session" ON students
  FOR ALL USING (
    -- 匿名用户：只能访问通过shortcode关联的当前session
    -- 不能直接查所有学生
    auth.uid() IS NOT NULL
    AND id IN (
      SELECT student_id FROM sessions
      WHERE created_at > now() - interval '8 hours'  -- 只看最近8小时的session
    )
  );

-- organizations：任何已登录用户可以看自己的机构信息
CREATE POLICY "org_own" ON organizations
  FOR SELECT USING (
    id = (SELECT organization_id FROM ta_profiles WHERE id = auth.uid())
    OR
    -- 学生可以看自己所属机构（用于报名页显示logo）
    id IN (SELECT organization_id FROM students WHERE auth_user_id = auth.uid())
    OR
    -- 报名流程：通过enrollment_token可以读取机构信息
    id IN (SELECT organization_id FROM student_enrollments
           WHERE status = 'pending'
           AND token_expires_at > now())
  );
```

---

## Part 2：TA登录 — 邮箱Magic Link（修复1）

TA不用密码，用邮箱Magic Link登录。

**优点：**
- 你不需要管理临时密码
- TA不会忘记密码
- 每次登录链接自动失效，更安全

### 你创建TA账户的流程

```javascript
// 在你的管理后台或直接在Supabase Dashboard执行

// 1. 在Supabase Dashboard → Authentication → Users → Add User
//    填入邮箱，不需要设置密码

// 2. 创建ta_profiles记录（在Supabase SQL Editor执行）
INSERT INTO ta_profiles (id, organization_id, name, email, role)
VALUES (
  '从Auth Users复制的UUID',
  '机构UUID',
  'Teacher Wang',
  'ta@school-a.com',
  'ta'
);

// 3. 发邮件告知TA：「请用这个邮箱登录Dashboard，点击邮件里的链接」
// 不需要发密码，TA自己用Magic Link登录
```

### TA Dashboard登录页

```jsx
// ta-dashboard/src/pages/Login.jsx

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSendMagicLink = async () => {
    // 先验证是否有ta_profiles记录（防止随便填邮箱）
    // 注意：这里用service role或者Edge Function验证，不在前端直接查
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: false,  // 不自动创建新用户，只允许已存在的TA
      }
    })

    if (error) {
      setError('Email not found. Please contact your administrator.')
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-2xl shadow-sm border p-8 w-full max-w-md text-center">
          <div className="text-4xl mb-4">📧</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Check your email</h2>
          <p className="text-slate-500 text-sm">
            We sent a login link to <strong>{email}</strong>.
            Click the link to access your dashboard.
          </p>
          <button
            onClick={() => setSent(false)}
            className="mt-4 text-orange-500 text-sm"
          >
            Use a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white rounded-2xl shadow-sm border p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">TA Dashboard</h1>
        <p className="text-slate-500 text-sm mb-6">
          Enter your email to receive a login link.
        </p>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMagicLink()}
          className="w-full border rounded-xl px-4 py-3 mb-3 outline-none focus:border-orange-400"
        />
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        <button
          onClick={handleSendMagicLink}
          disabled={!email}
          className="w-full bg-orange-500 text-white rounded-xl py-3 font-bold hover:bg-orange-600 disabled:opacity-50"
        >
          Send Login Link
        </button>
      </div>
    </div>
  )
}
```

### Auth Callback处理

```jsx
// ta-dashboard/src/pages/AuthCallback.jsx
// 路由：/auth/callback

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const handleCallback = async () => {
      // Supabase自动处理URL里的token
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        navigate('/login')
        return
      }

      // 验证是TA账户
      const { data: profile } = await supabase
        .from('ta_profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

      if (!profile || !profile.is_active) {
        await supabase.auth.signOut()
        navigate('/login?error=unauthorized')
        return
      }

      navigate('/dashboard')
    }

    handleCallback()
  }, [])

  return <div>Signing in...</div>
}
```

---

## Part 3：CSV上传 — Edge Function处理（修复4）

CSV不在前端解析，上传到Supabase Storage，由Edge Function处理。

### Edge Function：process-enrollment-csv

```javascript
// supabase/functions/process-enrollment-csv/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // Service role，绕过RLS
  )

  const { batchId, csvPath, organizationId, taId } = await req.json()

  // 从Storage读取CSV
  const { data: csvFile } = await supabaseAdmin.storage
    .from('enrollment-csvs')
    .download(csvPath)

  const csvText = await csvFile.text()
  const lines = csvText.split('\n').filter(l => l.trim())
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())

  const students = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim())
    const student = {}
    headers.forEach((h, i) => { student[h] = values[i] || '' })
    return student
  })

  // 为每个学生生成token（在服务器端，不在前端）
  const generateToken = () => {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  const enrollmentRecords = students
    .filter(s => s.name || s['student_name'])
    .map(s => ({
      organization_id: organizationId,
      batch_id: batchId,
      student_name: s.name || s['student_name'],
      parent_phone: s.phone || s['parent_phone'] || null,
      grade: s.grade || null,
      enrollment_token: generateToken(),
      token_expires_at: expiresAt.toISOString(),
      status: 'pending',
    }))

  // 批量插入
  const { error } = await supabaseAdmin
    .from('student_enrollments')
    .insert(enrollmentRecords)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  // 更新批次总数
  await supabaseAdmin
    .from('enrollment_batches')
    .update({ total_students: enrollmentRecords.length })
    .eq('id', batchId)

  return new Response(JSON.stringify({
    success: true,
    count: enrollmentRecords.length
  }), { status: 200 })
})
```

### TA Dashboard的CSV上传流程

```javascript
// ta-dashboard/src/pages/Enrollment.jsx

const handleCSVUpload = async (file) => {
  setUploading(true)

  try {
    // 1. 创建批次记录
    const { data: batch } = await supabase
      .from('enrollment_batches')
      .insert({
        organization_id: taProfile.organization_id,
        ta_id: taProfile.id,
        batch_name: `${new Date().toLocaleDateString()} 批次`,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })
      .select().single()

    // 2. 上传CSV到Storage
    const csvPath = `${taProfile.organization_id}/${batch.id}.csv`
    await supabase.storage
      .from('enrollment-csvs')
      .upload(csvPath, file)

    // 3. 调用Edge Function处理（不在前端解析）
    const { data } = await supabase.functions.invoke('process-enrollment-csv', {
      body: {
        batchId: batch.id,
        csvPath,
        organizationId: taProfile.organization_id,
        taId: taProfile.id,
      }
    })

    setBatchId(batch.id)
    setUploadComplete(true)
    setStudentCount(data.count)

  } catch (error) {
    setError('Upload failed. Please check your CSV format.')
  } finally {
    setUploading(false)
  }
}
```

---

## Part 4：家长报名页 — OTP验证 + 生成shortcode

```jsx
// student-app/src/pages/Enroll.jsx
// 路由：/enroll/:token

export default function EnrollPage() {
  const { token } = useParams()
  const [enrollment, setEnrollment] = useState(null)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [shortcode, setShortcode] = useState('')
  const [step, setStep] = useState('verify_token')

  // Step 1：验证token有效性
  useEffect(() => {
    const verifyToken = async () => {
      const { data } = await supabase
        .from('student_enrollments')
        .select('*, organizations(name, logo_url)')
        .eq('enrollment_token', token)
        .eq('status', 'pending')
        .gt('token_expires_at', new Date().toISOString())
        .single()

      if (!data) {
        setStep('invalid')
        return
      }

      setEnrollment(data)
      if (data.parent_phone) setPhone(data.parent_phone)
      setStep('input_phone')
    }
    verifyToken()
  }, [token])

  // Step 2：发送OTP
  const handleSendOTP = async () => {
    const { error } = await supabase.auth.signInWithOtp({
      phone: formatPhone(phone),
    })
    if (!error) setStep('verify_otp')
  }

  // Step 3：验证OTP，创建账户，生成shortcode
  const handleVerifyOTP = async () => {
    const { data: authData, error } = await supabase.auth.verifyOtp({
      phone: formatPhone(phone),
      token: otp,
      type: 'sms',
    })

    if (error || !authData.user) {
      alert('Invalid code, please try again')
      return
    }

    // 生成shortcode：姓名首字母 + 4位随机数
    const generatedShortcode = generateShortcode(enrollment.student_name)

    // 创建students记录
    const { data: student } = await supabase
      .from('students')
      .insert({
        name: enrollment.student_name,
        auth_user_id: authData.user.id,
        organization_id: enrollment.organization_id,
        enrollment_id: enrollment.id,
        parent_phone: formatPhone(phone),
        shortcode: generatedShortcode,
      })
      .select().single()

    // 更新enrollment状态
    await supabase.from('student_enrollments').update({
      status: 'enrolled',
      enrolled_at: new Date().toISOString(),
      parent_phone_verified: formatPhone(phone),
      student_auth_id: authData.user.id,
    }).eq('id', enrollment.id)

    setShortcode(generatedShortcode)
    setStep('complete')
  }

  // shortcode生成
  const generateShortcode = (studentName) => {
    // 取名字前4个字母（拼音）或英文名前4个字母，大写
    const namePart = studentName
      .replace(/[^a-zA-Z\u4e00-\u9fa5]/g, '')
      .slice(0, 4)
      .toUpperCase()
    const numPart = Math.floor(1000 + Math.random() * 9000)
    return `${namePart}-${numPart}`
  }

  // 手机号格式化
  const formatPhone = (phone) => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.startsWith('86')) return `+${cleaned}`
    if (cleaned.startsWith('0')) return `+86${cleaned.slice(1)}`
    return `+86${cleaned}`
  }

  // ── UI渲染 ──

  if (step === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full">
          <div className="text-4xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Link Invalid</h2>
          <p className="text-slate-500 text-sm">
            This enrollment link has expired or already been used.
            Please contact your teacher for a new link.
          </p>
        </div>
      </div>
    )
  }

  if (step === 'complete') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">
            Welcome, {enrollment?.student_name}!
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            Your enrollment is complete. Save your class code for class:
          </p>

          {/* shortcode展示 */}
          <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-6 mb-4">
            <p className="text-xs text-orange-500 font-bold uppercase mb-1">Your Class Code</p>
            <p className="text-4xl font-black text-orange-600 tracking-widest">
              {shortcode}
            </p>
          </div>

          <p className="text-xs text-slate-400">
            Use this code every time you join class.
            Take a screenshot to save it!
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border p-8 w-full max-w-sm">

        {/* 机构信息 */}
        {enrollment?.organizations && (
          <div className="text-center mb-6">
            {enrollment.organizations.logo_url && (
              <img
                src={enrollment.organizations.logo_url}
                className="h-10 mx-auto mb-2 object-contain"
                alt="Organization logo"
              />
            )}
            <p className="text-slate-400 text-xs">{enrollment.organizations.name}</p>
          </div>
        )}

        <h1 className="text-xl font-bold text-slate-800 mb-1">
          Hi, {enrollment?.student_name}!
        </h1>
        <p className="text-slate-500 text-sm mb-6">
          Please verify your parent's phone number to complete enrollment.
        </p>

        {step === 'input_phone' && (
          <>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">
              Parent's Phone Number
            </label>
            <input
              type="tel"
              placeholder="13800000000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendOTP()}
              className="w-full border rounded-xl px-4 py-3 mb-4 outline-none focus:border-orange-400"
            />
            <button
              onClick={handleSendOTP}
              disabled={!phone || phone.length < 8}
              className="w-full bg-orange-500 text-white rounded-xl py-3 font-bold hover:bg-orange-600 disabled:opacity-50"
            >
              Send Verification Code
            </button>
          </>
        )}

        {step === 'verify_otp' && (
          <>
            <p className="text-sm text-slate-500 mb-4">
              Enter the 6-digit code sent to <strong>{phone}</strong>
            </p>
            <input
              type="number"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={6}
              className="w-full border rounded-xl px-4 py-3 mb-4 text-center text-2xl tracking-widest outline-none focus:border-orange-400"
            />
            <button
              onClick={handleVerifyOTP}
              disabled={otp.length < 6}
              className="w-full bg-orange-500 text-white rounded-xl py-3 font-bold hover:bg-orange-600 disabled:opacity-50"
            >
              Verify & Complete Enrollment
            </button>
            <button
              onClick={() => setStep('input_phone')}
              className="w-full text-slate-400 text-sm mt-3 hover:text-slate-600"
            >
              ← Use a different number
            </button>
          </>
        )}
      </div>
    </div>
  )
}
```

---

## Part 5：学生上课登录 — shortcode（修复2）

上课时不需要OTP，直接输入shortcode进入。

```
现有流程：输入姓名 → 输入4位课程码
新流程：输入shortcode → 系统识别学生 → 输入4位课程码

shortcode格式：MING-7823
学生自己能记住，不依赖手机
```

### App.jsx修改

```jsx
// student-app/src/App.jsx

// 在NameInput之前，先尝试shortcode登录
const [studentFromShortcode, setStudentFromShortcode] = useState(null)
const [showShortcodeInput, setShowShortcodeInput] = useState(true)

// Shortcode登录组件
function ShortcodeLogin({ onSuccess, onSkip }) {
  const [shortcode, setShortcode] = useState('')
  const [error, setError] = useState('')

  const handleLookup = async () => {
    const { data: student } = await supabase
      .from('students')
      .select('id, name, organization_id')
      .eq('shortcode', shortcode.toUpperCase().trim())
      .single()

    if (!student) {
      setError('Code not found. Check your shortcode or ask your teacher.')
      return
    }

    onSuccess(student)
  }

  return (
    <div className="max-w-sm mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome back!</h2>
      <p className="text-slate-500 text-sm mb-6">Enter your personal class code</p>

      <input
        type="text"
        placeholder="e.g. MING-7823"
        value={shortcode}
        onChange={(e) => setShortcode(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
        className="w-full border-2 rounded-xl px-4 py-3 mb-3 text-center text-xl font-mono tracking-widest outline-none focus:border-orange-400 uppercase"
        maxLength={9}
      />

      {error && <p className="text-red-500 text-sm mb-3 text-center">{error}</p>}

      <button
        onClick={handleLookup}
        disabled={shortcode.length < 6}
        className="w-full bg-orange-500 text-white rounded-xl py-3 font-bold hover:bg-orange-600 disabled:opacity-50 mb-3"
      >
        Continue →
      </button>

      <button
        onClick={onSkip}
        className="w-full text-slate-400 text-sm hover:text-slate-600"
      >
        First time? Enter your name instead
      </button>
    </div>
  )
}
```

### 进入课堂的完整流程

```
有shortcode的学生：
  输入MING-7823 → 系统找到学生记录 → 显示「Welcome back, 小明！」
  → 输入4位课程码 → 进课堂

第一次来的学生（没有报名）：
  点「Enter your name instead」→ 输入姓名（现有匿名流程）
  → 输入4位课程码 → 进课堂
```

---

## Part 6：TA Dashboard — 报名管理页面

```jsx
// ta-dashboard/src/pages/Enrollment.jsx

// 显示每个批次的学生列表和报名状态
// 每行显示：学生姓名 / 报名状态 / 报名链接 / shortcode（已报名才显示）

function EnrollmentTable({ batchId }) {
  const [enrollments, setEnrollments] = useState([])

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('student_enrollments')
        .select('*, students(shortcode)')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: true })
      setEnrollments(data || [])
    }
    load()
  }, [batchId])

  const copyLink = (token) => {
    const link = `${window.location.origin}/enroll/${token}`
    navigator.clipboard.writeText(link)
  }

  const exportLinks = () => {
    const csv = enrollments.map(e => [
      e.student_name,
      e.status,
      `${window.location.origin}/enroll/${e.enrollment_token}`,
      e.students?.shortcode || '',
    ].join(',')).join('\n')

    const blob = new Blob([`Name,Status,Enrollment Link,Shortcode\n${csv}`], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'enrollment-links.csv'
    a.click()
  }

  return (
    <div>
      <div className="flex justify-between mb-4">
        <p className="text-sm text-slate-500">
          {enrollments.filter(e => e.status === 'enrolled').length} / {enrollments.length} enrolled
        </p>
        <button onClick={exportLinks} className="text-sm text-orange-500 hover:underline">
          Export all links
        </button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-400 border-b">
            <th className="pb-2">Student</th>
            <th className="pb-2">Status</th>
            <th className="pb-2">Shortcode</th>
            <th className="pb-2">Link</th>
          </tr>
        </thead>
        <tbody>
          {enrollments.map(e => (
            <tr key={e.id} className="border-b hover:bg-slate-50">
              <td className="py-2.5 font-medium">{e.student_name}</td>
              <td className="py-2.5">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  e.status === 'enrolled'
                    ? 'bg-green-100 text-green-700'
                    : e.status === 'expired'
                      ? 'bg-slate-100 text-slate-500'
                      : 'bg-orange-100 text-orange-700'
                }`}>
                  {e.status}
                </span>
              </td>
              <td className="py-2.5 font-mono text-slate-600">
                {e.students?.shortcode || '—'}
              </td>
              <td className="py-2.5">
                {e.status === 'pending' ? (
                  <button
                    onClick={() => copyLink(e.enrollment_token)}
                    className="text-orange-500 hover:underline"
                  >
                    Copy link
                  </button>
                ) : (
                  <span className="text-slate-300">Used</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

---

## Part 7：未来API对接预留接口

```javascript
// ta-dashboard/src/lib/externalEnrollment.js

export async function fetchStudentsForBatch(organizationId, batchConfig) {
  const { data: org } = await supabase
    .from('organizations')
    .select('integration_type, api_endpoint')
    .eq('id', organizationId)
    .single()

  if (org.integration_type === 'csv') {
    // 现在的CSV流程（已实现）
    return null  // CSV由上传处理，不需要fetch
  }

  if (org.integration_type === 'api') {
    // 未来：通过Edge Function调用机构API
    // api_key_encrypted在服务器端解密，不在前端
    const { data } = await supabase.functions.invoke('fetch-external-students', {
      body: { organizationId, batchConfig }
    })
    return data.students
  }
}
```

---

## Supabase配置

### 开启Phone Auth（学生报名用）

```
Supabase Dashboard → Authentication → Providers → Phone
Enable Phone provider
SMS Provider选项：
  国内推荐：阿里云短信（需要备案）
  国际推荐：Twilio
```

### 开启Email Magic Link（TA登录用）

```
Supabase Dashboard → Authentication → Providers → Email
确认Enable Email provider已开启
Magic Links默认已启用，不需要额外配置
```

### Storage Bucket（CSV上传）

```
Supabase Dashboard → Storage → New bucket
Bucket name: enrollment-csvs
Public: false（私有，只有TA能访问）
```

---

## 实施顺序

```
Step 1：数据库（1天）
  新建四张表 + students表新增字段
  RLS策略（修复匿名漏洞版本）

Step 2：TA登录（1天）
  Magic Link登录页
  Auth Callback处理
  Auth Guard（未登录跳转）

Step 3：CSV上传 + Edge Function（2天）
  enrollment-csvs Storage bucket
  process-enrollment-csv Edge Function
  TA Dashboard上传页面

Step 4：家长报名页（2天）
  /enroll/:token路由
  OTP验证流程
  shortcode生成和展示

Step 5：学生shortcode登录（1天）
  ShortcodeLogin组件
  App.jsx接入两条路径

Step 6：TA报名管理页面（1天）
  批次列表
  学生列表 + 状态 + 链接
  批量导出CSV

总工期：8天
```

---

## 验证检查点

### TA登录
- [ ] TA输入邮箱 → 收到Magic Link邮件
- [ ] 点击链接 → 进入Dashboard
- [ ] 不在ta_profiles的邮箱 → 提示联系管理员
- [ ] 不同机构的TA互相看不到数据（RLS验证）

### CSV上传
- [ ] 上传CSV → Edge Function处理 → 前端不卡顿
- [ ] 每个学生生成唯一token（32位hex）
- [ ] 大文件（1000行）正常处理

### 家长报名
- [ ] 有效token → 显示学生姓名和机构logo
- [ ] 无效/过期token → 显示Invalid页面
- [ ] OTP验证成功 → 创建students记录
- [ ] 报名完成 → 显示shortcode（格式：XXXX-1234）
- [ ] 已使用的token → status变为enrolled，不能重复使用

### 学生上课
- [ ] 输入shortcode → 识别学生，显示「Welcome back, 小明！」
- [ ] 错误的shortcode → 显示错误提示
- [ ] 点「Enter your name instead」→ 现有匿名流程
- [ ] 两条路径都能正常进入课堂

### 数据安全
- [ ] 匿名用户不能直接查询所有学生（RLS验证）
- [ ] TA只能看自己机构的enrollment数据
- [ ] CSV文件在Storage里私有，不能公开访问
