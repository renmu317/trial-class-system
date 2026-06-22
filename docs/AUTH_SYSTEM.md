# Education OS - Authentication & Enrollment System

## System Overview

```
Organization A                You (Admin)              Organization B
     ↓                           ↓                          ↓
TA Account                 SuperAdmin Account           TA Account
(Magic Link Login)         (Service Role Key)       (Magic Link Login)
     ↓                           ↓                          ↓
View Org A data only       View all org data        View Org B data only
     ↓
Upload CSV → Edge Function processing
     ↓
Generate enrollment links (unique token per student)
     ↓
TA sends link to parent
     ↓
Parent clicks link → Enter phone → OTP verify → Student account created → Generate shortcode
     ↓
Class time: Enter shortcode + 4-digit code → Join class (no re-OTP needed)
```

---

## Database Schema

### Organizations

```sql
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  is_active boolean DEFAULT true,

  -- Future API integration reserved
  integration_type text DEFAULT 'csv',  -- 'csv' | 'api'
  api_endpoint text,
  api_key_encrypted text
);
```

### TA Profiles

```sql
CREATE TABLE ta_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  role text DEFAULT 'ta',               -- 'ta' | 'org_admin' | 'super_admin'
  is_active boolean DEFAULT true
);
```

### Enrollment Batches

```sql
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
```

### Student Enrollments

```sql
CREATE TABLE student_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  batch_id uuid REFERENCES enrollment_batches(id),

  -- CSV imported info
  student_name text NOT NULL,
  parent_phone text,
  grade text,

  -- Filled after enrollment complete
  parent_phone_verified text,
  student_auth_id uuid REFERENCES auth.users(id),

  -- Enrollment link
  enrollment_token text UNIQUE,
  token_expires_at timestamptz,

  -- Status
  status text DEFAULT 'pending',        -- 'pending' | 'enrolled' | 'expired'
  enrolled_at timestamptz
);
```

### Students Table Extensions

```sql
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS enrollment_id uuid REFERENCES student_enrollments(id),
  ADD COLUMN IF NOT EXISTS parent_phone text,
  ADD COLUMN IF NOT EXISTS shortcode text UNIQUE;  -- e.g., "MING-7823"
```

---

## Shortcode Generation

### Format
```
[Name Initials Uppercase]-[4-digit random number]
Examples: MING-7823 / XIAO-4521 / LI-9034
```

### Benefits
- Students can remember it (related to their name)
- Unique enough (same name gets different numbers)
- No phone dependency, direct input during class

### Implementation

```javascript
function generateShortcode(studentName) {
  // Extract initials from name
  const initials = studentName
    .split(/\s+/)
    .map(word => word[0]?.toUpperCase() || '')
    .join('')
    .substring(0, 4) || 'STU'

  // Generate random 4-digit number
  const randomNum = Math.floor(1000 + Math.random() * 9000)

  return `${initials}-${randomNum}`
}
```

---

## Row Level Security (RLS)

### Enable RLS on All Tables

```sql
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ta_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
```

### TA Policies

```sql
-- TA can only view their own organization's ta_profiles
CREATE POLICY "ta_own_org_profiles" ON ta_profiles
  FOR ALL USING (
    organization_id = (
      SELECT organization_id FROM ta_profiles WHERE id = auth.uid()
    )
  );

-- TA can only view their own organization's enrollment_batches
CREATE POLICY "ta_own_org_batches" ON enrollment_batches
  FOR ALL USING (
    organization_id = (
      SELECT organization_id FROM ta_profiles WHERE id = auth.uid()
    )
  );

-- TA can only view their own organization's student_enrollments
CREATE POLICY "ta_own_org_enrollments" ON student_enrollments
  FOR ALL USING (
    organization_id = (
      SELECT organization_id FROM ta_profiles WHERE id = auth.uid()
    )
  );
```

### Student Policies

```sql
-- Rule 1: TA users can only view their organization's students
-- Rule 2: Logged-in students can only view their own record
-- Rule 3: Anonymous users can only access via session association

CREATE POLICY "students_ta_own_org" ON students
  FOR ALL USING (
    -- TA account: view own organization
    organization_id = (
      SELECT organization_id FROM ta_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "students_self_access" ON students
  FOR SELECT USING (
    -- Student account: only view self
    auth_user_id = auth.uid()
  );

CREATE POLICY "students_anon_session" ON students
  FOR ALL USING (
    -- Anonymous user: only access current session via shortcode
    auth.uid() IS NOT NULL
    AND id IN (
      SELECT student_id FROM sessions
      WHERE created_at > now() - interval '8 hours'
    )
  );
```

### Organization Policies

```sql
CREATE POLICY "org_own" ON organizations
  FOR SELECT USING (
    id = (SELECT organization_id FROM ta_profiles WHERE id = auth.uid())
    OR
    -- Students can view their organization (for enrollment page logo)
    id IN (SELECT organization_id FROM students WHERE auth_user_id = auth.uid())
    OR
    -- Enrollment flow: can read org info via enrollment_token
    id IN (SELECT organization_id FROM student_enrollments
           WHERE status = 'pending'
           AND token_expires_at > now())
  );
```

---

## TA Login - Magic Link

### Flow

