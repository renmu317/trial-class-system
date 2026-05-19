/**
 * ReportPage Component
 *
 * Public report page accessible via share_token.
 * Features: bilingual display, discount tier CTA, scroll tracking, analytics.
 */

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Discount tier display config
const DISCOUNT_CONFIG = {
  '200': { amount: '$200', urgency: 'high', color: 'bg-red-500', label: 'Today Only!' },
  '100': { amount: '$100', urgency: 'medium', color: 'bg-orange-500', label: '48 Hours Left!' },
  '50': { amount: '$50', urgency: 'low', color: 'bg-yellow-500', label: 'Last Chance!' },
  'none': { amount: null, urgency: null, color: 'bg-blue-500', label: 'Enroll Now' }
}

// CTA tier messages
const CTA_MESSAGES = {
  enrolled: { en: 'Welcome to the Family!', zh: '欢迎加入我们的大家庭!' },
  hot: { en: 'Ready to Continue?', zh: '准备好继续学习了吗?' },
  warm: { en: 'Keep the Momentum Going', zh: '保持学习的势头' },
  cold: { en: 'Start Your Journey', zh: '开启你的学习之旅' }
}

export default function ReportPage({ token }) {
  const [report, setReport] = useState(null)
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lang, setLang] = useState('en') // 'en' or 'zh'
  const [hasTrackedOpen, setHasTrackedOpen] = useState(false)
  const [hasTrackedDepth, setHasTrackedDepth] = useState(false)

  const contentRef = useRef(null)

  // Fetch report by token
  useEffect(() => {
    const fetchReport = async () => {
      if (!token) {
        setError('Invalid report link')
        setLoading(false)
        return
      }

      const { data: reportData, error: reportError } = await supabase
        .from('reports')
        .select('*, students(name)')
        .eq('share_token', token)
        .single()

      if (reportError || !reportData) {
        setError('Report not found or expired')
        setLoading(false)
        return
      }

      setReport(reportData)
      setStudent(reportData.students)
      setLoading(false)

      // Track report opened (only once)
      if (!hasTrackedOpen) {
        trackSignal('rep_opened')
        setHasTrackedOpen(true)
      }
    }

    fetchReport()
  }, [token])

  // Scroll depth tracking
  useEffect(() => {
    if (!contentRef.current || !report || hasTrackedDepth) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            trackSignal('rep_read_depth')
            setHasTrackedDepth(true)
            observer.disconnect()
          }
        })
      },
      { threshold: 0.5 }
    )

    // Observe the CTA section (bottom of content)
    const ctaSection = contentRef.current.querySelector('#cta-section')
    if (ctaSection) {
      observer.observe(ctaSection)
    }

    return () => observer.disconnect()
  }, [report, hasTrackedDepth])

  // Track conversion signal
  const trackSignal = async (field) => {
    if (!report?.student_id) return

    await supabase
      .from('conversion_signals')
      .upsert({
        student_id: report.student_id,
        [field]: true
      }, {
        onConflict: 'student_id'
      })
  }

  // Handle CTA click
  const handleCtaClick = () => {
    trackSignal('rep_cta_clicked')
    // TODO: Link to enrollment page or contact form
    window.open('https://aicreativeclass.com/enroll', '_blank')
  }

  // Handle share
  const handleShare = async () => {
    trackSignal('rep_shared')

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${student?.name}'s AI Creative Class Report`,
          url: window.location.href
        })
      } catch (e) {
        // User cancelled or share failed
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(window.location.href)
      alert('Link copied to clipboard!')
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">📄</div>
          <p className="text-slate-500 font-bold">Loading report...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="text-6xl mb-4">😕</div>
          <h1 className="text-2xl font-extrabold text-slate-800 mb-2">Oops!</h1>
          <p className="text-slate-500">{error}</p>
        </div>
      </div>
    )
  }

  const discountTier = report.discount_tier || 'none'
  const discount = DISCOUNT_CONFIG[discountTier]
  const ctaMessage = CTA_MESSAGES[report.cta_tier] || CTA_MESSAGES.cold

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-800">
              {student?.name}'s Trial Report
            </h1>
            <p className="text-xs text-slate-500">AI Creative Class</p>
          </div>

          {/* Language Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setLang('en')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                lang === 'en' ? 'bg-white shadow text-slate-800' : 'text-slate-500'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => setLang('zh')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                lang === 'zh' ? 'bg-white shadow text-slate-800' : 'text-slate-500'
              }`}
            >
              中文
            </button>
          </div>
        </div>
      </header>

      {/* Discount Banner */}
      {discount.amount && (
        <div className={`${discount.color} text-white text-center py-3 px-4`}>
          <p className="font-bold text-lg">
            {lang === 'en'
              ? `Save ${discount.amount} - ${discount.label}`
              : `立减 ${discount.amount} - ${discount.label === 'Today Only!' ? '仅限今日!' : discount.label === '48 Hours Left!' ? '仅剩48小时!' : '最后机会!'}`
            }
          </p>
        </div>
      )}

      {/* Main Content */}
      <main ref={contentRef} className="max-w-2xl mx-auto px-4 py-8">
        {/* Report Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-4xl">🎮</div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {lang === 'en' ? 'Today\'s Achievement' : '今日成就'}
              </h2>
              <p className="text-slate-500 text-sm">
                {lang === 'en' ? 'Trial Class Summary' : '试课总结'}
              </p>
            </div>
          </div>

          {/* Report Content */}
          <div className="prose prose-slate max-w-none">
            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
              {lang === 'en' ? report.content_en : report.content_zh}
            </p>
          </div>
        </div>

        {/* Learning Pathway */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
            <span>🛤️</span>
            {lang === 'en' ? 'Recommended Learning Path' : '推荐学习路径'}
          </h3>

          <div className="relative pl-6 border-l-2 border-indigo-200">
            <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-indigo-500"></div>
            <p className="text-slate-700 whitespace-pre-wrap">
              {lang === 'en' ? report.pathway_en : report.pathway_zh}
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div id="cta-section" className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white text-center">
          <h3 className="text-xl font-bold mb-2">
            {lang === 'en' ? ctaMessage.en : ctaMessage.zh}
          </h3>

          {discount.amount && (
            <p className="text-indigo-100 mb-4">
              {lang === 'en'
                ? `Special offer: Save ${discount.amount} when you enroll today!`
                : `特别优惠：今日报名立减 ${discount.amount}！`
              }
            </p>
          )}

          <button
            onClick={handleCtaClick}
            className="bg-white text-indigo-600 font-bold px-8 py-3 rounded-full text-lg hover:bg-indigo-50 transition-colors shadow-lg"
          >
            {lang === 'en' ? 'Enroll Now' : '立即报名'}
          </button>

          <button
            onClick={handleShare}
            className="block mx-auto mt-4 text-indigo-200 hover:text-white text-sm underline"
          >
            {lang === 'en' ? 'Share this report' : '分享此报告'}
          </button>
        </div>

        {/* Footer */}
        <footer className="text-center text-slate-400 text-sm mt-8 pb-8">
          <p>AI Creative Class &copy; {new Date().getFullYear()}</p>
        </footer>
      </main>
    </div>
  )
}
