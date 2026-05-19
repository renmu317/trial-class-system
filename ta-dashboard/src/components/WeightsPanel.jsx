import { useState } from 'react'
import { Settings, ChevronDown, ChevronUp } from 'lucide-react'

const DIMENSIONS = [
  { key: 'ownership', label: 'O', fullLabel: 'Ownership' },
  { key: 'persistence', label: 'P', fullLabel: 'Persistence' },
  { key: 'curiosity', label: 'C', fullLabel: 'Curiosity' },
  { key: 'expression', label: 'E', fullLabel: 'Expression' },
  { key: 'parent_signal', label: 'PS', fullLabel: 'Parent Signal' }
]

export default function WeightsPanel({ weights, onChange }) {
  const [expanded, setExpanded] = useState(false)

  const handleWeightChange = (key, value) => {
    const numValue = parseFloat(value)
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 3) {
      onChange({ ...weights, [key]: numValue })
    }
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <Settings size={16} />
        Weights: {DIMENSIONS.map(d => `${d.label}[${weights[d.key]}]`).join(' ')}
        <ChevronDown size={14} />
      </button>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <Settings size={16} />
          Scoring Weights
        </span>
        <button
          onClick={() => setExpanded(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          <ChevronUp size={18} />
        </button>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {DIMENSIONS.map(dim => (
          <div key={dim.key} className="text-center">
            <div className="text-xs text-gray-500 mb-1">{dim.fullLabel}</div>
            <input
              type="number"
              min="0"
              max="3"
              step="0.1"
              value={weights[dim.key]}
              onChange={(e) => handleWeightChange(dim.key, e.target.value)}
              className="w-full text-center border rounded p-1 text-sm"
            />
          </div>
        ))}
      </div>

      <button
        onClick={() => onChange({
          ownership: 1.0,
          persistence: 1.0,
          curiosity: 1.0,
          expression: 1.0,
          parent_signal: 1.0
        })}
        className="mt-3 text-xs text-blue-500 hover:text-blue-600"
      >
        Reset to defaults
      </button>
    </div>
  )
}
