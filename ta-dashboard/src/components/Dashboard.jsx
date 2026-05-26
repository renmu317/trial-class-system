// V17 Dashboard with signal-based tracking + P3 report generation
import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Square, Users, QrCode } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { deriveAutoSignals, detectStuck } from '../lib/signalScore'
import StudentCard from './StudentCard'
import ExportButton from './ExportButton'
import SessionQRCode from './SessionQRCode'
import ReportReviewPanel from './ReportReviewPanel'

export default function Dashboard({ session, taName, onExit }) {
  const [students, setStudents] = useState([])
  const [signals, setSignals] = useState({})  // student_id -> signals object
  const [events, setEvents] = useState([])
  const [stuckStudents, setStuckStudents] = useState(new Set())
  const [sessionStatus, setSessionStatus] = useState(session.status)

  // Debug: log session info
  console.log('Dashboard loaded with session:', session)
  console.log('Session status:', session.status, '-> state:', sessionStatus)
  const [showQR, setShowQR] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [activeReport, setActiveReport] = useState(null)  // P3: Report being reviewed

  // Fetch students (5s interval)
  const fetchStudents = useCallback(async () => {
    // First fetch students
    const { data, error } = await supabase
      .from('students')
      .select('id, name, game_name, current_step, updated_at')
      .eq('session_id', session.id)
      .is('deleted_at', null)
      .order('created_at')

    if (error) {
      console.error('Failed to fetch students:', error)
      return
    }

    if (data) {
      setStudents(data)

      // Try to fetch signals separately (table might not exist yet)
      const signalsMap = {}
      try {
        const { data: signalsData } = await supabase
          .from('student_signals')
          .select('*')
          .in('student_id', data.map(s => s.id))

        if (signalsData) {
          signalsData.forEach(sig => {
            signalsMap[sig.student_id] = sig
          })
        }
      } catch (e) {
        console.warn('student_signals table may not exist yet:', e)
      }

      // Fill in empty signals for students without records
      data.forEach(s => {
        if (!signalsMap[s.id]) {
          signalsMap[s.id] = {}
        }
      })
      setSignals(signalsMap)
    }
  }, [session.id])

  // Fetch events (10s interval)
  const fetchEvents = useCallback(async () => {
    if (students.length === 0) return

    const { data, error } = await supabase
      .from('student_events')
      .select('id, student_id, event_type, data, created_at')
      .in('student_id', students.map(s => s.id))
      .order('created_at', { ascending: false })
      .limit(100)

    if (!error && data) {
      setEvents(data)

      // Detect stuck students and auto-update signals
      const newStuck = new Set()
      const signalUpdates = {}

      students.forEach(s => {
        const studentEvents = data.filter(e => e.student_id === s.id)
        const lastEventTime = studentEvents[0]?.created_at

        // Stuck detection
        const isStuck = detectStuck(lastEventTime)
        if (isStuck) newStuck.add(s.id)

        // Derive auto signals from events
        const currentSignals = signals[s.id] || {}
        const derivedSignals = deriveAutoSignals(studentEvents, currentSignals)

        // Check if we need to update stuck/recovered
        if (isStuck && !currentSignals.ps_got_stuck) {
          derivedSignals.ps_got_stuck = true
        }
        if (currentSignals.ps_got_stuck && !isStuck && studentEvents.length > 0) {
          derivedSignals.ps_recovered = true
        }

        // Track changes
        const hasChanges = Object.keys(derivedSignals).some(
          key => derivedSignals[key] !== currentSignals[key]
        )
        if (hasChanges) {
          signalUpdates[s.id] = derivedSignals
        }
      })

      setStuckStudents(newStuck)

      // Batch update signals that changed
      for (const [studentId, newSignals] of Object.entries(signalUpdates)) {
        // Update local state
        setSignals(prev => ({
          ...prev,
          [studentId]: { ...prev[studentId], ...newSignals }
        }))

        // Sync to database (upsert)
        await supabase
          .from('student_signals')
          .upsert({
            student_id: studentId,
            ...newSignals,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'student_id'
          })
      }
    }
  }, [students, signals])

  // Initial load + polling
  useEffect(() => {
    fetchStudents()
    const studentInterval = setInterval(fetchStudents, 5000)
    return () => clearInterval(studentInterval)
  }, [fetchStudents])

  // Events polling (separate to use students state)
  useEffect(() => {
    if (students.length === 0) return

    fetchEvents()
    const eventInterval = setInterval(fetchEvents, 10000)
    return () => clearInterval(eventInterval)
  }, [students.length, fetchEvents])

  // Manual refresh
  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchStudents()
    await fetchEvents()
    setRefreshing(false)
  }

  // End session
  const handleEndSession = async () => {
    if (!window.confirm('End this session? Students will enter read-only mode.')) {
      return
    }

    console.log('Ending session:', session.id)

    const { data, error } = await supabase
      .from('sessions')
      .update({ status: 'ended' })
      .eq('id', session.id)
      .select()

    if (error) {
      console.error('Failed to end session:', error)
      alert('Failed to end session: ' + error.message)
      return
    }

    console.log('Session ended successfully:', data)
    setSessionStatus('ended')

    // V17 Phase B: 压缩每个学生的 session timeline
    console.log('Compressing session timelines for', students.length, 'students...')
    const compressionResults = await Promise.allSettled(
      students.map(async (student) => {
        try {
          const { data: result, error: compressError } = await supabase.functions.invoke('compress-session', {
            body: { studentId: student.id, sessionId: session.id }
          })
          if (compressError) {
            console.warn(`Failed to compress timeline for ${student.name}:`, compressError)
            return { student: student.name, success: false, error: compressError }
          }
          console.log(`Compressed timeline for ${student.name}:`, result)
          return { student: student.name, success: true, ...result }
        } catch (err) {
          console.warn(`Error compressing timeline for ${student.name}:`, err)
          return { student: student.name, success: false, error: err.message }
        }
      })
    )

    // 统计压缩结果
    const successful = compressionResults.filter(r => r.status === 'fulfilled' && r.value?.success).length
    const failed = compressionResults.length - successful
    console.log(`Timeline compression complete: ${successful} successful, ${failed} failed`)

    // 如果有学生生成了 profile，显示提示
    const profilesGenerated = compressionResults.filter(
      r => r.status === 'fulfilled' && r.value?.profileGenerated
    ).length
    if (profilesGenerated > 0) {
      console.log(`${profilesGenerated} student profile(s) generated/updated`)
    }
  }

  // Soft delete student
  const handleDeleteStudent = async (studentId) => {
    const { error } = await supabase
      .from('students')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', studentId)

    if (!error) {
      setStudents(students.filter(s => s.id !== studentId))
      setSignals(prev => {
        const newSignals = { ...prev }
        delete newSignals[studentId]
        return newSignals
      })
    }
  }

  // Handle signal update from StudentCard
  const handleSignalUpdate = (studentId, key, value) => {
    setSignals(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [key]: value
      }
    }))
  }

  // P3: Handle report generation - open review panel
  const handleReportGenerated = (report) => {
    setActiveReport(report)
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-800">{session.name}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>TA: {taName}</span>
                <span className="flex items-center gap-1">
                  <Users size={14} />
                  {students.length} students
                </span>
                {stuckStudents.size > 0 && (
                  <span className="px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-700">
                    {stuckStudents.size} stuck
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded text-xs ${
                  sessionStatus === 'running'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-200 text-gray-600'
                }`}>
                  {sessionStatus}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowQR(!showQR)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                title="Show QR Code"
              >
                <QrCode size={20} />
              </button>

              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                title="Refresh"
              >
                <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
              </button>

              {/* End Class button - show for running sessions */}
              {sessionStatus === 'running' ? (
                <button
                  onClick={handleEndSession}
                  className="flex items-center gap-2 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium"
                >
                  <Square size={16} />
                  End Class
                </button>
              ) : (
                <span className="px-3 py-2 bg-gray-300 text-gray-600 rounded-lg text-sm">
                  Class Ended
                </span>
              )}

              <button
                onClick={onExit}
                className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm font-medium"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* QR Code popup */}
      {showQR && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-20" onClick={() => setShowQR(false)}>
          <div onClick={e => e.stopPropagation()}>
            <SessionQRCode sessionId={session.id} />
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Students grid */}
        {students.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-12 text-center">
            <div className="text-6xl mb-4">👀</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Waiting for students...</h2>
            <p className="text-gray-500 mb-4">Share the QR code or link with your students</p>
            <button
              onClick={() => setShowQR(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
            >
              <QrCode size={18} />
              Show QR Code
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {students.map(student => (
              <StudentCard
                key={student.id}
                student={student}
                signals={signals[student.id] || {}}
                events={events}
                isStuck={stuckStudents.has(student.id)}
                onDelete={handleDeleteStudent}
                onSignalUpdate={handleSignalUpdate}
                sessionId={session.id}
                onReportGenerated={handleReportGenerated}
              />
            ))}
          </div>
        )}

        {/* Bottom bar */}
        <div className="mt-6 flex items-center justify-end">
          <ExportButton
            students={students}
            signals={signals}
            sessionName={session.name}
          />
        </div>
      </main>

      {/* Legend */}
      <div className="fixed bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 text-xs">
        <div className="font-semibold text-gray-700 mb-1">Legend:</div>
        <div className="space-y-0.5 text-gray-500">
          <div>✅ = Auto-detected (read-only)</div>
          <div>☐ = TA checkbox</div>
          <div>🟢 = 100% auto | 🟡 = Mixed | 🔴 = Manual</div>
        </div>
      </div>

      {/* P3: Report Review Panel */}
      {activeReport && (
        <ReportReviewPanel
          report={activeReport}
          onClose={() => setActiveReport(null)}
          onUpdate={(updatedReport) => setActiveReport(updatedReport)}
        />
      )}
    </div>
  )
}
