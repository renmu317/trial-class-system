/**
 * Clear all mock data and run 40-person pressure test
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://aebxtunvdtabhdtihglh.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlYnh0dW52ZHRhYmhkdGloZ2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMTY2NTAsImV4cCI6MjA5NDY5MjY1MH0.HoRTzgAe6LWi54BKuOAB5Tt267j-BO6iuMfpeZC_B20'

const supabase = createClient(supabaseUrl, supabaseKey)

// Test data
const STUDENT_NAMES = [
  'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Ethan', 'Sophia', 'Mason',
  'Isabella', 'William', 'Mia', 'James', 'Charlotte', 'Oliver', 'Amelia',
  'Benjamin', 'Harper', 'Lucas', 'Evelyn', 'Henry', 'Luna', 'Alexander',
  'Camila', 'Michael', 'Gianna', 'Daniel', 'Abigail', 'Matthew', 'Ella',
  'Sebastian', 'Aria', 'Jack', 'Scarlett', 'Aiden', 'Grace', 'Owen',
  'Chloe', 'Samuel', 'Penelope', 'Ryan'
]

const GAME_NAMES = [
  'Dragon Quest', 'Space Blaster', 'Ninja Run', 'Robot Wars', 'Magic Castle',
  'Ocean Explorer', 'Jungle Jump', 'Sky Racer', 'Monster Maze', 'Pixel Hero'
]

async function clearAllData() {
  console.log('Clearing all mock data...')

  // Clear in order due to foreign keys
  const tables = ['reports', 'conversion_signals', 'student_signals', 'students', 'sessions']

  for (const table of tables) {
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      console.log(`  Warning ${table}: ${error.message}`)
    } else {
      console.log(`  Done: ${table} cleared`)
    }
  }

  console.log('All data cleared\n')
}

async function runPressureTest() {
  console.log('Starting 40-person pressure test...\n')
  const startTime = Date.now()

  // 1. Create session
  console.log('1. Creating session...')
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      name: 'Pressure Test ' + new Date().toLocaleString(),
      status: 'running'
    })
    .select()
    .single()

  if (sessionError) {
    console.error('Failed to create session:', sessionError)
    return
  }
  console.log('   Session created: ' + session.id + '\n')

  // 2. Create 40 students in parallel
  console.log('2. Creating 40 students...')
  const studentPromises = STUDENT_NAMES.map((name, i) =>
    supabase.from('students').insert({
      session_id: session.id,
      name: name,
      game_name: GAME_NAMES[i % GAME_NAMES.length],
      current_step: Math.floor(Math.random() * 5) + 1
    }).select().single()
  )

  const studentResults = await Promise.all(studentPromises)
  const students = studentResults.filter(r => r.data).map(r => r.data)
  console.log('   ' + students.length + ' students created\n')

  // 3. Create student_signals for each student
  console.log('3. Creating student signals...')
  const signalPromises = students.map(student =>
    supabase.from('student_signals').insert({
      session_id: session.id,
      student_id: student.id,
      cl_game_made: Math.random() > 0.3,
      cl_game_played: Math.random() > 0.2,
      cl_game_modified: Math.random() > 0.5,
      ow_named: Math.random() > 0.4,
      ow_custom_name: Math.random() > 0.6,
      ow_showed: Math.random() > 0.5,
      ow_explained: Math.random() > 0.7,
      ps_got_stuck: Math.random() > 0.6,
      ps_recovered: Math.random() > 0.5,
      ps_asked_help: Math.random() > 0.7,
      cs_used_hard: Math.random() > 0.8,
      cs_used_medium: Math.random() > 0.5,
      cs_own_idea: Math.random() > 0.6,
      cs_verbal_want: Math.random() > 0.7,
      cs_kept_working: Math.random() > 0.4,
      pr_took_photo: Math.random() > 0.7,
      pr_asked_price: Math.random() > 0.8,
      pr_stayed_long: Math.random() > 0.5,
      pr_looked_screen: Math.random() > 0.3
    })
  )

  await Promise.all(signalPromises)
  console.log('   ' + students.length + ' student signals created\n')

  // 4. Create conversion_signals for each student
  console.log('4. Creating conversion signals...')
  const conversionPromises = students.map(student => {
    const isHot = Math.random() > 0.7
    const isWarm = !isHot && Math.random() > 0.5

    return supabase.from('conversion_signals').insert({
      session_id: session.id,
      student_id: student.id,
      pa_stayed: Math.random() > 0.4,
      pa_photo: Math.random() > 0.6,
      pa_asked_price: Math.random() > 0.7,
      pa_leaned_in: Math.random() > 0.5,
      pa_surprised: Math.random() > 0.6,
      ch_showed_parent: Math.random() > 0.5,
      ch_wants_continue: Math.random() > 0.6,
      ch_explained_parent: Math.random() > 0.7,
      sale_qr_shown: Math.random() > 0.8,
      sale_deposit_taken: Math.random() > 0.85,
      sale_intent_tier: isHot ? 'Hot' : isWarm ? 'Warm' : 'Cold'
    })
  })

  await Promise.all(conversionPromises)
  console.log('   ' + students.length + ' conversion signals created\n')

  // 5. Create reports for some students (30%)
  console.log('5. Creating reports...')
  const studentsWithReports = students.filter(() => Math.random() > 0.7)
  const reportPromises = studentsWithReports.map(student =>
    supabase.from('reports').insert({
      session_id: session.id,
      student_id: student.id,
      content_zh: student.name + '今天在试课中表现出色，展现了良好的创造力和学习热情。',
      content_en: student.name + ' showed excellent performance in todays trial class with great creativity.',
      pathway_zh: '建议从第1课开始，循序渐进学习游戏设计基础。',
      pathway_en: 'Recommend starting from Lesson 1, progressively learning game design basics.',
      cta_tier: Math.random() > 0.5 ? 'hot' : 'warm',
      sent_at: Math.random() > 0.5 ? new Date().toISOString() : null
    })
  )

  await Promise.all(reportPromises)
  console.log('   ' + studentsWithReports.length + ' reports created\n')

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2)
  const totalOps = 1 + students.length * 4 + studentsWithReports.length

  console.log('==================================================')
  console.log('PRESSURE TEST RESULTS')
  console.log('==================================================')
  console.log('Session:            ' + session.id)
  console.log('Students:           ' + students.length)
  console.log('Student Signals:    ' + students.length)
  console.log('Conversion Signals: ' + students.length)
  console.log('Reports:            ' + studentsWithReports.length)
  console.log('Total Operations:   ' + totalOps)
  console.log('Duration:           ' + duration + 's')
  console.log('Throughput:         ' + (totalOps / duration).toFixed(1) + ' ops/sec')
  console.log('==================================================')
  console.log('\nPressure test completed!')
  console.log('\nView in Sales App: https://sales-app-chi-two.vercel.app')
  console.log('View in TA Dashboard: https://ta-dashboard-xi.vercel.app')
}

// Run
await clearAllData()
await runPressureTest()
