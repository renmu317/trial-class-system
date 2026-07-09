import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EnrollmentRow {
  student_name: string
  parent_phone?: string
  grade?: string
}

// Generate a random 32-character token
function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let token = ''
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

// Parse CSV content
function parseCSV(content: string): EnrollmentRow[] {
  const lines = content.trim().split('\n')
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header and one data row')
  }

  const header = lines[0].split(',').map(h => h.trim().toLowerCase())
  // Match "name" or "姓名" but NOT "unnamed" - use word boundary or exact match
  const nameIndex = header.findIndex(h =>
    h === 'name' || h === '姓名' || h === 'student_name' || h === 'student name' ||
    h.startsWith('name') || h.endsWith('name') || h.includes('姓名')
  )
  const phoneIndex = header.findIndex(h => h.includes('phone') || h.includes('电话') || h.includes('手机'))
  const gradeIndex = header.findIndex(h => h.includes('grade') || h.includes('年级'))

  if (nameIndex === -1) {
    throw new Error('CSV must have a "name" or "姓名" column')
  }

  const rows: EnrollmentRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    const name = values[nameIndex]

    if (name) {
      rows.push({
        student_name: name,
        parent_phone: phoneIndex >= 0 ? values[phoneIndex] : undefined,
        grade: gradeIndex >= 0 ? values[gradeIndex] : undefined,
      })
    }
  }

  return rows
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Create Supabase client with user's JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify user is a TA
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Get TA profile
    const { data: taProfile, error: taError } = await supabaseClient
      .from('ta_profiles')
      .select('id, organization_id')
      .eq('id', user.id)
      .single()

    if (taError || !taProfile) {
      throw new Error('TA profile not found')
    }

    // Parse request body
    const { csv_content, batch_name, expires_days = 30 } = await req.json()

    if (!csv_content) {
      throw new Error('Missing csv_content')
    }

    // Parse CSV
    const rows = parseCSV(csv_content)

    if (rows.length === 0) {
      throw new Error('No valid rows found in CSV')
    }

    // Create service role client for inserting data
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Create enrollment batch
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expires_days)

    const { data: batch, error: batchError } = await supabaseAdmin
      .from('enrollment_batches')
      .insert({
        organization_id: taProfile.organization_id,
        ta_id: taProfile.id,
        batch_name: batch_name || `Batch ${new Date().toISOString().split('T')[0]}`,
        total_students: rows.length,
        expires_at: expiresAt.toISOString(),
        status: 'active'
      })
      .select()
      .single()

    if (batchError) {
      throw new Error(`Failed to create batch: ${batchError.message}`)
    }

    // Create enrollment records for each student
    const enrollments = rows.map(row => ({
      organization_id: taProfile.organization_id,
      batch_id: batch.id,
      student_name: row.student_name,
      parent_phone: row.parent_phone,
      grade: row.grade,
      enrollment_token: generateToken(),
      token_expires_at: expiresAt.toISOString(),
      status: 'pending'
    }))

    const { data: insertedEnrollments, error: enrollError } = await supabaseAdmin
      .from('student_enrollments')
      .insert(enrollments)
      .select('id, student_name, enrollment_token')

    if (enrollError) {
      throw new Error(`Failed to create enrollments: ${enrollError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        batch_id: batch.id,
        batch_name: batch.batch_name,
        total_students: rows.length,
        enrollments: insertedEnrollments,
        expires_at: expiresAt.toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
