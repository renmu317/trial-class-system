import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Alphanumeric characters (excluding 0/O, 1/I/L for readability)
const SHORTCODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'  // 32 characters

// Generate a unique 6-character alphanumeric shortcode
async function generateUniqueShortcode(supabase: any): Promise<string> {
  const maxAttempts = 10

  for (let i = 0; i < maxAttempts; i++) {
    // Generate random 6-character alphanumeric code
    let code = ''
    for (let j = 0; j < 6; j++) {
      code += SHORTCODE_CHARS[Math.floor(Math.random() * SHORTCODE_CHARS.length)]
    }

    // Check if it already exists
    const { data: existing } = await supabase
      .from('student_enrollments')
      .select('id')
      .eq('shortcode', code)
      .single()

    if (!existing) {
      return code
    }
  }

  throw new Error('Failed to generate unique shortcode')
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { token, phone } = await req.json()

    if (!token) {
      throw new Error('Missing token')
    }

    if (!phone) {
      throw new Error('Phone number is required')
    }

    // Create Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Look up enrollment by token
    const { data: enrollment, error: lookupError } = await supabase
      .from('student_enrollments')
      .select('id, student_name, status, batch_id, token_expires_at')
      .eq('enrollment_token', token)
      .single()

    if (lookupError || !enrollment) {
      throw new Error('Invalid enrollment link')
    }

    // Check if token is expired
    if (enrollment.token_expires_at && new Date(enrollment.token_expires_at) < new Date()) {
      throw new Error('This enrollment link has expired')
    }

    // Check if already enrolled
    if (enrollment.status === 'enrolled') {
      // Return existing shortcode
      const { data: existingData } = await supabase
        .from('student_enrollments')
        .select('shortcode')
        .eq('id', enrollment.id)
        .single()

      return new Response(
        JSON.stringify({
          success: true,
          shortcode: existingData?.shortcode,
          message: 'Already enrolled'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Generate unique shortcode
    const shortcode = await generateUniqueShortcode(supabase)

    // Update enrollment record
    const { error: updateError } = await supabase
      .from('student_enrollments')
      .update({
        parent_phone_verified: phone,
        shortcode: shortcode,
        status: 'enrolled',
        enrolled_at: new Date().toISOString()
      })
      .eq('id', enrollment.id)

    if (updateError) {
      throw new Error('Failed to complete enrollment')
    }

    // Update batch enrolled count
    await supabase.rpc('increment_enrolled_count', { batch_id_param: enrollment.batch_id })

    return new Response(
      JSON.stringify({
        success: true,
        shortcode: shortcode,
        student_name: enrollment.student_name
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