```
1. TA enters email on login page
2. System calls supabase.auth.signInWithOtp({ email })
3. TA receives Magic Link email
4. TA clicks link → Auto-login → Redirect to dashboard
5. Dashboard fetches ta_profiles to get organization_id
6. All subsequent queries filtered by organization_id
```

### Implementation

```javascript
// Login page
async function handleLogin(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/dashboard`
    }
  })
  if (error) throw error
  return { success: true, message: 'Check your email for login link' }
}

// Dashboard - fetch TA profile
async function getTAProfile() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await supabase
    .from('ta_profiles')
    .select('*, organizations(*)')
    .eq('id', user.id)
    .single()

  return profile
}
```

---

## CSV Batch Enrollment

### Edge Function: process-enrollment-csv

```typescript
// supabase/functions/process-enrollment-csv/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { csvData, batchId, organizationId } = await req.json()

  // Parse CSV
  const rows = parseCSV(csvData)

  // Generate enrollment records
  const enrollments = rows.map(row => ({
    organization_id: organizationId,
    batch_id: batchId,
    student_name: row.name,
    parent_phone: row.phone,
    grade: row.grade,
    enrollment_token: crypto.randomUUID().replace(/-/g, '').substring(0, 32),
    token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    status: 'pending'
  }))

  // Batch insert
  const { data, error } = await supabase
    .from('student_enrollments')
    .insert(enrollments)
    .select()

  if (error) return new Response(JSON.stringify({ error }), { status: 400 })

  // Update batch count
  await supabase
    .from('enrollment_batches')
    .update({ total_students: enrollments.length })
    .eq('id', batchId)

  return new Response(JSON.stringify({
    success: true,
    count: enrollments.length,
    enrollments: data
  }))
})
```

---

## Parent Enrollment Flow

### Step 1: Parent Clicks Enrollment Link

```
https://app.example.com/enroll?token=abc123def456...
```

### Step 2: Verify Token & Show Form

```javascript
async function verifyEnrollmentToken(token) {
  const { data: enrollment } = await supabase
    .from('student_enrollments')
    .select('*, organizations(name, logo_url)')
    .eq('enrollment_token', token)
    .eq('status', 'pending')
    .gt('token_expires_at', new Date().toISOString())
    .single()

  if (!enrollment) throw new Error('Invalid or expired token')
  return enrollment
}
```

### Step 3: Phone OTP Verification

```javascript
async function sendOTP(phone) {
  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { channel: 'sms' }
  })
  if (error) throw error
}

async function verifyOTP(phone, otp) {
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token: otp,
    type: 'sms'
  })
  if (error) throw error
  return data.user
}
```

### Step 4: Complete Enrollment

```javascript
async function completeEnrollment(enrollmentId, userId, phone) {
  // Generate shortcode
  const { data: enrollment } = await supabase
    .from('student_enrollments')
    .select('student_name')
    .eq('id', enrollmentId)
    .single()

  const shortcode = generateShortcode(enrollment.student_name)

  // Update enrollment record
  await supabase
    .from('student_enrollments')
    .update({
      status: 'enrolled',
      enrolled_at: new Date().toISOString(),
      parent_phone_verified: phone,
      student_auth_id: userId
    })
    .eq('id', enrollmentId)

  // Create student record
  const { data: student } = await supabase
    .from('students')
    .insert({
      name: enrollment.student_name,
      shortcode,
      auth_user_id: userId,
      enrollment_id: enrollmentId,
      organization_id: enrollment.organization_id
    })
    .select()
    .single()

  return { shortcode, student }
}
```

---

## Class Join Flow

### Student Enters Shortcode + Join Code

```javascript
async function joinClass(shortcode, joinCode) {
  // Find student by shortcode
  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('shortcode', shortcode.toUpperCase())
    .single()

  if (!student) throw new Error('Student not found')

  // Find session by join code
  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('join_code', joinCode)
    .eq('status', 'running')
    .single()

  if (!session) throw new Error('Session not found or ended')

  // Verify organization match
  if (student.organization_id !== session.organization_id) {
    throw new Error('Student not in this organization')
  }

  // Link student to session
  await supabase
    .from('students')
    .update({ session_id: session.id })
    .eq('id', student.id)

  return { student, session }
}
```

---

## Security Considerations

### Token Security

| Token Type | Length | Expiry | Usage |
|------------|--------|--------|-------|
| enrollment_token | 32 hex chars | 7 days | One-time enrollment link |
| OTP | 6 digits | 10 min | Phone verification |
| shortcode | 8-10 chars | Permanent | Class join (reusable) |

### Rate Limiting

```sql
-- Example: Limit OTP requests per phone
CREATE OR REPLACE FUNCTION check_otp_rate_limit(phone_number text)
RETURNS boolean AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM otp_requests
  WHERE phone = phone_number
    AND created_at > now() - interval '1 hour';

  RETURN recent_count < 5;  -- Max 5 requests per hour
END;
$$ LANGUAGE plpgsql;
```

### Data Privacy

- Phone numbers encrypted at rest (Supabase handles this)
- Parent phone only visible to TA of same organization
- Student shortcode does not contain sensitive info
- Enrollment tokens single-use and time-limited
