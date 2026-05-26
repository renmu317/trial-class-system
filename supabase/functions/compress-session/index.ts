/**
 * compress-session Edge Function
 *
 * 课程结束时压缩 session_timeline 到 session_summaries
 * 并在积累足够数据后生成 student_profiles
 *
 * 触发时机：TA Dashboard 的 End Class 按钮
 *
 * 2026-05-26: V17 Phase B 重构
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TimelineEvent {
  id: string;
  event_type: string;
  upgrade_id?: string;
  content: string;
  metadata?: Record<string, any>;
  lesson_type?: string;
}

interface UpgradeSummary {
  upgrade: string;
  best_quote: string;
  rounds: number;
}

interface SummaryData {
  lesson_type: string;
  upgrade_summaries: UpgradeSummary[];
  debug_insights: string[];
  metrics: {
    early_releases: number;
    total_upgrades: number;
    debug_sessions: number;
  };
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { studentId, sessionId } = await req.json()

    if (!studentId || !sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing studentId or sessionId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ─────────────────────────────────────────────────────
    // 1. 读取时间线
    // ─────────────────────────────────────────────────────
    const { data: timeline, error: timelineError } = await supabase
      .from('session_timeline')
      .select('*')
      .eq('student_id', studentId)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    if (timelineError) {
      console.error('Timeline query error:', timelineError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch timeline' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!timeline || timeline.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No timeline events found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ─────────────────────────────────────────────────────
    // 2. 构建摘要
    // ─────────────────────────────────────────────────────
    const upgrades = timeline.filter((e: TimelineEvent) => e.event_type === 'gate1_complete')
    const debugs = timeline.filter((e: TimelineEvent) => e.event_type === 'debug_complete')
    const earlyReleases = upgrades.filter((e: TimelineEvent) => e.metadata?.early_release).length

    const summaryData: SummaryData = {
      lesson_type: timeline[0]?.lesson_type || 'unknown',
      upgrade_summaries: upgrades.map((e: TimelineEvent) => ({
        upgrade: e.upgrade_id || 'unknown',
        best_quote: e.metadata?.best_quote || '',
        rounds: e.metadata?.actual_rounds || 0,
      })),
      debug_insights: debugs.map((e: TimelineEvent) => e.content),
      metrics: {
        early_releases: earlyReleases,
        total_upgrades: upgrades.length,
        debug_sessions: debugs.length,
      },
    }

    const summaryText = `
[Lesson ${summaryData.lesson_type} - ${new Date().toLocaleDateString()}]
Upgrades: ${summaryData.upgrade_summaries.map(u => `${u.upgrade}(${u.rounds}轮): "${u.best_quote}"`).join(' | ') || 'none'}
Debug: ${summaryData.debug_insights.join(' | ') || 'none'}
Metrics: ${summaryData.metrics.early_releases}次1轮放行, ${summaryData.metrics.debug_sessions}次debug
    `.trim()

    // ─────────────────────────────────────────────────────
    // 3. 写入 session_summaries
    // ─────────────────────────────────────────────────────
    const { error: insertError } = await supabase
      .from('session_summaries')
      .insert({
        student_id: studentId,
        session_id: sessionId,
        summary_text: summaryText,
        summary_data: summaryData,
      })

    if (insertError) {
      console.error('Insert error:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to insert summary' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ─────────────────────────────────────────────────────
    // 4. 检查是否需要生成 profile
    // ─────────────────────────────────────────────────────
    const { count } = await supabase
      .from('session_summaries')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)

    let profileGenerated = false
    if (count && count >= 3) {
      profileGenerated = await buildStudentProfile(supabase, studentId)
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: summaryText,
        profileGenerated,
        totalSessions: count,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * 构建学生画像
 */
async function buildStudentProfile(supabase: any, studentId: string): Promise<boolean> {
  try {
    // 获取最近的 session summaries
    const { data: summaries, error } = await supabase
      .from('session_summaries')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error || !summaries?.length) {
      console.error('Failed to fetch summaries for profile:', error)
      return false
    }

    // 计算统计数据
    const totalSessions = summaries.length
    const avgEarlyRelease = summaries.reduce((a: number, s: any) =>
      a + (s.summary_data?.metrics?.early_releases || 0), 0) / totalSessions
    const totalDebug = summaries.reduce((a: number, s: any) =>
      a + (s.summary_data?.metrics?.debug_sessions || 0), 0)
    const avgDebug = totalDebug / totalSessions

    // 分析优势和待改进领域
    const strengths: string[] = []
    const areasToImprove: string[] = []

    if (avgEarlyRelease >= 2) {
      strengths.push('Strong language precision - often releases in 1 round')
    }
    if (avgDebug < 1) {
      strengths.push('Low debug frequency - good prompt writing')
    }
    if (avgEarlyRelease < 1) {
      areasToImprove.push('Could be more specific in initial descriptions')
    }
    if (avgDebug >= 2) {
      areasToImprove.push('May need more practice with prompt clarity')
    }

    const profileData = {
      total_sessions: totalSessions,
      avg_early_release: Math.round(avgEarlyRelease * 10) / 10,
      debug_frequency: Math.round(avgDebug * 10) / 10,
      lesson_history: summaries.map((s: any) => s.summary_data?.lesson_type).filter(Boolean),
      strengths,
      areas_to_improve: areasToImprove,
    }

    const profileText = `Student language profile (${totalSessions} lessons):
- Early release rate: ${profileData.avg_early_release} per lesson (higher = stronger)
- Debug frequency: ${profileData.debug_frequency} per lesson
- Lesson history: ${profileData.lesson_history.join(' → ')}
${strengths.length ? `- Strengths: ${strengths.join('; ')}` : ''}
${areasToImprove.length ? `- Areas to improve: ${areasToImprove.join('; ')}` : ''}`

    // Upsert profile
    const { error: upsertError } = await supabase
      .from('student_profiles')
      .upsert({
        student_id: studentId,
        profile_text: profileText,
        profile_data: profileData,
        updated_at: new Date().toISOString(),
      })

    if (upsertError) {
      console.error('Failed to upsert profile:', upsertError)
      return false
    }

    return true

  } catch (error) {
    console.error('Profile generation error:', error)
    return false
  }
}
