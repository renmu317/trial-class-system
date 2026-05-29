import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Loader2 } from 'lucide-react'

export default function AuthGuard({ children }) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [taProfile, setTaProfile] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    let profileFetched = false

    // Fetch TA profile for a user with timeout using direct fetch
    const fetchProfile = async (userId) => {
      if (profileFetched) return // Prevent duplicate fetches
      profileFetched = true

      console.log('AuthGuard: fetching profile for', userId)

      try {
        // Use AbortController for reliable timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000)

        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token

        // Direct fetch to Supabase REST API
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/ta_profiles?id=eq.${userId}&select=id,name,email,role,organization_id,is_active`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            signal: controller.signal
          }
        )

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()
        const profile = data?.[0]

        console.log('AuthGuard: profile result', profile)

        if (mounted) {
          if (profile && profile.is_active) {
            setTaProfile(profile)
          }
          setLoading(false)
        }
      } catch (err) {
        console.error('Fetch profile error:', err)
        if (mounted) {
          if (err.name === 'AbortError') {
            setError('Profile fetch timed out. Please refresh.')
          } else {
            setError(err.message)
          }
          setLoading(false)
        }
      }
    }

    // Check auth and set up listener
    const init = async () => {
      console.log('AuthGuard: initializing...')

      // Get initial session
      const { data: { session } } = await supabase.auth.getSession()
      console.log('AuthGuard: got session', !!session)

      if (session?.user) {
        setUser(session.user)
        await fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    }

    init()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('AuthGuard: auth changed', event)

      if (!mounted) return

      if (event === 'SIGNED_OUT') {
        setUser(null)
        setTaProfile(null)
        setLoading(false)
      } else if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        if (!profileFetched) {
          await fetchProfile(session.user.id)
        }
      }
    })

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center flex-col gap-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors mr-2"
          >
            Refresh
          </button>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/login'
            }}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  // Not logged in - redirect to login
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Logged in but no TA profile - show error
  if (!taProfile) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">
            You don't have permission to access the TA Dashboard.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Signed in as: {user.email}<br/>
            User ID: {user.id}
          </p>
          <button
            onClick={async () => {
              await supabase.auth.signOut()
              window.location.href = '/login'
            }}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  // Pass taProfile to children
  return children({ taProfile })
}
