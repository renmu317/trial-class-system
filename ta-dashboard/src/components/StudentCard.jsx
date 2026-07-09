// V17 StudentCard with signal checkboxes + conversion signals + report generation + Agent signals
import { useState, useEffect } from 'react'
import { ChevronDown, ChevronUp, Trash2, Check, AlertCircle, Users, FileText, MessageCircle, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { calculateConversionScore, getDimensionStatus } from '../lib/signalScore'
import { getAgentSessionSummary } from '../lib/reportPrompt'
import ReportGenerator from './ReportGenerator'

// Dimension display config
const DIMENSIONS = {
  competence: { label: 'COMPETENCE LOOP', emoji: '🟢', color: 'green' },
  ownership: { label: 'OWNERSHIP', emoji: '🟡', color: 'yellow' },
  persistence: { label: 'PERSISTENCE', emoji: '🟡', color: 'yellow' },
  challenge: { label: 'CHALLENGE SEED', emoji: '🟡', color: 'yellow' },
  parent: { label: 'PARENT SIGNAL', emoji: '🔴', color: 'red' }
}

// Conversion signals config (triggers sales alerts)
const CONVERSION_SIGNALS = [
  { key: 'pa_stayed', label: 'Parent stayed', trigger: false },
  { key: 'pa_photo', label: 'Parent took photo', trigger: false },
  { key: 'pa_asked_price', label: 'Asked price', trigger: true },  // Alert trigger
  { key: 'pa_leaned_in', label: 'Parent leaned in', trigger: false },
  { key: 'pa_surprised', label: 'Parent surprised', trigger: false },
  { key: 'ch_showed_parent', label: 'Showed parent', trigger: true },  // Alert trigger
  { key: 'ch_wants_continue', label: 'Wants to continue', trigger: true },  // Alert trigger
  { key: 'ch_explained_parent', label: 'Explained to parent', trigger: false }
]

function SignalCheckbox({ item, onToggle, disabled }) {
  const isAuto = item.auto
  const checked = item.value

  if (isAuto) {
    // Auto-detected: show as read-only check
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <div className={`w-4 h-4 rounded flex items-center justify-center ${
          checked ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'
        }`}>
          {checked && <Check size={12} />}
        </div>
        <span className={checked ? 'text-gray-700' : 'text-gray-400'}>{item.label}</span>
      </div>
    )
  }

  // TA checkbox: clickable
  return (
    <label className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1">
      <input
        type="checkbox"
        checked={checked || false}
        onChange={() => onToggle(item.key)}
        disabled={disabled}
        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <span className={checked ? 'text-gray-700' : 'text-gray-500'}>{item.label}</span>
    </label>
  )
}

