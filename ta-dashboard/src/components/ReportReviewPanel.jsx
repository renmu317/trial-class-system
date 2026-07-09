/**
 * ReportReviewPanel Component
 *
 * Modal panel for reviewing, editing, and sending student reports.
 * Features: Report tab, Follow-up tab, inline editing, send via email/SMS.
 */

import { useState, useEffect } from 'react'
import { X, Mail, MessageSquare, Copy, Check, ExternalLink, Loader2, Eye, EyeOff, BookOpen, Phone, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { generateFollowUp, calculateDiscountTier, getDiscountDisplay } from '../lib/reportPrompt'

const STUDENT_APP_URL = import.meta.env.VITE_STUDENT_APP_URL || 'https://trial-class-system.vercel.app'
const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY

export default function ReportReviewPanel({ report, onClose, onUpdate }) {
  // Tab state
  const [activeTab, setActiveTab] = useState('report') // 'report' | 'followup'

  // Report content state
  const [contentZh, setContentZh] = useState(report?.content_zh || '')
  const [contentEn, setContentEn] = useState(report?.content_en || '')
  const [pathwayZh, setPathwayZh] = useState(report?.pathway_zh || '')
  const [pathwayEn, setPathwayEn] = useState(report?.pathway_en || '')

  // Follow-up content state
  const [followupZh, setFollowupZh] = useState(report?.followup_content_zh || '')
  const [followupEn, setFollowupEn] = useState(report?.followup_content_en || '')
  const [followupGenerating, setFollowupGenerating] = useState(false)
  const [followupError, setFollowupError] = useState(null)

  // Behavior data state (fetched from conversion_signals)
  const [behaviorData, setBehaviorData] = useState({
    rep_opened: report?.rep_opened || false,
    rep_read_depth: report?.rep_read_depth || false,
    rep_shared: report?.rep_shared || false
  })
  const [conversionData, setConversionData] = useState(null)

  // UI state
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [hasFollowupChanges, setHasFollowupChanges] = useState(false)

  // Share URL
  const shareUrl = `${STUDENT_APP_URL}/report/${report?.share_token}`

  // Discount tier
  const discountTier = report?.created_at ? calculateDiscountTier(report.created_at) : 'none'
  const discountDisplay = report?.created_at ? getDiscountDisplay(discountTier, report.created_at) : null

  // Student data with publish_link
  const [student, setStudent] = useState(null)

  // Fetch student data and conversion signals
  useEffect(() => {
    if (!report?.student_id) return

    const fetchData = async () => {
      // Fetch student with publish_link
      const { data: studentData } = await supabase
        .from('students')
        .select('id, name, publish_link')
        .eq('id', report.student_id)
        .single()

      if (studentData) {
        setStudent(studentData)
      }

      // Fetch conversion signals
      const { data: convData } = await supabase
        .from('conversion_signals')
        .select('sale_intent_tier')
        .eq('student_id', report.student_id)
        .single()

      if (convData) {
        setConversionData(convData)
      }
    }

    fetchData()
  }, [report?.student_id])

  // Refresh behavior data from reports table
  const refreshBehaviorData = async () => {
    if (!report?.id) return

    const { data } = await supabase
      .from('reports')
      .select('rep_opened, rep_read_depth, rep_shared')
      .eq('id', report.id)
      .single()

    if (data) {
      setBehaviorData(data)
    }
  }

  // Track report changes
  useEffect(() => {
    if (!report) return
    const changed =
      contentZh !== report.content_zh ||
      contentEn !== report.content_en ||
      pathwayZh !== report.pathway_zh ||
      pathwayEn !== report.pathway_en
    setHasChanges(changed)
  }, [contentZh, contentEn, pathwayZh, pathwayEn, report])

  // Track followup changes
  useEffect(() => {
    if (!report) return
    const changed =
      followupZh !== (report.followup_content_zh || '') ||
      followupEn !== (report.followup_content_en || '')
    setHasFollowupChanges(changed)
  }, [followupZh, followupEn, report])

  // Save report changes
  const handleSaveReport = async () => {
    if (!report?.id) return
    setSaving(true)

    const { error } = await supabase
      .from('reports')
      .update({
        content_zh: contentZh,
        content_en: contentEn,
        pathway_zh: pathwayZh,
        pathway_en: pathwayEn
      })
      .eq('id', report.id)

    setSaving(false)

    if (!error) {
      setHasChanges(false)
      if (onUpdate) {
        onUpdate({
          ...report,
          content_zh: contentZh,
          content_en: contentEn,
          pathway_zh: pathwayZh,
          pathway_en: pathwayEn
        })
      }
    }
  }

  // Save followup changes
  const handleSaveFollowup = async () => {
    if (!report?.id) return
    setSaving(true)

    const { error } = await supabase
      .from('reports')
      .update({
        followup_content_zh: followupZh,
        followup_content_en: followupEn
      })
      .eq('id', report.id)

    setSaving(false)

    if (!error) {
      setHasFollowupChanges(false)
      if (onUpdate) {
        onUpdate({
          ...report,
          followup_content_zh: followupZh,
          followup_content_en: followupEn
        })
      }
    }
  }

  // Generate follow-up message using AI
  const handleGenerateFollowup = async () => {
    if (!DEEPSEEK_API_KEY) {
      setFollowupError('DeepSeek API key not configured')
      return
    }

    setFollowupGenerating(true)
    setFollowupError(null)

    try {
      // Refresh behavior data first
      await refreshBehaviorData()

      const reportData = {
        content_zh: contentZh,
        content_en: contentEn,
        pathway_zh: pathwayZh,
        pathway_en: pathwayEn
      }

      const result = await generateFollowUp(
        DEEPSEEK_API_KEY,
        reportData,
        behaviorData,
        conversionData || {},
        discountTier
      )

      setFollowupZh(result.followup_zh)
      setFollowupEn(result.followup_en)

    } catch (err) {
      console.error('Follow-up generation failed:', err)
      setFollowupError(err.message)
    }

    setFollowupGenerating(false)
  }

  // Copy share link
  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Send report via email
  const handleSendReportEmail = () => {
    const subject = encodeURIComponent(`${report.student_name}'s Trial Class Report`)
    let bodyText = `Hi,\n\nHere is ${report.student_name}'s trial class report:\n\n${shareUrl}`

    // Include game link if available
    if (student?.publish_link) {
      bodyText += `\n\nPlay ${report.student_name}'s game:\n${student.publish_link}`
    }

    bodyText += `\n\nBest regards,\nAI Creative Class`
    const body = encodeURIComponent(bodyText)
    window.open(`mailto:?subject=${subject}&body=${body}`)
    markReportSent()
  }

  // Send report via SMS
  const handleSendReportSMS = () => {
    let bodyText = `${report.student_name}'s AI Creative Class trial report: ${shareUrl}`

    // Include game link if available
    if (student?.publish_link) {
      bodyText += `\n\nPlay the game: ${student.publish_link}`
    }

    const body = encodeURIComponent(bodyText)
    window.open(`sms:?body=${body}`)
    markReportSent()
  }

  // Mark report as sent
  const markReportSent = async () => {
    if (!report?.id || report.sent_at) return
    await supabase
      .from('reports')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', report.id)
  }

  // Send followup via email
  const handleSendFollowupEmail = () => {
    const subject = encodeURIComponent(`Following up on ${report.student_name}'s Trial Class`)
    const body = encodeURIComponent(followupEn || followupZh)
    window.open(`mailto:?subject=${subject}&body=${body}`)
    markFollowupSent()
  }

  // Send followup via SMS
  const handleSendFollowupSMS = () => {
    const body = encodeURIComponent(followupEn || followupZh)
    window.open(`sms:?body=${body}`)
    markFollowupSent()
  }

  // Mark followup as sent
  const markFollowupSent = async () => {
    if (!report?.id) return
    await supabase
      .from('reports')
      .update({ followup_sent_at: new Date().toISOString() })
      .eq('id', report.id)
  }

  if (!report) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              {report.student_name}
            </h2>
            <div className="flex items-center gap-3 text-sm">
              <span className={`font-medium ${
                report.cta_tier === 'hot' ? 'text-red-600' :
                report.cta_tier === 'warm' ? 'text-orange-600' :
                report.cta_tier === 'enrolled' ? 'text-green-600' :
                'text-gray-600'
              }`}>
                {report.cta_tier?.toUpperCase()}
              </span>
              {discountDisplay?.amount && (
                <span className="text-blue-600">
                  -{discountDisplay.amount} ({discountDisplay.hoursLeft}h left)
                </span>
              )}
              {report.sent_at && (
                <span className="text-green-600">Report Sent</span>
              )}
              {report.followup_sent_at && (
                <span className="text-pink-600">Follow-up Sent</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6">
          <button
            onClick={() => setActiveTab('report')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'report'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <BookOpen size={16} className="inline mr-1.5" />
            Report
          </button>
          <button
            onClick={() => setActiveTab('followup')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'followup'
                ? 'border-pink-500 text-pink-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Phone size={16} className="inline mr-1.5" />
            Follow-up
            {report.followup_sent_at && <Check size={14} className="inline ml-1 text-green-500" />}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'report' ? (
            /* Report Tab */
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Chinese Report */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-700">CN Chinese</h3>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Narrative</label>
                    <textarea
                      value={contentZh}
                      onChange={(e) => setContentZh(e.target.value)}
                      className="w-full h-40 p-3 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Learning Pathway</label>
                    <textarea
                      value={pathwayZh}
                      onChange={(e) => setPathwayZh(e.target.value)}
                      className="w-full h-24 p-3 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* English Report */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-700">EN English</h3>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Narrative</label>
                    <textarea
                      value={contentEn}
                      onChange={(e) => setContentEn(e.target.value)}
                      className="w-full h-40 p-3 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Learning Pathway</label>
                    <textarea
                      value={pathwayEn}
                      onChange={(e) => setPathwayEn(e.target.value)}
                      className="w-full h-24 p-3 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Share Links */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg space-y-4">
                {/* Game Link (from student's publish_link) */}
                {student?.publish_link && (
                  <div>
                    <label className="text-xs text-gray-500 mb-2 block flex items-center gap-1">
                      <span className="text-lg">🎮</span> Game Link
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={student.publish_link}
                        readOnly
                        className="flex-1 px-3 py-2 bg-white border rounded-lg text-sm text-gray-600"
                      />
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(student.publish_link)
                          setCopied(true)
                          setTimeout(() => setCopied(false), 2000)
                        }}
                        className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          copied ? 'bg-green-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                        }`}
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                      <a
                        href={student.publish_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium text-white"
                      >
                        <ExternalLink size={16} />
                        Play
                      </a>
                    </div>
                  </div>
                )}

                {/* Report Link */}
                <div>
                  <label className="text-xs text-gray-500 mb-2 block">Report Link</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={shareUrl}
                      readOnly
                      className="flex-1 px-3 py-2 bg-white border rounded-lg text-sm text-gray-600"
                    />
                    <button
                      onClick={handleCopyLink}
                      className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        copied ? 'bg-green-500 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      }`}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <a
                      href={`${shareUrl}?t=${Date.now()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium text-gray-700"
                    >
                      <ExternalLink size={16} />
                      Preview
                    </a>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Follow-up Tab */
            <>
              {/* Behavior Status */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700">Parent Behavior</label>
                  <button
                    onClick={refreshBehaviorData}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <RefreshCw size={12} />
                    Refresh
                  </button>
                </div>
                <div className="flex flex-wrap gap-3">
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${
                    behaviorData.rep_opened ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {behaviorData.rep_opened ? <Eye size={14} /> : <EyeOff size={14} />}
                    {behaviorData.rep_opened ? 'Opened' : 'Not Opened'}
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${
                    behaviorData.rep_read_depth ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {behaviorData.rep_read_depth ? 'Read Complete' : 'Not Finished'}
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${
                    behaviorData.rep_shared ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {behaviorData.rep_shared ? 'Shared' : 'Not Shared'}
                  </div>
                  {conversionData?.sale_intent_tier && (
                    <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                      conversionData.sale_intent_tier === 'Hot' ? 'bg-red-100 text-red-700' :
                      conversionData.sale_intent_tier === 'Warm' ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      Intent: {conversionData.sale_intent_tier}
                    </div>
                  )}
                </div>
              </div>

              {/* Generate Button */}
              <div className="mb-4">
                <button
                  onClick={handleGenerateFollowup}
                  disabled={followupGenerating}
                  className="flex items-center gap-2 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {followupGenerating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={16} />
                      Generate Follow-up Message
                    </>
                  )}
                </button>
                {followupError && (
                  <p className="text-sm text-red-600 mt-2">{followupError}</p>
                )}
              </div>

              {/* Follow-up Content */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Chinese Follow-up</label>
                  <textarea
                    value={followupZh}
                    onChange={(e) => setFollowupZh(e.target.value)}
                    placeholder="Click 'Generate' to create follow-up message..."
                    className="w-full h-40 p-3 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">English Follow-up</label>
                  <textarea
                    value={followupEn}
                    onChange={(e) => setFollowupEn(e.target.value)}
                    placeholder="Click 'Generate' to create follow-up message..."
                    className="w-full h-40 p-3 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          <div className="flex items-center gap-2">
            {activeTab === 'report' && hasChanges && (
              <button
                onClick={handleSaveReport}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
            {activeTab === 'followup' && hasFollowupChanges && (
              <button
                onClick={handleSaveFollowup}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Follow-up'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'report' ? (
              <>
                <button
                  onClick={handleSendReportEmail}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium"
                >
                  <Mail size={16} />
                  Email Report
                </button>
                <button
                  onClick={handleSendReportSMS}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium"
                >
                  <MessageSquare size={16} />
                  SMS Report
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSendFollowupEmail}
                  disabled={!followupZh && !followupEn}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  <Mail size={16} />
                  Email Follow-up
                </button>
                <button
                  onClick={handleSendFollowupSMS}
                  disabled={!followupZh && !followupEn}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  <MessageSquare size={16} />
                  SMS Follow-up
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
