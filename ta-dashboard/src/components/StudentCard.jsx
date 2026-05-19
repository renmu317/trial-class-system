// V17 StudentCard with signal checkboxes
import { useState } from 'react'
import { ChevronDown, ChevronUp, Trash2, Check, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { calculateConversionScore, getDimensionStatus } from '../lib/signalScore'

// Dimension display config
const DIMENSIONS = {
  competence: { label: 'COMPETENCE LOOP', emoji: '🟢', color: 'green' },
  ownership: { label: 'OWNERSHIP', emoji: '🟡', color: 'yellow' },
  persistence: { label: 'PERSISTENCE', emoji: '🟡', color: 'yellow' },
  challenge: { label: 'CHALLENGE SEED', emoji: '🟡', color: 'yellow' },
  parent: { label: 'PARENT SIGNAL', emoji: '🔴', color: 'red' }
}

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

export default function StudentCard({ student, signals, events, isStuck, onDelete, onSignalUpdate }) {
  const [expanded, setExpanded] = useState(false)

  // Calculate conversion score and dimension status
  const conversionScore = calculateConversionScore(signals)
  const dimensionStatus = getDimensionStatus(signals)

  // Get recent events for this student (last 3)
  const studentEvents = events
    ?.filter(e => e.student_id === student.id)
    ?.slice(0, 3) || []

  // Toggle a TA checkbox
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
        </div>
      )}
    </div>
  )
}
