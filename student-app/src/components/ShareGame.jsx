import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { writeEvent } from '../lib/timeline'
import { useT } from '../i18n'

export default function ShareGame({ studentId, sessionId, onDone, inline = false }) {
  const t = useT()
  const [link, setLink] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  // Reflection state
  const [reflectionText, setReflectionText] = useState('')
  const [reflection, setReflection] = useState('')
  const [savingReflection, setSavingReflection] = useState(false)

  const handleSave = async () => {
    if (!link.trim()) return

    // Simple validation: must start with http
    if (!link.startsWith('http')) {
      alert('Please paste a valid link starting with http')
      return
    }

    setSaving(true)
    await supabase
      .from('students')
      .update({ publish_link: link.trim() })
      .eq('id', studentId)

    setSaved(true)
    setSaving(false)
  }

  const handleSaveReflection = async () => {
    if (!reflectionText.trim()) return

    setSavingReflection(true)

    // Save to students table
    await supabase.from('students').update({
      session_reflection: reflectionText.trim(),
    }).eq('id', studentId)

    // Write to session_timeline
    if (sessionId) {
      await writeEvent(studentId, sessionId, {
        type: 'identity_reflection',
        role: 'student',
        content: reflectionText.trim(),
        metadata: {
          triggered_by: 'end_of_class',
          has_publish_link: !!link,
        },
      })
    }

    setReflection(reflectionText.trim())
    setSavingReflection(false)
  }

  // Inline mode: card style
  if (inline) {
    if (saved) {
      return (
        <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🎉</div>
            <div className="flex-1">
              <h3 className="font-bold text-green-800">{t('share.inlineShared')}</h3>
              <p className="text-green-600 text-sm">{t('share.inlineSharedSubtitle')}</p>
            </div>
            <button
              onClick={onDone}
              className="px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-bold hover:bg-green-600"
            >
              {t('share.done')}
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="text-3xl">🎮</div>
          <div className="flex-1">
            <h3 className="font-bold text-orange-800 mb-1">{t('share.inlineTitle')}</h3>
            <p className="text-orange-600 text-sm mb-3">
              {t('share.inlineSubtitle')}
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder={t('share.placeholder')}
                className="flex-1 border-2 border-orange-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400"
              />
              <button
                onClick={handleSave}
                disabled={!link.trim() || saving}
                className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 disabled:opacity-40"
              >
                {saving ? '...' : t('share.inlineShare')}
              </button>
            </div>
          </div>
          <button
            onClick={onDone}
            className="text-orange-400 hover:text-orange-600 text-lg"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  // Fullscreen mode - saved state with reflection
  if (saved) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-lg mx-auto text-center py-8 px-4 bg-white rounded-3xl shadow-xl">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            {t('share.gameShared')}
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            {t('share.teacherWillSend')}
          </p>

          {/* Link display */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-6 text-left">
            <p className="text-xs text-slate-400 mb-1">{t('share.yourLink')}</p>
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 text-sm break-all hover:underline"
            >
              {link}
            </a>
          </div>

          {/* Identity Reflection */}
          {!reflection ? (
            <div className="mt-6 text-left">
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
                <p className="text-sm font-bold text-purple-700 mb-3">
                  🌟 {t('reflection.oneLastQuestion')}
                </p>
                <p className="text-sm text-purple-800 mb-3">
                  {t('reflection.prompt')}
                </p>
                <textarea
                  value={reflectionText}
                  onChange={(e) => setReflectionText(e.target.value)}
                  placeholder={t('reflection.placeholder')}
                  rows={2}
                  className="w-full border-2 border-purple-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-400 resize-none mb-3"
                />
                <button
                  onClick={handleSaveReflection}
                  disabled={!reflectionText.trim() || savingReflection}
                  className="w-full bg-purple-500 text-white rounded-xl py-2 text-sm font-bold hover:bg-purple-600 disabled:opacity-40"
                >
                  {savingReflection ? t('common.loading') : t('reflection.save')}
                </button>
                <button
                  onClick={onDone}
                  className="w-full text-slate-400 text-sm mt-2 hover:text-slate-600"
                >
                  {t('reflection.skip')}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 bg-purple-50 border border-purple-200 rounded-xl p-4 text-left">
              <p className="text-xs text-purple-400 mb-1">{t('reflection.yourDiscovery')}</p>
              <p className="text-sm text-purple-700 italic">"{reflection}"</p>
              <p className="text-xs text-slate-400 mt-2">
                {t('reflection.willShare')}
              </p>
            </div>
          )}

          {/* Done button - only show after reflection is saved or if reflection is shown */}
          {reflection && (
            <button
              onClick={onDone}
              className="w-full bg-orange-500 text-white rounded-xl py-3 font-bold hover:bg-orange-600 transition-colors mt-4"
            >
              {t('share.done')}
            </button>
          )}
        </div>
      </div>
    )
  }

  // Fullscreen mode - input state
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-lg mx-auto py-8 px-6 bg-white rounded-3xl shadow-xl">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🎮</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            {t('share.title')}
          </h2>
          <p className="text-slate-500 text-sm">
            {t('share.subtitle')}
          </p>
        </div>

        <div className="mb-4">
          <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">
            {t('share.pasteLink')}
          </label>
          <textarea
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder={t('share.placeholder')}
            rows={3}
            className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400 resize-none"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!link.trim() || saving}
          className="w-full bg-orange-500 text-white rounded-xl py-3 font-bold hover:bg-orange-600 disabled:opacity-40 transition-colors"
        >
          {saving ? t('share.saving') : t('share.shareWithTeacher')}
        </button>

        <button
          onClick={onDone}
          className="w-full text-slate-400 text-sm mt-3 hover:text-slate-600"
        >
          {t('share.skipForNow')}
        </button>
      </div>
    </div>
  )
}
