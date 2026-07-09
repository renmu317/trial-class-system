import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Loader2, XCircle } from 'lucide-react'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Parse URL for tokens (Supabase puts them in hash or query params)
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const queryParams = new URLSearchParams(window.location.search)

        const accessToken = hashParams.get('access_token') || queryParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token')
        const errorParam = hashParams.get('error') || queryParams.get('error')
        const errorDescription = hashParams.get('error_description') || queryParams.get('error_description')

        // Check for error in URL
        if (errorParam) {
          throw new Error(errorDescription || errorParam)
        }

        // If we have tokens in URL, set the session
        if (accessToken && refreshToken) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (setSessionError) {
            throw setSessionError
          }
        }

        // Wait a moment for session to be established
        await new Promise(resolve => setTimeout(resolve, 500))

        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          throw sessionError
        }

        if (!session) {
          throw new Error('No session found. The link may have expired.')
        }

        // Get user
        const { data: { user }, error: userError } = await supabase.auth.getUser()

        if (userError || !user) {
          throw new Error('Failed to get user information')
        }

        // Check if user has a ta_profile
        const { data: taProfile, error: profileError } = await supabase
          .from('ta_profiles')
          .select('id, name, email, role, organization_id, is_active')
          .eq('id', user.id)
          .single()

        if (profileError || !taProfile) {
          console.error('Profile error:', profileError)
          throw new Error('You are not authorized as a TA. Please contact your administrator.')
        }

        if (!taProfile.is_active) {
          throw new Error('Your account has been deactivated. Please contact your administrator.')
        }

        // Success - redirect to dashboard
        navigate('/', { replace: true })

      } catch (err) {
        console.error('Auth callback error:', err)
        setError(err.message || 'Authentication failed')
      }
    }

    handleCallback()
  }, [navigate])

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Sign In Failed</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-800">Signing you in...</h2>
        <p className="text-gray-500 mt-2">Please wait while we verify your account.</p>
      </div>
    </div>
  )
}
