import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password, admin_key } = await req.json()

    // Simple admin key check (you should change this)
    if (admin_key !== 'ta-admin-2026') {
      throw new Error('Unauthorized')
    }

    if (!email || !password) {
      throw new Error('Email and password required')
    }

    // Create admin client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Find user by email
    const { data: users, error: listError } = await supabase.auth.admin.listUsers()

    if (listError) {
      throw new Error('Failed to list users: ' + listError.message)
    }

    const user = users.users.find(u => u.email === email)

    if (!user) {
      throw new Error('User not found')
    }

    // Update user password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: password }
    )

    if (updateError) {
      throw new Error('Failed to update password: ' + updateError.message)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Password set successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
