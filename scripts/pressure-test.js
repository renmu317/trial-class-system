/**
 * Pressure Test Script for Trial Class System
 * Simulates 20 students joining and interacting with the system
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://aebxtunvdtabhdtihglh.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlYnh0dW52ZHRhYmhkdGloZ2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMTY2NTAsImV4cCI6MjA5NDY5MjY1MH0.HoRTzgAe6LWi54BKuOAB5Tt267j-BO6iuMfpeZC_B20'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Student names for simulation
const STUDENT_NAMES = [
  'Alice', 'Bob', 'Charlie', 'Diana', 'Emma',
  'Frank', 'Grace', 'Henry', 'Ivy', 'Jack',
  'Kate', 'Leo', 'Mia', 'Noah', 'Olivia',
  'Peter', 'Quinn', 'Ruby', 'Sam', 'Tina'
]

// Game name templates
const GAME_NAMES = [
  'Star Catcher', 'Dragon Quest', 'Space Adventure', 'Ninja Run',
  'Puzzle Master', 'Racing Fever', 'Zombie Escape', 'Magic World',
  'Robot Battle', 'Ocean Explorer', 'Sky Jumper', 'Treasure Hunt',
  'Monster Hunter', 'Castle Defense', 'Fruit Ninja', 'Ball Bounce',
  'Color Match', 'Word Wizard', 'Music Maker', 'Art Studio'
]

// Event types that students can generate
// Using correct dimension values from DB constraint: ownership, persistence, curiosity, expression, parent_signal
const EVENT_TYPES = [
  { type: 'prompt_generated', dimension: 'curiosity' },
  { type: 'prompt_tab_revisited', dimension: 'curiosity' },
  { type: 'upgrade_selected', dimension: 'curiosity' },
  { type: 'game_named', dimension: 'ownership' },
  { type: 'help_requested', dimension: 'persistence' },
  { type: 'medium_challenge_opened', dimension: 'curiosity' },
  { type: 'hard_challenge_opened', dimension: 'curiosity' },
  { type: 'upgrade_own_idea_submitted', dimension: 'expression' }
]

// Random delay helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Generate random join code
const generateJoinCode = () => String(Math.floor(1000 + Math.random() * 9000))

// Main test function
async function runPressureTest() {
  console.log('='.repeat(60))
  console.log('PRESSURE TEST - Trial Class System')
  console.log('='.repeat(60))
  console.log(`Starting test with ${STUDENT_NAMES.length} simulated students\n`)

  const startTime = Date.now()

  // Step 1: Create test session
  console.log('[1/5] Creating test session...')
  const joinCode = generateJoinCode()
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      name: `Pressure Test ${new Date().toLocaleString()}`,
      status: 'running',
      join_code: joinCode
    })
    .select()
    .single()

  if (sessionError) {
    console.error('Failed to create session:', sessionError)
    return
  }
  console.log(`   Session created: ${session.name}`)
  console.log(`   Join code: ${joinCode}`)
  console.log(`   Session ID: ${session.id}\n`)

  // Step 2: Create 20 students concurrently
  console.log('[2/5] Creating 20 students concurrently...')
  const studentPromises = STUDENT_NAMES.map(async (name, index) => {
    const { data, error } = await supabase
      .from('students')
      .insert({
        session_id: session.id,
        name: name,
        device_id: `test-device-${index}`,
        game_name: GAME_NAMES[index],
        current_step: 'design'
      })
      .select()
      .single()

    if (error) {
      console.error(`   Failed to create student ${name}:`, error.message)
      return null
    }
    return data
  })

  const students = (await Promise.all(studentPromises)).filter(s => s !== null)
  console.log(`   Created ${students.length} students\n`)

  // Step 3: Initialize signals for all students
  // Using correct column names from V17 schema
  console.log('[3/5] Initializing signals for all students...')
  const signalPromises = students.map(async (student) => {
    const { error } = await supabase
      .from('student_signals')
      .upsert({
        student_id: student.id,
        // Competence Loop
        cl_game_made: false,
        cl_game_played: false,
        cl_game_modified: false,
        // Ownership
        ow_named: false,
        ow_showed: false,
        ow_explained: false,
        // Persistence
        ps_got_stuck: false,
        ps_asked_help: false,
        ps_recovered: false,
        // Challenge Seed
        cs_used_medium: false,
        cs_used_hard: false,
        cs_own_idea: false,
        cs_verbal_want: false,
        cs_kept_working: false,
        // Parent Signal (pr_ prefix!)
        pr_took_photo: false,
        pr_asked_price: false,
        pr_stayed_long: false,
        pr_looked_screen: false
      }, { onConflict: 'student_id' })

    if (error) {
      console.error(`   Failed to init signals for ${student.name}:`, error.message)
      return false
    }
    return true
  })

  const signalResults = await Promise.all(signalPromises)
  const successfulSignals = signalResults.filter(r => r).length
  console.log(`   Signals initialized: ${successfulSignals}/${students.length}\n`)

  // Step 4: Simulate student activities (events)
  console.log('[4/5] Simulating student activities...')
  let totalEvents = 0

  // Each student generates 3-8 random events
  const activityPromises = students.map(async (student) => {
    const numEvents = 3 + Math.floor(Math.random() * 6) // 3-8 events
    const studentEvents = []

    for (let i = 0; i < numEvents; i++) {
      const eventTemplate = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)]

      const event = {
        student_id: student.id,
        event_type: eventTemplate.type,
        dimension: eventTemplate.dimension,
        data: {
          simulated: true,
          timestamp: new Date().toISOString(),
          student_name: student.name
        }
      }
      studentEvents.push(event)
    }

    // Insert all events for this student
    const { error } = await supabase
      .from('student_events')
      .insert(studentEvents)

    if (error) {
      console.error(`   Failed to insert events for ${student.name}:`, error.message)
      return 0
    }

    // Update signals based on events
    const signalUpdates = {}
    studentEvents.forEach(e => {
      switch (e.event_type) {
        case 'prompt_generated': signalUpdates.cl_game_made = true; break
        case 'prompt_tab_revisited': signalUpdates.cl_game_played = true; break
        case 'upgrade_selected': signalUpdates.cl_game_modified = true; break
        case 'game_named': signalUpdates.ow_named = true; break
        case 'help_requested': signalUpdates.ps_asked_help = true; break
        case 'medium_challenge_opened': signalUpdates.cs_used_medium = true; break
        case 'hard_challenge_opened': signalUpdates.cs_used_hard = true; break
        case 'upgrade_own_idea_submitted': signalUpdates.cs_own_idea = true; break
      }
    })

    if (Object.keys(signalUpdates).length > 0) {
      await supabase
        .from('student_signals')
        .update(signalUpdates)
        .eq('student_id', student.id)
    }

    // Update student step randomly
    const steps = ['design', 'prompt', 'upgrade', 'recovery']
    await supabase
      .from('students')
      .update({
        current_step: steps[Math.floor(Math.random() * steps.length)],
        updated_at: new Date().toISOString()
      })
      .eq('id', student.id)

    return studentEvents.length
  })

  const eventCounts = await Promise.all(activityPromises)
  totalEvents = eventCounts.reduce((a, b) => a + b, 0)
  console.log(`   Generated ${totalEvents} events across all students\n`)

  // Step 5: Simulate some TA signals (manual checkboxes)
  console.log('[5/5] Simulating TA observations...')
  const taSignalPromises = students.slice(0, 10).map(async (student) => {
    // Randomly set some TA-observed signals (using correct column names)
    const taSignals = {}
    if (Math.random() > 0.5) taSignals.ow_showed = true
    if (Math.random() > 0.5) taSignals.ow_explained = true
    if (Math.random() > 0.5) taSignals.cs_verbal_want = true
    if (Math.random() > 0.7) taSignals.pr_took_photo = true
    if (Math.random() > 0.7) taSignals.pr_asked_price = true
    if (Math.random() > 0.5) taSignals.pr_stayed_long = true
    if (Math.random() > 0.5) taSignals.pr_looked_screen = true

    if (Object.keys(taSignals).length > 0) {
      const { error } = await supabase
        .from('student_signals')
        .update(taSignals)
        .eq('student_id', student.id)

      if (error) {
        console.error(`   Failed to update TA signals for ${student.name}:`, error.message)
      }
    }
  })

  await Promise.all(taSignalPromises)
  console.log(`   TA observations simulated for first 10 students\n`)

  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
  console.log('='.repeat(60))
  console.log('TEST COMPLETE')
  console.log('='.repeat(60))
  console.log(`Time elapsed: ${elapsed} seconds`)
  console.log(`Session: ${session.name}`)
  console.log(`Join code: ${joinCode}`)
  console.log(`Students created: ${students.length}`)
  console.log(`Events generated: ${totalEvents}`)
  console.log('')
  console.log('To view results:')
  console.log(`  TA Dashboard: https://ta-dashboard-xi.vercel.app`)
  console.log(`  Select session: "${session.name}"`)
  console.log('='.repeat(60))
}

// Run the test
runPressureTest().catch(console.error)
