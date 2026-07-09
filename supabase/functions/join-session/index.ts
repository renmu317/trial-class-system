import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { session_code, enrollment_id, student_name } = await req.json()

    if (!session_code || session_code.length !== 4) {
      throw new Error('Invalid session code')
    }

    // Must have either enrollment_id or student_name
    if (!enrollment_id && !student_name) {
      throw new Error('Student name is required')
    }

    // Create Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Find session by 4-digit join_code (status can be 'active' or 'running')
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, name, status, lesson_type, organization_id')
      .eq('join_code', session_code)
      .in('status', ['active', 'running'])
      .single()

    if (sessionError || !session) {
      throw new Error('Invalid or inactive session code. Please check and try again.')
    }

    // Get student name from enrollment if enrollment_id is provided
    let finalStudentName = student_name
    let finalEnrollmentId = enrollment_id

    if (enrollment_id) {
      // Verify enrollment exists and get name
      const { data: enrollment } = await supabase
        .from('student_enrollments')
        .select('id, student_name')
        .eq('id', enrollment_id)
        .single()

      if (enrollment) {
        finalStudentName = enrollment.student_name
        finalEnrollmentId = enrollment.id
      }
    }

    // Check if student already exists in this session (by enrollment_id)
    if (finalEnrollmentId) {
      const { data: existingByEnrollment } = await supabase
        .from('students')
        .select('id, name, game_name')
        .eq('session_id', session.id)
        .eq('enrollment_id', finalEnrollmentId)
        .is('deleted_at', null)
        .single()

      if (existingByEnrollment) {
        // Student already joined this session
        return new Response(
          JSON.stringify({
            success: true,
            student_id: existingByEnrollment.id,
            student_name: existingByEnrollment.name,
            game_name: existingByEnrollment.game_name,
            session_id: session.id,
            session_name: session.name,
            lesson_type: session.lesson_type,
            already_joined: true
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        )
      }
    }

    // Check if student with same name exists in this session (for deduplication)
    const { data: existingByName } = await supabase
      .from('students')
      .select('id, name, game_name, enrollment_id')
      .eq('session_id', session.id)
      .eq('name', finalStudentName)
      .is('deleted_at', null)
      .single()

    if (existingByName) {
      // If the existing student has no enrollment_id but we have one, link them
      if (!existingByName.enrollment_id && finalEnrollmentId) {
        await supabase
          .from('students')
          .update({ enrollment_id: finalEnrollmentId })
          .eq('id', existingByName.id)
      }

      return new Response(
        JSON.stringify({
          success: true,
          student_id: existingByName.id,
          student_name: existingByName.name,
          game_name: existingByName.game_name,
          session_id: session.id,
          session_name: session.name,
          lesson_type: session.lesson_type,
          already_joined: true,
          needs_confirmation: !finalEnrollmentId  // Ask for confirmation if anonymous
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Create new student record
    const deviceId = finalEnrollmentId
      ? `enrolled_${finalEnrollmentId}_${Date.now()}`
      : `anonymous_${Date.now()}`

    const { data: newStudent, error: createError } = await supabase
      .from('students')
      .insert({
        session_id: session.id,
        name: finalStudentName,
        device_id: deviceId,
        current_step: 'design',
        organization_id: session.organization_id,
        enrollment_id: finalEnrollmentId || null
      })
      .select()
      .single()

    if (createError) {
      console.error('Failed to create student:', createError)
      throw new Error('Failed to join class. Please try again.')
    }

    // Try to create signals record (table might not exist)
    try {
      await supabase
        .from('student_signals')
        .insert({ student_id: newStudent.id })
    } catch (e) {
      console.warn('Could not create signals record:', e)
    }

    return new Response(
      JSON.stringify({
        success: true,
        student_id: newStudent.id,
        student_name: newStudent.name,
        session_id: session.id,
        session_name: session.name,
        lesson_type: session.lesson_type,
        already_joined: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
