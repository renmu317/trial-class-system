/**
 * ValidationCheck - Post-Generate Validation Modal
 *
 * Shows when student returns to Prompt tab after generating.
 * Compares their prediction with what actually appeared.
 *
 * P7 Cognitive Behavior System: Validation Training
 * 2026-06-04
 */

import { useState } from 'react'
import { writeEvent } from '../lib/timeline'
import { useT } from '../i18n'

export default function ValidationCheck({
  studentId,
  sessionId,
  upgradeId,
  prediction,
  onDone
}) {
  const t = useT()
  const [matched, setMatched] = useState(null)
  const [reflection, setReflection] = useState('')
  const [step, setStep] = useState('check')  // 'check' | 'reflect'
  const [saving, setSaving] = useState(false)

  const handleMatch = async (didMatch) => {
    setMatched(didMatch)
    setSaving(true)

    await writeEvent(studentId, sessionId, {
      type: 'prediction_validated',
      upgradeId,
      role: 'student',
      content: didMatch ? 'prediction_matched' : 'prediction_mismatched',
      metadata: {
        original_prediction: prediction,
        matched: didMatch,
        validated_at: new Date().toISOString(),
      },
    })

    setSaving(false)
    setStep('reflect')
  }

  const handleReflect = async () => {
    if (reflection.trim()) {
      setSaving(true)
      await writeEvent(studentId, sessionId, {
        type: 'validation_reflection',
        upgradeId,
        role: 'student',
        content: reflection.trim(),
        metadata: { matched },
      })
      setSaving(false)
    }
    onDone(matched)
  }

  if (step === 'check') {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
          <div className="text-center mb-5">
            <div className="text-3xl mb-2">🎯</div>
            <h2 className="text-lg font-bold text-slate-800">
              {t('validation.title')}
            </h2>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-5">
            <p className="text-xs text-slate-400 uppercase font-bold mb-1">
              {t('validation.yourPrediction')}
            </p>
            <p className="text-sm text-slate-700 italic">"{prediction}"</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleMatch(true)}
              disabled={saving}
              className="flex-1 bg-green-500 text-white rounded-xl py-3 font-bold hover:bg-green-600 disabled:opacity-50"
            >
              {t('validation.yesMatched')}
            </button>
            <button
              onClick={() => handleMatch(false)}
              disabled={saving}
              className="flex-1 bg-orange-500 text-white rounded-xl py-3 font-bold hover:bg-orange-600 disabled:opacity-50"
            >
              {t('validation.noDifferent')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="text-center mb-5">
          <div className="text-3xl mb-2">{matched ? '🌟' : '🤔'}</div>
          <h2 className="text-lg font-bold text-slate-800">
            {matched ? t('validation.whyMatched') : t('validation.whatDifferent')}
          </h2>
        </div>

        <textarea
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder={matched
            ? t('validation.matchedPlaceholder')
            : t('validation.differentPlaceholder')}
          rows={3}
          className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400 resize-none mb-4"
          autoFocus
        />

        <button
          onClick={handleReflect}
          disabled={saving}
          className="w-full bg-orange-500 text-white rounded-xl py-3 font-bold hover:bg-orange-600 disabled:opacity-50 mb-2"
        >
          {saving ? t('common.saving') : t('common.continue')}
        </button>

        <button
          onClick={() => onDone(matched)}
          className="w-full text-slate-400 text-sm hover:text-slate-600"
        >
          {t('common.skip')}
        </button>
      </div>
    </div>
  )
}
