import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export default function EnrollPage() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [enrollment, setEnrollment] = useState(null)
  const [error, setError] = useState(null)
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [shortcode, setShortcode] = useState(null)

  // Load enrollment info
  useEffect(() => {
    const loadEnrollment = async () => {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/verify-enrollment-token`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify({ token })
          }
        )

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Invalid link')
        }

        if (data.status === 'enrolled') {
          setCompleted(true)
          setShortcode(data.shortcode)
        }

        setEnrollment(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      loadEnrollment()
    }
  }, [token])

  // Handle enrollment submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!phone.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/complete-enrollment`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY
          },
          body: JSON.stringify({
            token,
            phone: phone.trim()
          })
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete enrollment')
      }

      setCompleted(true)
      setShortcode(data.shortcode)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (error && !enrollment) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Link Invalid</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Enrollment Complete!</h1>
          <p className="text-gray-600 mb-6">
            Welcome, <strong>{enrollment?.student_name}</strong>!
          </p>

          <div className="bg-indigo-50 rounded-xl p-6 mb-6">
            <p className="text-sm text-indigo-600 mb-2">Your Login Code</p>
            <div className="text-4xl font-mono font-bold text-indigo-700 tracking-wider">
              {shortcode}
            </div>
          </div>

          <div className="text-sm text-gray-500 space-y-2">
            <p>Use this code to join your class.</p>
            <p>Keep it safe - you'll need it every time!</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎮</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            AI Creative Class
          </h1>
          <p className="text-gray-600">
            Enrollment for <strong>{enrollment?.student_name}</strong>
          </p>
          {enrollment?.grade && (
            <p className="text-sm text-gray-500">Grade: {enrollment.grade}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Parent Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter phone number"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-lg"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              We'll use this to send class updates
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !phone.trim()}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-lg disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Processing...' : 'Complete Enrollment'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          By enrolling, you agree to receive class notifications
        </p>
      </div>
    </div>
  )
}
