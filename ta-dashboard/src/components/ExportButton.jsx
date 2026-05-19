// V17 Export with signal-based CSV
import { Download } from 'lucide-react'
import { calculateConversionScore } from '../lib/signalScore'

export default function ExportButton({ students, signals, sessionName }) {
  const handleExport = () => {
    const headers = [
      'name',
      'game_name',
      'step',
      'score',
      // Competence Loop
      'cl_made',
      'cl_played',
      'cl_modified',
      // Ownership
      'ow_named',
      'ow_custom_name',
      'ow_showed',
      'ow_explained',
      // Persistence
      'ps_stuck',
      'ps_recovered',
      'ps_help',
      // Challenge Seed
      'cs_hard',
      'cs_medium',
      'cs_own',
      'cs_verbal',
      'cs_kept',
      // Parent Signal
      'pr_photo',
      'pr_price',
      'pr_stay',
      'pr_look'
    ]

    const rows = students.map(s => {
      const sig = signals[s.id] || {}
      const conversionScore = calculateConversionScore(sig)

      return [
        escapeCsvField(s.name),
        escapeCsvField(s.game_name || ''),
        escapeCsvField(s.current_step || ''),
        conversionScore ?? '',
        // Competence Loop
        boolStr(sig.cl_game_made),
        boolStr(sig.cl_game_played),
        boolStr(sig.cl_game_modified),
        // Ownership
        boolStr(sig.ow_named),
        escapeCsvField(sig.ow_custom_name || ''),
        boolStr(sig.ow_showed),
        boolStr(sig.ow_explained),
        // Persistence
        boolStr(sig.ps_got_stuck),
        boolStr(sig.ps_recovered),
        boolStr(sig.ps_asked_help),
        // Challenge Seed
        boolStr(sig.cs_used_hard),
        boolStr(sig.cs_used_medium),
        boolStr(sig.cs_own_idea),
        boolStr(sig.cs_verbal_want),
        boolStr(sig.cs_kept_working),
        // Parent Signal
        boolStr(sig.pr_took_photo),
        boolStr(sig.pr_asked_price),
        boolStr(sig.pr_stayed_long),
        boolStr(sig.pr_looked_screen)
      ].join(',')
    })

    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `${sessionName || 'session'}_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()

    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      disabled={students.length === 0}
      className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Download size={18} />
      Export CSV
    </button>
  )
}

function escapeCsvField(field) {
  if (field === null || field === undefined) return ''
  const str = String(field)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function boolStr(value) {
  if (value === true) return 'true'
  if (value === false) return 'false'
  return ''
}