function DimensionSection({ name, config, status, onToggle, disabled }) {
  const { label, emoji, color } = config
  const { count, total, items } = status

  const ratio = count / total
  const bgColor = ratio === 1 ? 'bg-green-50 border-green-200' :
                  ratio >= 0.5 ? 'bg-yellow-50 border-yellow-200' :
                  'bg-gray-50 border-gray-200'

  return (
    <div className={`border rounded-lg p-2 ${bgColor}`}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span>{emoji}</span>
          <span className="text-xs font-semibold text-gray-700">{label}</span>
        </div>
        <span className={`text-xs font-mono ${
          ratio === 1 ? 'text-green-600' : ratio >= 0.5 ? 'text-yellow-600' : 'text-gray-500'
        }`}>
          [{count}/{total}]
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map(item => (
          <SignalCheckbox
            key={item.key}
            item={item}
            onToggle={onToggle}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  )
}

// Conversion signals section (collapsible)
function ConversionSection({ signals, onToggle, expanded, onToggleExpand }) {
  const triggerCount = CONVERSION_SIGNALS.filter(s => s.trigger && signals[s.key]).length

  return (
    <div className={`border rounded-lg p-2 ${triggerCount > 0 ? 'bg-orange-50 border-orange-200' : 'bg-purple-50 border-purple-200'}`}>
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between mb-1.5"
      >
        <div className="flex items-center gap-1.5">
          <Users size={14} className="text-purple-600" />
          <span className="text-xs font-semibold text-gray-700">CONVERSION SIGNALS</span>
          {triggerCount > 0 && (
            <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
              {triggerCount} HOT
            </span>
          )}
        </div>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {CONVERSION_SIGNALS.map(signal => (
            <label
              key={signal.key}
              className={`flex items-center gap-1.5 text-xs cursor-pointer hover:bg-white/50 rounded px-1 -mx-1 ${
                signal.trigger ? 'font-medium' : ''
              }`}
            >
              <input
                type="checkbox"
                checked={signals[signal.key] || false}
                onChange={() => onToggle(signal.key)}
                className={`w-4 h-4 rounded ${
                  signal.trigger
                    ? 'border-orange-400 text-orange-500 focus:ring-orange-500'
                    : 'border-gray-300 text-purple-600 focus:ring-purple-500'
                }`}
              />
              <span className={signals[signal.key] ? 'text-gray-700' : 'text-gray-500'}>
                {signal.label}
                {signal.trigger && ' *'}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

export default function StudentCard({ student, signals, events, isStuck, onDelete, onSignalUpdate, sessionId, onReportGenerated }) {
  const [expanded, setExpanded] = useState(false)
  const [conversionExpanded, setConversionExpanded] = useState(false)
  const [conversionSignals, setConversionSignals] = useState({})
  const [generatedReport, setGeneratedReport] = useState(null)
  const [agentSummary, setAgentSummary] = useState(null)  // V17: Agent session summary
  const [debugSummary, setDebugSummary] = useState(null)  // Debug sessions summary
  const [agentExpanded, setAgentExpanded] = useState(false)  // Language precision expand state
  const [agentDetails, setAgentDetails] = useState([])  // Detailed agent sessions

  // Calculate conversion score and dimension status
  const conversionScore = calculateConversionScore(signals)
  const dimensionStatus = getDimensionStatus(signals)

  // Fetch conversion signals on mount and when student changes
  useEffect(() => {
    const fetchConversionSignals = async () => {
      const { data } = await supabase
        .from('conversion_signals')
        .select('*')
        .eq('student_id', student.id)
        .single()

      if (data) {
        setConversionSignals(data)
      }
    }

    fetchConversionSignals()
  }, [student.id])

  // V17: Fetch agent session summary
  useEffect(() => {
    const fetchAgentSummary = async () => {
      try {
        const summary = await getAgentSessionSummary(student.id)
        setAgentSummary(summary)
      } catch (e) {
        console.warn('Could not fetch agent summary:', e)
      }
    }

    fetchAgentSummary()
  }, [student.id])

  // Fetch detailed agent sessions when expanded
  useEffect(() => {
    if (!agentExpanded) return

    const fetchAgentDetails = async () => {
      try {
        const { data } = await supabase
          .from('agent_sessions')
          .select('id, target_upgrade_label, upgrade_difficulty, actual_rounds, early_release, gate1_completed, upgrade_appeared, best_student_quote, created_at')
          .eq('student_id', student.id)
          .order('created_at', { ascending: false })

        setAgentDetails(data || [])
      } catch (e) {
        console.warn('Could not fetch agent details:', e)
      }
    }

    fetchAgentDetails()
  }, [agentExpanded, student.id])

  // Fetch debug sessions summary
  useEffect(() => {
    const fetchDebugSummary = async () => {
      try {
        const { data: debugSessions } = await supabase
          .from('debug_sessions')
          .select('bug_type, resolved, needs_ta_help')
          .eq('student_id', student.id)

        if (debugSessions && debugSessions.length > 0) {
          setDebugSummary({
            promptFixed: debugSessions.filter(d => d.bug_type === 'prompt' && d.resolved).length,
            codeFixed: debugSessions.filter(d => d.bug_type === 'code' && d.resolved).length,
            resets: debugSessions.filter(d => d.bug_type === 'reset').length,
            unresolved: debugSessions.filter(d => !d.resolved).length,
            needsHelp: debugSessions.some(d => d.needs_ta_help),
            total: debugSessions.length,
          })
        }
      } catch (e) {
        console.warn('Could not fetch debug summary:', e)
      }
    }

    fetchDebugSummary()
  }, [student.id])

  // Get recent events for this student (last 3)
  const studentEvents = events
    ?.filter(e => e.student_id === student.id)
    ?.slice(0, 3) || []

  // Toggle a TA checkbox (student_signals)
  const handleToggle = async (key) => {
    const newValue = !signals[key]

    // Optimistic update
    onSignalUpdate(student.id, key, newValue)

    // Upsert in database (create if not exists)
    const { error } = await supabase
      .from('student_signals')
      .upsert({
        student_id: student.id,
        [key]: newValue,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'student_id'
      })

    if (error) {
      console.error('Failed to update signal:', error)
      // Revert on error
      onSignalUpdate(student.id, key, !newValue)
    }
  }

  // Toggle a conversion signal
  const handleConversionToggle = async (key) => {
    const newValue = !conversionSignals[key]

    // Optimistic update
    setConversionSignals(prev => ({ ...prev, [key]: newValue }))

    // Upsert in database
    const { error } = await supabase
      .from('conversion_signals')
      .upsert({
        student_id: student.id,
        session_id: sessionId,
        [key]: newValue,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'student_id'
      })

    if (error) {
      console.error('Failed to update conversion signal:', error)
      // Revert on error
      setConversionSignals(prev => ({ ...prev, [key]: !newValue }))
    }
  }

  // Handle report generation
  const handleReportGenerated = (report) => {
    setGeneratedReport(report)
    if (onReportGenerated) {
      onReportGenerated(report)
    }
  }

  const handleDelete = () => {
    if (window.confirm(`Delete ${student.name}? This action cannot be undone.`)) {
      onDelete(student.id)
    }
  }

  // Format relative time
  const formatRelativeTime = (timestamp) => {
    const diff = Date.now() - new Date(timestamp).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ago`
  }

  return (
    <div className={`bg-white rounded-xl shadow ${isStuck ? 'ring-2 ring-orange-400' : ''}`}>
      {/* Stuck indicator */}
      {isStuck && (
        <div className="bg-orange-100 text-orange-700 text-xs font-medium px-3 py-1.5 rounded-t-xl flex items-center gap-1.5">
          <AlertCircle size={14} />
          Stuck for 3+ minutes - check on this student
        </div>
      )}

      {/* Header */}
      <div className="p-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-800">{student.name}</span>
              <span className="text-xs text-gray-400">#{student.id.slice(0, 4)}</span>
              {conversionScore && (
                <span className={`text-sm font-mono px-2 py-0.5 rounded ${
                  parseFloat(conversionScore) >= 0.7
                    ? 'bg-green-100 text-green-700'
                    : parseFloat(conversionScore) >= 0.5
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-600'
                }`}>
                  {conversionScore}
                </span>
              )}
            </div>
            {student.game_name && (
              <div className="text-sm text-gray-500 truncate">"{student.game_name}"</div>
            )}
            <div className="text-xs text-gray-400 mt-0.5">
              Step: {student.current_step || 'design'}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleDelete}
              className="text-gray-400 hover:text-red-500 p-1"
              title="Delete student"
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* All 5 dimensions */}
          {Object.entries(DIMENSIONS).map(([key, config]) => (
            <DimensionSection
              key={key}
              name={key}
              config={config}
              status={dimensionStatus[key]}
              onToggle={handleToggle}
              disabled={false}
            />
          ))}

          {/* Conversion signals section */}
          <ConversionSection
            signals={conversionSignals}
            onToggle={handleConversionToggle}
            expanded={conversionExpanded}
            onToggleExpand={() => setConversionExpanded(!conversionExpanded)}
          />

          {/* V17: Agent Language Precision signals - Expandable */}
          {agentSummary && agentSummary.total > 0 && (
            <div className={`border rounded-lg overflow-hidden ${
              agentSummary.round3 > 0 && agentSummary.pendingVerify > 0
                ? 'bg-red-50 border-red-200'
                : 'bg-indigo-50 border-indigo-200'
            }`}>
              <button
                onClick={() => setAgentExpanded(!agentExpanded)}
                className="w-full p-2 flex items-center justify-between hover:bg-indigo-100/50 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <MessageCircle size={14} className="text-indigo-600" />
                  <span className="text-xs font-semibold text-gray-700">LANGUAGE PRECISION</span>
                  <span className="text-xs text-gray-500">({agentSummary.total})</span>
                  {/* V17: 高优先级信号 - 红色高亮 */}
                  {agentSummary.round3 > 0 && agentSummary.pendingVerify > 0 && (
                    <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                      <AlertTriangle size={10} /> NEEDS HELP
                    </span>
                  )}
                </div>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${agentExpanded ? 'rotate-180' : ''}`} />
              </button>

              {/* Summary row - always visible */}
              <div className="px-2 pb-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {agentSummary.earlyRelease > 0 && (
                  <span className="text-green-600">🟢 {agentSummary.earlyRelease}× 1-round</span>
                )}
                {agentSummary.round2 > 0 && (
                  <span className="text-yellow-600">🟡 {agentSummary.round2}× 2-round</span>
                )}
                {agentSummary.round3 > 0 && (
                  <span className="text-red-600">🔴 {agentSummary.round3}× 3-round</span>
                )}
                {agentSummary.diagnosed > 0 && (
                  <span className="text-blue-600">💡 {agentSummary.diagnosed}× diagnosed</span>
                )}
                {agentSummary.pendingVerify > 0 && (
                  <span className="text-orange-600">⏳ {agentSummary.pendingVerify}× pending</span>
                )}
              </div>

              {/* Expanded details */}
              {agentExpanded && (
                <div className="border-t border-indigo-200 p-2 space-y-2 bg-white/50">
                  {agentDetails.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center">Loading...</p>
                  ) : (
                    agentDetails.map((session, idx) => (
                      <div key={session.id} className="text-xs bg-white rounded p-2 border border-gray-100">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`font-medium ${
                            session.early_release ? 'text-green-600' :
                            session.actual_rounds === 3 ? 'text-red-600' :
                            'text-yellow-600'
                          }`}>
                            {session.target_upgrade_label || `Upgrade ${idx + 1}`}
                          </span>
                          <span className="text-gray-400">
                            [{session.upgrade_difficulty}]
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-xs ${
                            session.early_release ? 'bg-green-100 text-green-700' :
                            session.actual_rounds === 3 ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {session.early_release ? '1-round ✓' : `${session.actual_rounds}-round`}
                          </span>
                          {session.upgrade_appeared === true && (
                            <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">verified ✓</span>
                          )}
                          {session.upgrade_appeared === false && (
                            <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded">not appeared</span>
                          )}
                        </div>
                        {session.best_student_quote && (
                          <p className="text-gray-600 italic mt-1">"{session.best_student_quote}"</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Debug Sessions signals */}
          {debugSummary && debugSummary.total > 0 && (
            <div className={`border rounded-lg p-2 ${
              debugSummary.needsHelp
                ? 'bg-red-50 border-red-200'
                : 'bg-orange-50 border-orange-200'
            }`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertCircle size={14} className="text-orange-600" />
                <span className="text-xs font-semibold text-gray-700">DEBUG ACTIVITY</span>
                {/* 需要 TA 介入 - 红色高亮 */}
                {debugSummary.needsHelp && (
                  <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                    <AlertTriangle size={10} /> NEEDS TA HELP
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {debugSummary.promptFixed > 0 && (
                  <span className="text-green-600">🐛 prompt×{debugSummary.promptFixed}</span>
                )}
                {debugSummary.codeFixed > 0 && (
                  <span className="text-blue-600">🔧 code×{debugSummary.codeFixed}</span>
                )}
                {debugSummary.resets > 0 && (
                  <span className="text-purple-600">🔄 reset×{debugSummary.resets}</span>
                )}
                {debugSummary.unresolved > 0 && (
                  <span className="text-red-600">⚠️ unresolved×{debugSummary.unresolved}</span>
                )}
              </div>
            </div>
          )}

          {/* Recent events */}
          {studentEvents.length > 0 && (
            <div className="pt-2 border-t">
              <div className="text-xs text-gray-500 mb-1">Recent events:</div>
              <div className="flex flex-wrap gap-1">
                {studentEvents.map((e, i) => (
                  <span key={i} className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">
                    {e.event_type} ({formatRelativeTime(e.created_at)})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Report Generator */}
          <div className="pt-2 border-t">
            <ReportGenerator
              student={student}
              signals={signals}
              sessionId={sessionId}
              onReportGenerated={handleReportGenerated}
            />
            {generatedReport && (
              <p className="text-xs text-green-600 mt-1 px-1">
                Report ready! Token: {generatedReport.share_token?.slice(0, 8)}...
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
