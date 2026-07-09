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
    const { token } = await req.json()

    if (!token) {
      throw new Error('Missing token')
    }

    // Create Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Look up enrollment by token
    const { data: enrollment, error } = await supabase
      .from('student_enrollments')
      .select('id, student_name, grade, status, shortcode, token_expires_at')
      .eq('enrollment_token', token)
      .single()

    if (error) {
      console.error('Query error:', error)
      throw new Error(`DB error: ${error.message}`)
    }
    if (!enrollment) {
      throw new Error('Token not found in database')
    }

    // Check if token is expired
    if (enrollment.token_expires_at && new Date(enrollment.token_expires_at) < new Date()) {
      throw new Error('This enrollment link has expired')
    }

    // Check status
    if (enrollment.status === 'expired') {
      throw new Error('This enrollment link has expired')
    }

    return new Response(
      JSON.stringify({
        student_name: enrollment.student_name,
        grade: enrollment.grade,
        status: enrollment.status,
        shortcode: enrollment.shortcode
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
