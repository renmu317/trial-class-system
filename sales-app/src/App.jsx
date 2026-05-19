/**
 * Sales App - MVP Single Page
 *
 * Real-time view of students with conversion signals.
 * Highlights students with trigger signals (pa_asked_price, ch_showed_parent, ch_wants_continue).
 * P3.1: Added banners for report status, parent share, and follow-up sent.
 */

import { useState, useEffect, useRef } from 'react'
import { Flame, ThermometerSun, Snowflake, QrCode, CreditCard, Check, RefreshCw, Send, Link, Phone, X, FileText } from 'lucide-react'
import { supabase } from './lib/supabase'

// CSS animation for banners
const bannerStyles = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(-20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  .animate-slideIn {
    animation: slideIn 0.3s ease-out;
  }
`

// Inject styles
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style')
  styleEl.textContent = bannerStyles
  document.head.appendChild(styleEl)
}

// Trigger signals that alert sales
const TRIGGER_SIGNALS = ['pa_asked_price', 'ch_showed_parent', 'ch_wants_continue']

// Banner types for P3.1 Follow-up System
const BANNER_TYPES = {
  REPORT_SENT: 'report_sent',
  PARENT_SHARED: 'parent_shared',
  FOLLOWUP_SENT: 'followup_sent'
}

/**
 * Calculate discount tier and hours left
 *
 * Discount rules:
 * - $200: Deposit paid on spot (during trial class) - not time-based
 * - $100: Within 24h after trial ends
 * - $50: 24-48h after trial ends
 * - none: After 48h
 */
function getDiscountInfo(sessionEndTime, depositTakenOnSpot = false) {
  // $200 only if deposit was paid on spot
  if (depositTakenOnSpot) return { tier: '200', hoursLeft: null, label: 'On-Spot' }

  if (!sessionEndTime) return { tier: 'none', hoursLeft: 0 }

  const endTime = new Date(sessionEndTime)
  const now = new Date()
  const hoursDiff = (now - endTime) / (1000 * 60 * 60)

  if (hoursDiff < 24) return { tier: '100', hoursLeft: Math.max(0, Math.floor(24 - hoursDiff)) }
  if (hoursDiff < 48) return { tier: '50', hoursLeft: Math.max(0, Math.floor(48 - hoursDiff)) }
  return { tier: 'none', hoursLeft: 0 }
}

/**
 * Banner component for report/follow-up status notifications
 */
function StatusBanner({ type, studentName, intentTier, discountInfo, onDismiss }) {
  const configs = {
    [BANNER_TYPES.REPORT_SENT]: {
      bg: 'bg-amber-50',
      border: 'border-amber-400',
      icon: Send,
      iconColor: 'text-amber-600',
      title: `${studentName}'s report has been sent`,
      subtitle: 'Waiting for parent to open. Follow up by phone if not opened in 24h.',
      titleColor: 'text-amber-800',
      subtitleColor: 'text-amber-700'
    },
    [BANNER_TYPES.PARENT_SHARED]: {
      bg: 'bg-blue-50',
      border: 'border-blue-400',
      icon: Link,
      iconColor: 'text-blue-600',
      title: `${studentName}'s parent shared the report`,
      subtitle: 'Family is discussing. Good time to follow up!',
      titleColor: 'text-blue-800',
      subtitleColor: 'text-blue-700'
    },
    [BANNER_TYPES.FOLLOWUP_SENT]: {
      bg: 'bg-pink-50',
      border: 'border-pink-400',
      icon: Phone,
      iconColor: 'text-pink-600',
      title: `${studentName}'s follow-up sent. Please call/text now!`,
      subtitle: intentTier && discountInfo && discountInfo.tier !== 'none'
        ? `Intent: ${intentTier} | Discount: -$${discountInfo.tier}${discountInfo.hoursLeft !== null ? ` (~${discountInfo.hoursLeft}h left)` : ' (On-Spot)'}`
        : intentTier
          ? `Intent: ${intentTier}`
          : 'Ready for phone follow-up',
      titleColor: 'text-pink-800',
      subtitleColor: 'text-pink-700'
    }
  }

  const config = configs[type]
  if (!config) return null

  const Icon = config.icon

  return (
    <div className={`${config.bg} border-l-4 ${config.border} p-3 rounded-r-lg mb-3 relative animate-slideIn`}>
      <button
        onClick={onDismiss}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${config.iconColor} mt-0.5`} />
        <div>
          <div className={`font-medium text-sm ${config.titleColor}`}>{config.title}</div>
          <div className={`text-xs ${config.subtitleColor} mt-0.5`}>{config.subtitle}</div>
        </div>
      </div>
    </div>
  )
}

// Intent tier icons
const INTENT_ICONS = {
  Hot: Flame,
  Warm: ThermometerSun,
  Cold: Snowflake
}

function StudentRow({ student, signals, report, onUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)

  // Check for trigger signals
  const hasTrigger = TRIGGER_SIGNALS.some(key => signals[key])
  const triggerCount = TRIGGER_SIGNALS.filter(key => signals[key]).length

  // Report status
  const hasReport = !!report?.sent_at
  const hasFollowup = !!report?.followup_sent_at
  // Always show -$200 if deposit taken, otherwise calculate from report time
  const discountInfo = signals.sale_deposit_taken
    ? { tier: '200', hoursLeft: null, label: 'On-Spot' }
    : (report ? getDiscountInfo(report.created_at, false) : null)

  // Update a sale field
  const handleSaleUpdate = async (field, value) => {
    setSaving(true)

    const { error } = await supabase
      .from('conversion_signals')
      .upsert({
        student_id: student.id,
        session_id: student.session_id,
        [field]: value,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'student_id'
      })

    if (!error) {
      onUpdate(student.id, field, value)
    }

    setSaving(false)
  }

  // Toggle intent tier
  const handleIntentTier = async (tier) => {
    const newTier = signals.sale_intent_tier === tier ? null : tier
    await handleSaleUpdate('sale_intent_tier', newTier)
  }

  return (
    <div className={`bg-white rounded-lg shadow ${hasTrigger ? 'ring-2 ring-orange-400' : ''}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          {/* Hot indicator */}
          {hasTrigger && (
            <div className="relative">
              <Flame className="w-6 h-6 text-orange-500 animate-pulse" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                {triggerCount}
              </span>
            </div>
          )}

          <div className="text-left">
            <div className="font-semibold text-gray-800">{student.name}</div>
            {student.game_name && (
              <div className="text-sm text-gray-500">"{student.game_name}"</div>
            )}
          </div>
        </div>

        {/* Quick status icons */}
        <div className="flex items-center gap-2">
          {/* Report status */}
          {hasReport && (
            <div className="relative">
              <FileText className={`w-5 h-5 ${hasFollowup ? 'text-pink-500' : 'text-amber-500'}`} />
              {hasFollowup && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-pink-500 rounded-full" />
              )}
            </div>
          )}
          {signals.sale_qr_shown && (
            <QrCode className="w-5 h-5 text-green-500" />
          )}
          {signals.sale_deposit_taken && (
            <CreditCard className="w-5 h-5 text-green-500" />
          )}
          {signals.sale_intent_tier && (
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
              signals.sale_intent_tier === 'Hot' ? 'bg-red-100 text-red-700' :
              signals.sale_intent_tier === 'Warm' ? 'bg-orange-100 text-orange-700' :
              'bg-blue-100 text-blue-700'
            }`}>
              {signals.sale_intent_tier}
            </span>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t">
          {/* Trigger signals display */}
          <div className="pt-3">
            <div className="text-xs text-gray-500 mb-2">Trigger Signals:</div>
            <div className="flex flex-wrap gap-2">
              {signals.pa_asked_price && (
                <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-sm">
                  Asked price
                </span>
              )}
              {signals.ch_showed_parent && (
                <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-sm">
                  Showed parent
                </span>
              )}
              {signals.ch_wants_continue && (
                <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-sm">
                  Wants to continue
                </span>
              )}
              {!hasTrigger && (
                <span className="text-gray-400 text-sm">No trigger signals yet</span>
              )}
            </div>
          </div>

          {/* Report status - P3.1 */}
          {hasReport && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 mb-2">Report Status:</div>
              <div className="flex flex-wrap gap-2">
                <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-sm flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  Report sent
                </span>
                {hasFollowup && (
                  <span className="bg-pink-100 text-pink-700 px-2 py-1 rounded text-sm flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    Follow-up sent
                  </span>
                )}
                {signals.rep_opened && (
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-sm">
                    Opened
                  </span>
                )}
                {signals.rep_shared && (
                  <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm flex items-center gap-1">
                    <Link className="w-3 h-3" />
                    Shared
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Discount info - shows even without report if deposit taken */}
          {discountInfo && discountInfo.tier !== 'none' && (
            <div className="bg-green-50 rounded-lg p-3 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Current Discount:
              </div>
              <div className="font-bold text-green-600 text-lg">
                -${discountInfo.tier}
                <span className="text-xs font-normal text-gray-500 ml-1">
                  {discountInfo.hoursLeft !== null ? `(${discountInfo.hoursLeft}h left)` : '(On-Spot)'}
                </span>
              </div>
            </div>
          )}

          {/* Other signals summary */}
          <div className="text-xs text-gray-500">
            Other: {signals.pa_stayed && 'Stayed '}{signals.pa_photo && 'Photo '}{signals.pa_leaned_in && 'Leaned in '}{signals.pa_surprised && 'Surprised '}{signals.ch_explained_parent && 'Explained'}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleSaleUpdate('sale_qr_shown', !signals.sale_qr_shown)}
              disabled={saving}
              className={`flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${
                signals.sale_qr_shown
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <QrCode className="w-5 h-5" />
              QR Shown
              {signals.sale_qr_shown && <Check className="w-4 h-4" />}
            </button>

            <button
              onClick={() => handleSaleUpdate('sale_deposit_taken', !signals.sale_deposit_taken)}
              disabled={saving}
              className={`flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors ${
                signals.sale_deposit_taken
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              Deposit
              {signals.sale_deposit_taken && <Check className="w-4 h-4" />}
            </button>
          </div>

          {/* Intent tier buttons */}
          <div className="flex gap-2">
            {['Hot', 'Warm', 'Cold'].map(tier => {
              const Icon = INTENT_ICONS[tier]
              const isActive = signals.sale_intent_tier === tier

              return (
                <button
                  key={tier}
                  onClick={() => handleIntentTier(tier)}
                  disabled={saving}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-medium transition-colors ${
                    isActive
                      ? tier === 'Hot' ? 'bg-red-500 text-white' :
                        tier === 'Warm' ? 'bg-orange-500 text-white' :
                        'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tier}
                </button>
              )
            })}
          </div>

          {/* Notes */}
          <div>
            <textarea
              placeholder="Notes..."
              value={signals.sale_notes || ''}
              onChange={(e) => handleSaleUpdate('sale_notes', e.target.value)}
              className="w-full p-2 border rounded-lg text-sm resize-none h-20"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [students, setStudents] = useState([])
  const [signals, setSignals] = useState({})  // student_id -> signals
  const [reports, setReports] = useState({})  // student_id -> report
  const [banners, setBanners] = useState([])  // Array of { id, type, studentId, studentName, timestamp }
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Refs to access latest state in Realtime callbacks (avoid stale closure)
  const studentsRef = useRef(students)
  const reportsRef = useRef(reports)
  const signalsRef = useRef(signals)

  useEffect(() => { studentsRef.current = students }, [students])
  useEffect(() => { reportsRef.current = reports }, [reports])
  useEffect(() => { signalsRef.current = signals }, [signals])

  // Fetch latest session and its students
  const fetchData = async () => {
    // Get latest running session
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('status', 'running')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (sessionError || !sessionData) {
      setSession(null)
      setStudents([])
      setLoading(false)
      return
    }

    setSession(sessionData)

    // Fetch students
    const { data: studentsData } = await supabase
      .from('students')
      .select('*')
      .eq('session_id', sessionData.id)
      .is('deleted_at', null)
      .order('created_at')

    if (studentsData) {
      setStudents(studentsData)

      // Fetch conversion signals
      const { data: signalsData } = await supabase
        .from('conversion_signals')
        .select('*')
        .in('student_id', studentsData.map(s => s.id))

      if (signalsData) {
        const signalsMap = {}
        signalsData.forEach(sig => {
          signalsMap[sig.student_id] = sig
        })
        setSignals(signalsMap)
      }

      // Fetch reports for P3.1
      const { data: reportsData } = await supabase
        .from('reports')
        .select('*')
        .in('student_id', studentsData.map(s => s.id))

      if (reportsData) {
        const reportsMap = {}
        reportsData.forEach(rep => {
          reportsMap[rep.student_id] = rep
        })
        setReports(reportsMap)
      }
    }

    setLoading(false)
  }

  // Initial fetch
  useEffect(() => {
    fetchData()
  }, [])

  // Realtime subscription for conversion_signals
  useEffect(() => {
    if (!session) return

    const channel = supabase
      .channel('conversion_signals_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversion_signals',
          filter: `session_id=eq.${session.id}`
        },
        (payload) => {
          if (payload.new) {
            setSignals(prev => ({
              ...prev,
              [payload.new.student_id]: payload.new
            }))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session?.id])

  // P3.1: Realtime subscription for reports table (report sent, parent shared, followup sent)
  useEffect(() => {
    if (!session) return

    const channel = supabase
      .channel('reports_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reports',
          filter: `session_id=eq.${session.id}`
        },
        (payload) => {
          console.log('[P3.1] Reports Realtime event:', payload)
          if (payload.new) {
            const report = payload.new
            const student = studentsRef.current.find(s => s.id === report.student_id)
            const studentName = student?.name || 'Student'
            const oldReport = reportsRef.current[report.student_id]

            console.log('[P3.1] Report update:', { studentName, oldReport, newReport: report })

            // Update reports state
            setReports(prev => ({
              ...prev,
              [report.student_id]: report
            }))

            // Check for banner triggers
            const newBanners = []

            // Report just sent (sent_at changed from null to a value)
            if (report.sent_at && (!oldReport || !oldReport.sent_at)) {
              console.log('[P3.1] Triggering REPORT_SENT banner')
              newBanners.push({
                id: `report_sent_${report.id}_${Date.now()}`,
                type: BANNER_TYPES.REPORT_SENT,
                studentId: report.student_id,
                studentName,
                timestamp: Date.now()
              })
            }

            // Follow-up just sent
            if (report.followup_sent_at && (!oldReport || !oldReport.followup_sent_at)) {
              console.log('[P3.1] Triggering FOLLOWUP_SENT banner')
              const sig = signalsRef.current[report.student_id] || {}
              const discountInfo = getDiscountInfo(report.created_at, sig.sale_deposit_taken)
              newBanners.push({
                id: `followup_sent_${report.id}_${Date.now()}`,
                type: BANNER_TYPES.FOLLOWUP_SENT,
                studentId: report.student_id,
                studentName,
                intentTier: sig.sale_intent_tier,
                discountInfo,
                timestamp: Date.now()
              })
            }

            if (newBanners.length > 0) {
              console.log('[P3.1] Adding banners:', newBanners)
              setBanners(prev => [...newBanners, ...prev].slice(0, 5)) // Keep max 5 banners
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session?.id])

  // P3.1: Realtime subscription for conversion_signals rep_shared changes
  useEffect(() => {
    if (!session) return

    const channel = supabase
      .channel('rep_shared_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversion_signals',
          filter: `session_id=eq.${session.id}`
        },
        (payload) => {
          console.log('[P3.1] Conversion signals UPDATE:', payload)
          if (payload.new && payload.old) {
            // Check if rep_shared just became true
            if (payload.new.rep_shared && !payload.old.rep_shared) {
              console.log('[P3.1] rep_shared became true!')
              const student = studentsRef.current.find(s => s.id === payload.new.student_id)
              const studentName = student?.name || 'Student'

              setBanners(prev => [{
                id: `parent_shared_${payload.new.student_id}_${Date.now()}`,
                type: BANNER_TYPES.PARENT_SHARED,
                studentId: payload.new.student_id,
                studentName,
                timestamp: Date.now()
              }, ...prev].slice(0, 5))
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session?.id])

  // Dismiss a banner
  const dismissBanner = (bannerId) => {
    setBanners(prev => prev.filter(b => b.id !== bannerId))
  }

  // Also poll students every 10s for new joins
  useEffect(() => {
    if (!session) return

    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('students')
        .select('*')
        .eq('session_id', session.id)
        .is('deleted_at', null)
        .order('created_at')

      if (data) {
        setStudents(data)
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [session?.id])

  // Handle local signal update
  const handleSignalUpdate = (studentId, field, value) => {
    setSignals(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }))
  }

  // Manual refresh
  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  // Sort students: triggered ones first
  const sortedStudents = [...students].sort((a, b) => {
    const aTriggered = TRIGGER_SIGNALS.some(key => signals[a.id]?.[key])
    const bTriggered = TRIGGER_SIGNALS.some(key => signals[b.id]?.[key])
    if (aTriggered && !bTriggered) return -1
    if (!aTriggered && bTriggered) return 1
    return 0
  })

  // Stats
  const hotCount = students.filter(s => TRIGGER_SIGNALS.some(key => signals[s.id]?.[key])).length
  const depositCount = students.filter(s => signals[s.id]?.sale_deposit_taken).length
  const reportCount = students.filter(s => reports[s.id]?.sent_at).length

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">💰</div>
          <p className="text-gray-500 font-bold">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">No Active Session</h1>
          <p className="text-gray-500 mb-4">
            Waiting for a trial class to start...
          </p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Refresh
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-800">{session.name}</h1>
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <span>{students.length} students</span>
                {hotCount > 0 && (
                  <span className="flex items-center gap-1 text-orange-600 font-medium">
                    <Flame className="w-4 h-4" />
                    {hotCount} hot
                  </span>
                )}
                {depositCount > 0 && (
                  <span className="flex items-center gap-1 text-green-600 font-medium">
                    <CreditCard className="w-4 h-4" />
                    {depositCount} deposits
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* P3.1: Status Banners */}
      {banners.length > 0 && (
        <div className="max-w-lg mx-auto px-4 pt-4">
          {banners.map(banner => (
            <StatusBanner
              key={banner.id}
              type={banner.type}
              studentName={banner.studentName}
              intentTier={banner.intentTier}
              discountInfo={banner.discountInfo}
              onDismiss={() => dismissBanner(banner.id)}
            />
          ))}
        </div>
      )}

      {/* Student list */}
      <main className={`max-w-lg mx-auto px-4 ${banners.length > 0 ? 'pt-2' : 'py-4'} pb-4 space-y-3`}>
        {sortedStudents.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-center">
            <div className="text-4xl mb-2">👀</div>
            <p className="text-gray-500">Waiting for students to join...</p>
          </div>
        ) : (
          sortedStudents.map(student => (
            <StudentRow
              key={student.id}
              student={student}
              signals={signals[student.id] || {}}
              report={reports[student.id]}
              onUpdate={handleSignalUpdate}
            />
          ))
        )}
      </main>

      {/* Bottom stats bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
        <div className="max-w-lg mx-auto px-4 py-3 flex justify-around">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-800">{students.length}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-500">{hotCount}</div>
            <div className="text-xs text-gray-500">Hot Leads</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-500">{reportCount}</div>
            <div className="text-xs text-gray-500">Reports</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500">{depositCount}</div>
            <div className="text-xs text-gray-500">Deposits</div>
          </div>
        </div>
      </div>
    </div>
  )
}
