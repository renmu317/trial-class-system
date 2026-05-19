import { useState, useEffect } from 'react'
import { Plus, Users, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import SessionQRCode from './SessionQRCode'

export default function Setup({ onStart }) {
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [taName, setTaName] = useState('')
  const [newSessionName, setNewSessionName] = useState('')
  const [showNewSession, setShowNewSession] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load sessions
  useEffect(() => {
    const loadSessions = async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, name, status, created_at, join_code')
        .order('created_at', { ascending: false })

      if (!error && data) {
        setSessions(data)
      }
      setLoading(false)
    }

    loadSessions()
  }, [])

  // Generate unique 4-digit join code
  const generateJoinCode = () => {
    return String(Math.floor(1000 + Math.random() * 9000))
  }

  // Create new session
  const handleCreateSession = async () => {
    if (!newSessionName.trim()) return

    const joinCode = generateJoinCode()

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        name: newSessionName.trim(),
        status: 'running',
        join_code: joinCode
      })
      .select()
      .single()

    if (!error && data) {
      setSessions([data, ...sessions])
      setSelectedSession(data)
      setShowNewSession(false)
      setNewSessionName('')
    }
  }

  // Start dashboard
  const handleStart = () => {
    if (selectedSession && taName) {
      localStorage.setItem('ta_name', taName)
      localStorage.setItem('session_id', selectedSession.id)
      onStart(selectedSession, taName)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">TA Dashboard</h1>
          <p className="text-gray-500">Select or create a session to get started</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Session selection */}
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Users size={20} />
              Select Session
            </h2>

            {/* Session list */}
            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
              {sessions.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No sessions yet</p>
              ) : (
                sessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => setSelectedSession(session)}
                    className={`w-full p-3 rounded-lg text-left transition-colors flex items-center justify-between
                      ${selectedSession?.id === session.id
                        ? 'bg-blue-50 border-2 border-blue-500'
                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                      }`}
                  >
                    <div>
                      <div className="font-medium text-gray-800">{session.name}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(session.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      session.status === 'running'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {session.status}
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* New session form */}
            {showNewSession ? (
              <div className="border-t pt-4">
                <input
                  type="text"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  placeholder="Session name..."
                  className="w-full px-3 py-2 border rounded-lg mb-2"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateSession()
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateSession}
                    disabled={!newSessionName.trim()}
                    className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium disabled:opacity-50"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowNewSession(false)}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowNewSession(true)}
                className="w-full py-2 border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-lg text-gray-500 hover:text-blue-500 flex items-center justify-center gap-2 transition-colors"
              >
                <Plus size={18} />
                New Session
              </button>
            )}

            {/* TA selection */}
            <div className="border-t mt-4 pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Your Role</h3>
              <div className="flex gap-2">
                {['TA1', 'TA2'].map(ta => (
                  <button
                    key={ta}
                    onClick={() => setTaName(ta)}
                    className={`flex-1 py-2 rounded-lg font-medium transition-colors
                      ${taName === ta
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                  >
                    {ta}
                  </button>
                ))}
              </div>
            </div>

            {/* Start button */}
            <button
              onClick={handleStart}
              disabled={!selectedSession || !taName}
              className="w-full mt-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Check size={20} />
              Start Dashboard
            </button>
          </div>

          {/* Right: Join Code & QR Code (shown when session selected) */}
          {selectedSession && (
            <SessionQRCode sessionId={selectedSession.id} joinCode={selectedSession.join_code} />
          )}
        </div>
      </div>
    </div>
  )
}
