import { useState, useEffect } from 'react'
import Setup from './components/Setup'
import Dashboard from './components/Dashboard'
import { supabase } from './lib/supabase'

export default function App() {
  const [session, setSession] = useState(null)
  const [taName, setTaName] = useState(null)
  const [loading, setLoading] = useState(true)

  // Check for stored session on load
  useEffect(() => {
    const checkStoredSession = async () => {
      const storedSessionId = localStorage.getItem('session_id')
      const storedTaName = localStorage.getItem('ta_name')

      if (storedSessionId && storedTaName) {
        // Verify session still exists
        const { data: sessionData, error } = await supabase
          .from('sessions')
          .select('id, name, status, created_at')
          .eq('id', storedSessionId)
          .single()

        if (!error && sessionData) {
          setSession(sessionData)
          setTaName(storedTaName)
        } else {
          // Clear invalid stored data
          localStorage.removeItem('session_id')
          localStorage.removeItem('ta_name')
        }
      }

      setLoading(false)
    }

    checkStoredSession()
  }, [])

  const handleStart = (selectedSession, selectedTaName) => {
    setSession(selectedSession)
    setTaName(selectedTaName)
  }

  const handleExit = () => {
    localStorage.removeItem('session_id')
    localStorage.removeItem('ta_name')
    setSession(null)
    setTaName(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!session || !taName) {
    return <Setup onStart={handleStart} />
  }

  return (
    <Dashboard
      session={session}
      taName={taName}
      onExit={handleExit}
    />
  )
}
