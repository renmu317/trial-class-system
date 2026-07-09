/**
 * ReportGenerator Component
 *
 * Button that generates AI report for a student using DeepSeek API.
 * Fetches student_signals + conversion_signals, calls API, saves to reports table.
 */

import { useState } from 'react'
import { FileText, Loader2, Check, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  generateReport,
  validateReportData,
  getCognitiveBehaviorData,
  buildCognitiveBehaviorSection
} from '../lib/reportPrompt'

const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY

export default function ReportGenerator({ student, signals, sessionId, onReportGenerated }) {
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [error, setError] = useState(null)
  const [reportId, setReportId] = useState(null)

  const handleGenerate = async () => {
    if (!DEEPSEEK_API_KEY) {
      setError('DeepSeek API key not configured. Add VITE_DEEPSEEK_API_KEY to .env.local')
      setStatus('error')
      return
    }

    setStatus('loading')
    setError(null)

    try {
      // 1. Fetch conversion_signals for this student
      const { data: conversionSignals } = await supabase
        .from('conversion_signals')
        .select('*')
        .eq('student_id', student.id)
        .single()

      // 2. Prepare student data
      const studentData = {
        name: student.name,
        game_name: student.game_name,
        current_step: student.current_step
      }

      // 3. Call DeepSeek API
      const reportData = await generateReport(
        DEEPSEEK_API_KEY,
        studentData,
        signals || {},
        conversionSignals || {}
      )

      // 4. Validate response
      if (!validateReportData(reportData)) {
        throw new Error('Invalid report data structure from AI')
      }

      // 5. Fetch cognitive behavior data (P7)
      const cognitiveData = await getCognitiveBehaviorData(student.id, sessionId)
      const cognitiveSectionZh = buildCognitiveBehaviorSection(cognitiveData, student.name, 'zh')
      const cognitiveSectionEn = buildCognitiveBehaviorSection(cognitiveData, student.name, 'en')

      // 6. Save to reports table (with cognitive sections appended)
      const { data: savedReport, error: saveError } = await supabase
        .from('reports')
        .insert({
          session_id: sessionId,
          student_id: student.id,
          content_zh: reportData.narrative_zh + cognitiveSectionZh,
          content_en: reportData.narrative_en + cognitiveSectionEn,
          pathway_zh: reportData.pathway_zh,
          pathway_en: reportData.pathway_en,
          cta_tier: reportData.cta_tier
        })
        .select('id, share_token')
        .single()

      if (saveError) {
        throw new Error(`Failed to save report: ${saveError.message}`)
      }

      setReportId(savedReport.id)
      setStatus('done')

      // Callback to parent
      if (onReportGenerated) {
        onReportGenerated({
          ...reportData,
          id: savedReport.id,
          share_token: savedReport.share_token,
          student_id: student.id,
          student_name: student.name
        })
      }

    } catch (err) {
      console.error('Report generation failed:', err)
      setError(err.message)
      setStatus('error')
    }
  }

  // Button variants based on status
  const getButtonContent = () => {
    switch (status) {
      case 'loading':
        return (
          <>
            <Loader2 size={14} className="animate-spin" />
            <span>Generating...</span>
          </>
        )
      case 'done':
        return (
          <>
            <Check size={14} />
            <span>Report Ready</span>
          </>
        )
      case 'error':
        return (
          <>
            <AlertCircle size={14} />
            <span>Retry</span>
          </>
        )
      default:
        return (
          <>
            <FileText size={14} />
            <span>Generate Report</span>
          </>
        )
    }
  }

  const buttonClass = {
    idle: 'bg-blue-500 hover:bg-blue-600 text-white',
    loading: 'bg-blue-400 text-white cursor-wait',
    done: 'bg-green-500 hover:bg-green-600 text-white',
    error: 'bg-red-500 hover:bg-red-600 text-white'
  }[status]

  return (
    <div className="mt-2">
      <button
        onClick={handleGenerate}
        disabled={status === 'loading'}
        className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${buttonClass}`}
      >
        {getButtonContent()}
      </button>

      {error && (
        <p className="text-xs text-red-600 mt-1 px-1">{error}</p>
      )}
    </div>
  )
}
