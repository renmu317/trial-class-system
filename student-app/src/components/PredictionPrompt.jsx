/**
 * PredictionPrompt - Pre-Send Prediction Modal
 *
 * Shows before copying an upgrade prompt to Claude.
 * Student writes what they think will appear in the game.
 *
 * P7 Cognitive Behavior System: Validation Training
 * 2026-06-04
 */

import { useState } from 'react'
import { writeEvent } from '../lib/timeline'
import { useT } from '../i18n'

export default function PredictionPrompt({
  studentId,
  sessionId,
  upgradeId,
  upgradeLabel,
  onConfirm,
  onSkip
}) {
  const t = useT()
  const [prediction, setPrediction] = useState('')
  const [saving, setSaving] = useState(false)

  const handleConfirm = async () => {
    if (!prediction.trim()) {
      // No prediction, just proceed
      onConfirm(null)
      return
    }

    setSaving(true)

    // Write prediction to timeline
    await writeEvent(studentId, sessionId, {
      type: 'prediction_made',
      upgradeId,
      role: 'student',
      content: prediction.trim(),
      metadata: {
        upgrade_label: upgradeLabel,
        predicted_at: new Date().toISOString(),
      },
    })

    setSaving(false)
    onConfirm(prediction.trim())
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="text-center mb-5">
          <div className="text-3xl mb-2">🔮</div>
          <h2 className="text-lg font-bold text-slate-800">
            {t('prediction.title')}
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {t('prediction.subtitle')}
          </p>
        </div>

        {upgradeLabel && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 mb-4 text-center">
            <span className="text-xs text-orange-500 font-bold uppercase">
              {t('prediction.upgrade')}
            </span>
            <p className="text-sm font-semibold text-orange-700 mt-0.5">
              {upgradeLabel}
            </p>
          </div>
        )}

        <textarea
          value={prediction}
          onChange={(e) => setPrediction(e.target.value)}
          placeholder={t('prediction.placeholder')}
          rows={3}
          className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400 resize-none mb-4"
          autoFocus
        />

        <button
          onClick={handleConfirm}
          disabled={saving}
          className="w-full bg-orange-500 text-white rounded-xl py-3 font-bold hover:bg-orange-600 disabled:opacity-50 mb-2"
        >
          {saving ? t('common.saving') : t('prediction.sendToClaude')}
        </button>

        <button
          onClick={onSkip}
          className="w-full text-slate-400 text-sm hover:text-slate-600"
        >
          {t('prediction.skip')}
        </button>
      </div>
    </div>
  )
}
