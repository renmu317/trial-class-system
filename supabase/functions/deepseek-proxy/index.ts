// DeepSeek API Proxy - Supabase Edge Function
// Keeps API key secure on server-side

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY')

    if (!DEEPSEEK_API_KEY) {
      console.error('DEEPSEEK_API_KEY not set in secrets')
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { messages, temperature = 0.7, max_tokens = 1024, response_format, model = 'deepseek-chat' } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // For vision models, skip JSON constraint injection (vision models handle images, not JSON)
    const isVisionModel = model.includes('vl') || model.includes('vision');

    // Inject JSON constraint as a separate system message at the very beginning
    // This is more effective than prepending to existing system message
    const jsonSystemMessage = {
      role: 'system',
      content: `OUTPUT FORMAT: JSON ONLY.
You are a JSON API. Every response must be a valid JSON object.
Rules:
1. First character must be {
2. Last character must be }
3. No text before or after the JSON
4. No markdown (**bold** or *italic*)
5. No \`\`\`json code blocks
If you output anything other than JSON, the system will crash.`
    }

    // Prepend the JSON constraint message (skip for vision models)
    const enhancedMessages = isVisionModel ? messages : [jsonSystemMessage, ...messages]

    // Build request body with dynamic model selection
    const requestBody: Record<string, unknown> = {
      model,  // Dynamic model selection (deepseek-chat or deepseek-vl)
      messages: enhancedMessages,
      temperature,
      max_tokens,
    }

    // Pass through response_format if provided (for JSON mode)
    if (response_format) {
      requestBody.response_format = response_format
    }

    // Call DeepSeek API
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('DeepSeek API error:', response.status, errorText)
      return new Response(
        JSON.stringify({ error: `DeepSeek API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
