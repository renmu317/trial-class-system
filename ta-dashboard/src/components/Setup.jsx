import { useState, useEffect } from 'react'
import { Plus, Users, Check, Clock, AlertTriangle, BookOpen } from 'lucide-react'
import { supabase } from '../lib/supabase'
import SessionQRCode from './SessionQRCode'

// Available lessons
const AVAILABLE_LESSONS = [
  { id: 'lesson1', name: 'Lesson 1: Catch Falling Game', emoji: '🎮' },
  { id: 'lesson2', name: 'Lesson 2: AI Maze Game', emoji: '🧩' },
];

export default function Setup({ onStart }) {
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [taName, setTaName] = useState('')
  const [newSessionName, setNewSessionName] = useState('')
  const [newSessionDuration, setNewSessionDuration] = useState(90) // V17: 默认90分钟
  const [newSessionLesson, setNewSessionLesson] = useState('lesson1') // 默认 Lesson 1
  const [showNewSession, setShowNewSession] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load sessions
  useEffect(() => {
    const loadSessions = async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, name, status, created_at, join_code, scheduled_end_at, lesson_type')
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

    // V17: 计算结束时间
    const scheduledEndAt = new Date(Date.now() + newSessionDuration * 60 * 1000).toISOString()

    // Try with all columns first
    let result = await supabase
      .from('sessions')
      .insert({
        name: newSessionName.trim(),
        status: 'running',
        join_code: joinCode,
        scheduled_end_at: scheduledEndAt,
        lesson_type: newSessionLesson  // 写入课程类型
      })
      .select()
      .single()

    // If failed due to missing column, try without newer columns
    if (result.error && result.error.code === 'PGRST204') {
      console.warn('Some columns not found, creating session with basic fields')
      result = await supabase
        .from('sessions')
        .insert({
          name: newSessionName.trim(),
          status: 'running',
          join_code: joinCode
        })
        .select()
        .single()
    }

    if (result.error) {
      console.error('Failed to create session:', result.error)
      alert('Failed to create session: ' + result.error.message)
      return
    }

    if (result.data) {
      setSessions([result.data, ...sessions])
      setSelectedSession(result.data)
      setShowNewSession(false)
      setNewSessionName('')
      setNewSessionDuration(90) // 重置为默认值
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
                      <div className="font-medium text-gray-800 flex items-center gap-1.5">
                        {session.name}
                        {/* 课程类型标签 */}
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          session.lesson_type === 'lesson2'
                            ? 'bg-purple-100 text-purple-600'
                            : 'bg-blue-100 text-blue-600'
                        }`}>
                          {session.lesson_type === 'lesson2' ? '🧩 Maze' : '🎮 Catch'}
                        </span>
                        {/* V17: 没有结束时间的提示 */}
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

                {/* V17: 课时时长选择器 */}
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
