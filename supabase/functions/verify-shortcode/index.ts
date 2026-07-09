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
    const { shortcode } = await req.json()

    if (!shortcode || shortcode.length !== 6) {
      throw new Error('Invalid shortcode')
    }

    // Create Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Look up enrollment by shortcode (case-insensitive)
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('student_enrollments')
      .select('id, student_name, grade, organization_id, status')
      .eq('shortcode', shortcode.toUpperCase())
      .single()

    if (enrollmentError || !enrollment) {
      throw new Error('Invalid shortcode. Please check and try again.')
    }

    if (enrollment.status !== 'enrolled') {
      throw new Error('This shortcode is not active. Please complete enrollment first.')
    }

    // Return student identity info only (no session lookup)
    return new Response(
      JSON.stringify({
        success: true,
        student_name: enrollment.student_name,
        organization_id: enrollment.organization_id,
        enrollment_id: enrollment.id,
        grade: enrollment.grade
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
