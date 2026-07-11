import { useState, useEffect } from 'react'
import { Plus, Users, Check, Clock, AlertTriangle, BookOpen, LogOut, User, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import SessionQRCode from './SessionQRCode'

// Available lessons
const AVAILABLE_LESSONS = [
  { id: 'lesson1', name: 'Lesson 1: Catch Falling Game', emoji: '🎮' },
  { id: 'lesson2', name: 'Lesson 2: AI Maze Game', emoji: '🧩' },
  { id: 'lesson3', name: 'Class 1: Zombie Survival Runner', emoji: '🧟' },
  { id: 'lesson4', name: 'Class 2: Tower Defense: Protect Your Base (Claude)', emoji: '🏰' },
  { id: 'lesson5', name: 'Class 3: Racing Game Design (Claude)', emoji: '🏎️' },
  { id: 'lesson6', name: 'Class 4: Roblox Tycoon - Planning and Core Systems', emoji: '🧱' },
  { id: 'lesson7', name: 'Class 5: Roblox Tycoon - Expanding the Tycoon', emoji: '🏗️' },
  { id: 'lesson8', name: 'Class 6: Roblox Tycoon - Completing the Game', emoji: '✅' },
  { id: 'lesson9', name: 'Class 7: Roblox Tycoon - Creativity and Polish', emoji: '✨' },
  { id: 'lesson10', name: 'Class 8: Roblox Tycoon - Publishing and Sharing', emoji: '🌐' },
];

// Short badge shown next to a session name in the session list
const LESSON_BADGES = {
  lesson1: { label: '🎮 Catch', className: 'bg-blue-100 text-blue-600' },
  lesson2: { label: '🧩 Maze', className: 'bg-purple-100 text-purple-600' },
  lesson3: { label: '🧟 Zombie', className: 'bg-green-100 text-green-600' },
  lesson4: { label: '🏰 Tower', className: 'bg-amber-100 text-amber-700' },
  lesson5: { label: '🏎️ Racing', className: 'bg-red-100 text-red-700' },
  lesson6: { label: '🧱 Core', className: 'bg-slate-100 text-slate-700' },
  lesson7: { label: '🏗️ Expand', className: 'bg-orange-100 text-orange-700' },
  lesson8: { label: '✅ Complete', className: 'bg-emerald-100 text-emerald-700' },
  lesson9: { label: '✨ Polish', className: 'bg-pink-100 text-pink-700' },
  lesson10: { label: '🌐 Publish', className: 'bg-cyan-100 text-cyan-700' },
};

export default function Setup({ taProfile, onStart, onSignOut, onEnrollment }) {
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [newSessionName, setNewSessionName] = useState('')
  const [newSessionDuration, setNewSessionDuration] = useState(90)
  const [newSessionLesson, setNewSessionLesson] = useState('lesson1')
  const [showNewSession, setShowNewSession] = useState(false)
  const [loading, setLoading] = useState(true)
  const [organization, setOrganization] = useState(null)
  const [allOrgs, setAllOrgs] = useState({}) // id -> name mapping for super_admin

  // Load organization and sessions
  useEffect(() => {
    const loadData = async () => {
      // Load organization info
      if (taProfile.role === 'super_admin') {
        // Super admin: load all organizations
        const { data: orgsData } = await supabase
          .from('organizations')
          .select('id, name, slug')

        if (orgsData) {
          const orgMap = {}
          orgsData.forEach(org => { orgMap[org.id] = org.name })
          setAllOrgs(orgMap)
        }
      } else {
        // Regular TA: load own organization
        const { data: orgData } = await supabase
          .from('organizations')
          .select('id, name, slug')
          .eq('id', taProfile.organization_id)
          .single()

        if (orgData) {
          setOrganization(orgData)
        }
      }

      // Load sessions (super_admin sees all, others see own org only)
      let query = supabase
        .from('sessions')
        .select('id, name, status, created_at, join_code, scheduled_end_at, lesson_type, organization_id')
        .order('created_at', { ascending: false })

      // Filter by organization unless super_admin
      if (taProfile.role !== 'super_admin') {
        query = query.or(`organization_id.eq.${taProfile.organization_id},organization_id.is.null`)
      }

      const { data, error } = await query

      if (!error && data) {
        setSessions(data)
      }
      setLoading(false)
    }

    loadData()
  }, [taProfile.organization_id])

  // Generate unique 4-digit join code
  const generateJoinCode = () => {
    return String(Math.floor(1000 + Math.random() * 9000))
  }

  // Create new session
  const handleCreateSession = async () => {
    if (!newSessionName.trim()) return

    const joinCode = generateJoinCode()
    const scheduledEndAt = new Date(Date.now() + newSessionDuration * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        name: newSessionName.trim(),
        status: 'running',
        join_code: joinCode,
        scheduled_end_at: scheduledEndAt,
        lesson_type: newSessionLesson,
        organization_id: taProfile.organization_id  // Associate with TA's organization
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create session:', error)
      alert('Failed to create session: ' + error.message)
      return
    }

    if (data) {
      setSessions([data, ...sessions])
      setSelectedSession(data)
      setShowNewSession(false)
      setNewSessionName('')
      setNewSessionDuration(90)
    }
  }

  // Start dashboard
  const handleStart = () => {
    if (selectedSession) {
      localStorage.setItem('session_id', selectedSession.id)
      onStart(selectedSession)
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
        {/* Header with user info */}
        <div className="flex items-center justify-between mb-8">
          <div className="text-center flex-1">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              {taProfile.role === 'super_admin' ? 'Admin Dashboard' : (organization?.name || 'TA Dashboard')}
            </h1>
            <p className="text-gray-500">Select or create a session to get started</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onEnrollment}
              className="flex items-center gap-2 px-3 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition-colors"
            >
              <UserPlus size={18} />
              <span className="text-sm font-medium">Enrollment</span>
            </button>
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-sm">
              <User size={18} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-700">{taProfile.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                taProfile.role === 'super_admin' ? 'bg-purple-100 text-purple-700' :
                taProfile.role === 'org_admin' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {taProfile.role === 'super_admin' ? 'Admin' :
                 taProfile.role === 'org_admin' ? 'Org Admin' : 'TA'}
              </span>
            </div>
            <button
              onClick={onSignOut}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              title="Sign out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: Session selection */}
          <div className="bg-white rounded-xl shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Users size={20} />
              Select Session
            </h2>

            {/* Session list */}
            <div className="space-y-2 mb-4 max-h-80 overflow-y-auto">
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
                      <div className="font-medium text-gray-800 flex items-center gap-1.5">
                        {session.name}
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          (LESSON_BADGES[session.lesson_type] || LESSON_BADGES.lesson1).className
                        }`}>
                          {(LESSON_BADGES[session.lesson_type] || LESSON_BADGES.lesson1).label}
                        </span>
                        {!session.scheduled_end_at && session.status === 'running' && (
                          <span title="No end time set - Agent time features may be limited">
                            <AlertTriangle size={14} className="text-amber-500" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(session.created_at).toLocaleDateString()}
                        {session.scheduled_end_at && (
                          <span className="ml-2 text-blue-500">
                            Ends {new Date(session.scheduled_end_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        )}
                        {taProfile.role === 'super_admin' && session.organization_id && (
                          <span className="ml-2 px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">
                            {allOrgs[session.organization_id] || 'Unknown'}
                          </span>
                        )}
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

                {/* Lesson selector */}
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen size={16} className="text-gray-500" />
                  <span className="text-sm text-gray-600">Lesson:</span>
                  <select
                    value={newSessionLesson}
                    onChange={(e) => setNewSessionLesson(e.target.value)}
                    className="flex-1 px-3 py-1.5 border rounded-lg text-sm"
                  >
                    {AVAILABLE_LESSONS.map(lesson => (
                      <option key={lesson.id} value={lesson.id}>
                        {lesson.emoji} {lesson.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Duration selector */}
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={16} className="text-gray-500" />
                  <span className="text-sm text-gray-600">Duration:</span>
                  <select
                    value={newSessionDuration}
                    onChange={(e) => setNewSessionDuration(parseInt(e.target.value))}
                    className="px-3 py-1.5 border rounded-lg text-sm"
                  >
                    <option value={60}>60 min</option>
                    <option value={75}>75 min</option>
                    <option value={90}>90 min (default)</option>
                    <option value={120}>120 min</option>
                  </select>
                </div>

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

            {/* Start button */}
            <button
              onClick={handleStart}
              disabled={!selectedSession}
              className="w-full mt-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Check size={20} />
              Start Dashboard
            </button>
          </div>

          {/* Right: Join Code & QR Code (shown when session selected) */}
          {selectedSession && (
            <SessionQRCode
              sessionId={selectedSession.id}
              joinCode={selectedSession.join_code}
              lessonId={selectedSession.lesson_type || 'lesson1'}
            />
          )}
        </div>
      </div>
    </div>
  )
}
