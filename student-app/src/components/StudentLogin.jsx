import { useState, useEffect } from 'react'
import { User, LogIn, ArrowRight, RefreshCw } from 'lucide-react'
import { useT } from '../i18n'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Student identity storage key
const IDENTITY_KEY = 'student_identity'

export default function StudentLogin({ onLogin }) {
  const t = useT()
  const [identity, setIdentity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('session') // 'session' | 'register'
  const [sessionCode, setSessionCode] = useState('')
  const [shortcode, setShortcode] = useState('')
  const [studentName, setStudentName] = useState('') // For anonymous join
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Load identity from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(IDENTITY_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setIdentity(parsed)
      } catch (e) {
        console.error('Failed to parse saved identity:', e)
        localStorage.removeItem(IDENTITY_KEY)
      }
    }
    setLoading(false)
  }, [])

  // Handle 6-digit shortcode verification (register/restore identity)
  const handleShortcodeSubmit = async (e) => {
    e.preventDefault()
    if (shortcode.length !== 6) {
      setError(t('studentLogin.error6Digits'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/verify-shortcode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ shortcode: shortcode.toUpperCase() }),
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        setError(result.error || t('studentLogin.invalidCode'))
        setSubmitting(false)
        return
      }

      // Save identity to localStorage
      const newIdentity = {
        shortcode: shortcode.toUpperCase(),
        student_name: result.student_name,
        organization_id: result.organization_id,
        enrollment_id: result.enrollment_id,
        grade: result.grade,
      }
      localStorage.setItem(IDENTITY_KEY, JSON.stringify(newIdentity))
      setIdentity(newIdentity)
      setMode('session') // Switch to session code input
      setShortcode('')
    } catch (err) {
      console.error('Shortcode verification error:', err)
      setError(t('studentLogin.connectionError'))
    } finally {
      setSubmitting(false)
    }
  }

  // Handle 4-digit session code join
  const handleSessionJoin = async (e) => {
    e.preventDefault()
    if (sessionCode.length !== 4) {
      setError(t('studentLogin.error4Digits'))
      return
    }

    // For anonymous join, require name
    if (!identity && !studentName.trim()) {
      setError(t('studentLogin.errorEnterName'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/join-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          session_code: sessionCode,
          enrollment_id: identity?.enrollment_id || null,
          student_name: identity?.student_name || studentName.trim(),
        }),
      })

      const result = await response.json()

      if (!response.ok || result.error) {
        setError(result.error || t('studentLogin.failedToJoin'))
        setSubmitting(false)
        return
      }

      // Call onLogin with session and student info
      onLogin({
        sessionId: result.session_id,
        sessionName: result.session_name,
        studentId: result.student_id,
        studentName: result.student_name,
        gameName: result.game_name || '',
        lessonType: result.lesson_type || 'lesson1',
        alreadyJoined: result.already_joined,
      })
    } catch (err) {
      console.error('Session join error:', err)
      setError(t('studentLogin.connectionError'))
    } finally {
      setSubmitting(false)
    }
  }

  // Switch to different account
  const handleSwitchAccount = () => {
    localStorage.removeItem(IDENTITY_KEY)
    setIdentity(null)
    setMode('session')
    setSessionCode('')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🎮</div>
          <p className="text-slate-500 font-bold">{t('studentLogin.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-2">🎮</div>
          <h1 className="text-2xl font-extrabold text-slate-800">{t('studentLogin.title')}</h1>
        </div>

        {/* Has Identity: Welcome Back */}
        {identity ? (
          <div>
            {/* Welcome Message */}
            <div className="bg-indigo-50 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm text-indigo-600 font-medium">{t('studentLogin.welcomeBack')}</p>
                    <p className="text-lg font-bold text-slate-800">{identity.student_name}</p>
                  </div>
                </div>
                <button
                  onClick={handleSwitchAccount}
                  className="text-xs text-indigo-500 hover:text-indigo-700 underline"
                >
                  {t('studentLogin.switch')}
                </button>
              </div>
            </div>

            {/* Session Code Input */}
            <form onSubmit={handleSessionJoin}>
              <label className="block text-sm font-medium text-slate-600 mb-2">
                {t('studentLogin.enterClassCode')}
              </label>
              <input
                type="text"
                maxLength={4}
                value={sessionCode}
                onChange={(e) => {
                  setSessionCode(e.target.value.replace(/\D/g, '').slice(0, 4))
                  setError(null)
                }}
                placeholder="1234"
                className="w-full text-center text-4xl font-mono font-bold tracking-[0.5em] py-4 border-2 border-slate-200 rounded-2xl focus:border-indigo-500 focus:outline-none"
                autoFocus
              />
              {error && (
                <p className="text-red-500 text-sm mt-2 text-center">{error}</p>
              )}
              <button
                type="submit"
                disabled={sessionCode.length !== 4 || submitting}
                className={`w-full mt-4 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all
                  ${sessionCode.length === 4 && !submitting
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
              >
                {submitting ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    {t('studentLogin.joinClass')}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* No Identity: Two Options */
          <div>
            {mode === 'session' ? (
              <>
                {/* Session Code Input (Anonymous) */}
                <form onSubmit={handleSessionJoin}>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    {t('studentLogin.enterCode')}
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={sessionCode}
                    onChange={(e) => {
                      setSessionCode(e.target.value.replace(/\D/g, '').slice(0, 4))
                      setError(null)
                    }}
                    placeholder="1234"
                    className="w-full text-center text-4xl font-mono font-bold tracking-[0.5em] py-4 border-2 border-slate-200 rounded-2xl focus:border-indigo-500 focus:outline-none mb-4"
                    autoFocus
                  />

                  {/* Name Input */}
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    {t('studentLogin.yourName')}
                  </label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => {
                      setStudentName(e.target.value)
                      setError(null)
                    }}
                    placeholder={t('studentLogin.enterYourName')}
                    className="w-full text-center text-xl py-3 border-2 border-slate-200 rounded-2xl focus:border-indigo-500 focus:outline-none"
                  />

                  {error && (
                    <p className="text-red-500 text-sm mt-2 text-center">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={(sessionCode.length !== 4 || !studentName.trim()) || submitting}
                    className={`w-full mt-4 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all
                      ${sessionCode.length === 4 && studentName.trim() && !submitting
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                  >
                    {submitting ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        Join Class
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="flex items-center gap-4 my-6">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-sm text-slate-400">{t('studentLogin.or')}</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* Register Link */}
                <button
                  onClick={() => {
                    setMode('register')
                    setError(null)
                  }}
                  className="w-full py-3 border-2 border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2"
                >
                  <LogIn className="w-5 h-5" />
                  {t('studentLogin.haveStudentCode')}
                </button>
              </>
            ) : (
              <>
                {/* Shortcode Input (Register/Restore) */}
                <form onSubmit={handleShortcodeSubmit}>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    {t('studentLogin.enter6DigitCode')}
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={shortcode}
                    onChange={(e) => {
                      setShortcode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
                      setError(null)
                    }}
                    placeholder="K3MN7P"
                    className="w-full text-center text-4xl font-mono font-bold tracking-[0.3em] py-4 border-2 border-slate-200 rounded-2xl focus:border-green-500 focus:outline-none"
                    autoFocus
                  />
                  <p className="text-xs text-slate-400 mt-2 text-center">
                    {t('studentLogin.codeFromEnrollment')}
                  </p>

                  {error && (
                    <p className="text-red-500 text-sm mt-2 text-center">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={shortcode.length !== 6 || submitting}
                    className={`w-full mt-4 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all
                      ${shortcode.length === 6 && !submitting
                        ? 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                  >
                    {submitting ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        {t('studentLogin.logIn')}
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </form>

                {/* Back to session code */}
                <button
                  onClick={() => {
                    setMode('session')
                    setError(null)
                  }}
                  className="w-full mt-4 py-3 text-slate-500 hover:text-slate-700"
                >
                  {t('studentLogin.backToClassCode')}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
