import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthGuard from './components/AuthGuard'
import Setup from './components/Setup'
import Dashboard from './components/Dashboard'
import Enrollment from './pages/Enrollment'
import { supabase } from './lib/supabase'

function AppContent({ taProfile }) {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('setup') // 'setup' | 'dashboard' | 'enrollment'

  // Check for stored session on load
  useEffect(() => {
    const checkStoredSession = async () => {
      const storedSessionId = localStorage.getItem('session_id')

      if (storedSessionId) {
        // Verify session still exists and belongs to TA's organization
        const { data: sessionData, error } = await supabase
          .from('sessions')
          .select('id, name, status, created_at, join_code, scheduled_end_at, lesson_type, organization_id')
          .eq('id', storedSessionId)
          .single()

        if (!error && sessionData) {
          // Check if session belongs to TA's organization (or has no org yet)
          if (!sessionData.organization_id || sessionData.organization_id === taProfile.organization_id) {
            setSession(sessionData)
          } else {
            // Session belongs to different org, clear it
            localStorage.removeItem('session_id')
          }
        } else {
          // Clear invalid stored data
          localStorage.removeItem('session_id')
        }
      }

      setLoading(false)
    }

    checkStoredSession()
  }, [taProfile.organization_id])

  const handleStart = (selectedSession) => {
    setSession(selectedSession)
    setView('dashboard')
  }

  const handleExit = () => {
    localStorage.removeItem('session_id')
    setSession(null)
    setView('setup')
  }

  const handleSignOut = async () => {
    localStorage.removeItem('session_id')
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  // Enrollment view
  if (view === 'enrollment') {
    return (
      <Enrollment
        taProfile={taProfile}
        onBack={() => setView('setup')}
      />
    )
  }

  // Dashboard view
  if (session && view === 'dashboard') {
    return (
      <Dashboard
        session={session}
        taName={taProfile.name}
        taProfile={taProfile}
        onExit={handleExit}
        onSignOut={handleSignOut}
      />
    )
  }

  // Setup view (default)
  return (
    <Setup
      taProfile={taProfile}
      onStart={handleStart}
      onSignOut={handleSignOut}
      onEnrollment={() => setView('enrollment')}
    />
  )
}

export default function App() {
  return (
    <AuthGuard>
      {({ taProfile }) => <AppContent taProfile={taProfile} />}
    </AuthGuard>
  )
}
