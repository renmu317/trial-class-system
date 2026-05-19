/**
 * P3 Pressure Test - 40 Concurrent Users
 *
 * Simulates:
 * - 40 students joining a session
 * - Various activities (design, prompt, upgrade, help)
 * - Different conversion signal patterns
 * - Sales interactions
 * - Report generation
 *
 * Usage: node scripts/p3-pressure-test.js
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://aebxtunvdtabhdtihglh.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlYnh0dW52ZHRhYmhkdGloZ2xoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMTY2NTAsImV4cCI6MjA5NDY5MjY1MH0.HoRTzgAe6LWi54BKuOAB5Tt267j-BO6iuMfpeZC_B20'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Test configuration
const NUM_STUDENTS = 40
const TEST_SESSION_NAME = `Pressure Test ${new Date().toLocaleTimeString()}`

// Student name pool
const FIRST_NAMES = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Oliver', 'Sophia', 'Elijah', 'Isabella', 'Lucas', 'Mia', 'Mason', 'Charlotte', 'Logan', 'Amelia', 'James', 'Harper', 'Benjamin', 'Evelyn', 'Jack', 'Luna', 'Henry', 'Camila', 'Alexander', 'Aria', 'Sebastian', 'Scarlett', 'Owen', 'Penelope', 'Daniel', 'Layla', 'Matthew', 'Chloe', 'Aiden', 'Victoria', 'Joseph', 'Madison', 'Samuel', 'Eleanor', 'David']

// Game name templates
const GAME_TEMPLATES = [
  'Space Adventure', 'Ninja Quest', 'Candy Crush Clone', 'Racing Madness',
  'Zombie Survival', 'Puzzle Master', 'Dragon Slayer', 'Ocean Explorer',
  'Robot Battle', 'Magic Kingdom', 'Dino Run', 'Sky Pirates',
  'Ghost Hunter', 'Treasure Island', 'Monster Tamer', 'Super Jump'
]

// Activity profiles (different user behaviors)
const ACTIVITY_PROFILES = [
  { name: 'fast_converter', weight: 0.15, signals: ['pa_asked_price', 'ch_wants_continue', 'pa_photo'] },
  { name: 'engaged_parent', weight: 0.20, signals: ['pa_stayed', 'pa_leaned_in', 'pa_surprised', 'ch_showed_parent'] },
  { name: 'curious_child', weight: 0.25, signals: ['ch_showed_parent', 'ch_explained_parent'] },
  { name: 'passive_observer', weight: 0.20, signals: ['pa_stayed'] },
  { name: 'high_intent', weight: 0.10, signals: ['pa_asked_price', 'ch_wants_continue', 'pa_photo', 'pa_surprised'] },
  { name: 'low_engagement', weight: 0.10, signals: [] }
]

// Sales intent distribution
const INTENT_DISTRIBUTION = {
  'Hot': 0.15,
  'Warm': 0.35,
  'Cold': 0.30,
  null: 0.20
}

// Timing helpers
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const randomDelay = (min, max) => sleep(Math.random() * (max - min) + min)

// Stats tracking
const stats = {
  studentsCreated: 0,
  signalsCreated: 0,
  conversionSignalsCreated: 0,
  eventsCreated: 0,
  reportsCreated: 0,
  errors: [],
  startTime: null,
  endTime: null
}

// Get random item from array
function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Get weighted random profile
function getRandomProfile() {
  const rand = Math.random()
  let cumulative = 0
  for (const profile of ACTIVITY_PROFILES) {
    cumulative += profile.weight
    if (rand <= cumulative) return profile
  }
  return ACTIVITY_PROFILES[0]
}

// Get random intent tier
function getRandomIntent() {
  const rand = Math.random()
  let cumulative = 0
  for (const [tier, weight] of Object.entries(INTENT_DISTRIBUTION)) {
    cumulative += weight
    if (rand <= cumulative) return tier === 'null' ? null : tier
  }
  return null
}

// Create test session
async function createTestSession() {
  console.log('📦 Creating test session...')

  const joinCode = Math.floor(1000 + Math.random() * 9000).toString()

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      name: TEST_SESSION_NAME,
      status: 'running',
      join_code: joinCode
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to create session:', error)
    throw error
  }

  console.log(`✅ Session created: ${data.name} (code: ${joinCode})`)
  return data
}

// Simulate a single student
async function simulateStudent(session, index) {
  const studentName = FIRST_NAMES[index % FIRST_NAMES.length] + '_' + (index + 1)
  const gameName = randomChoice(GAME_TEMPLATES) + ' ' + (index + 1)
  const profile = getRandomProfile()

  try {
    // 1. Create student
    const { data: student, error: studentError } = await supabase
      .from('students')
      .insert({
        session_id: session.id,
        name: studentName,
        device_id: `test_device_${index}_${Date.now()}`,
        game_name: gameName,
        current_step: randomChoice(['design', 'prompt', 'upgrade', 'help'])
      })
      .select()
      .single()

    if (studentError) throw studentError
    stats.studentsCreated++

    // 2. Create student_signals
    await randomDelay(100, 500)

    const signalData = {
      student_id: student.id,
      // Competence Loop (auto)
      cl_game_made: Math.random() > 0.2,
      cl_game_played: Math.random() > 0.4,
      cl_game_modified: Math.random() > 0.5,
      // Ownership
      ow_named: Math.random() > 0.3,
      ow_custom_name: Math.random() > 0.6,
      ow_showed: Math.random() > 0.5,
      ow_explained: Math.random() > 0.7,
      // Persistence
      ps_got_stuck: Math.random() > 0.6,
      ps_recovered: Math.random() > 0.5,
      ps_asked_help: Math.random() > 0.7,
      // Challenge Seed
      cs_used_hard: Math.random() > 0.7,
      cs_used_medium: Math.random() > 0.4,
      cs_own_idea: Math.random() > 0.6,
      cs_verbal_want: Math.random() > 0.5,
      cs_kept_working: Math.random() > 0.4,
      // Parent Signal (based on profile)
      pr_took_photo: profile.signals.includes('pa_photo'),
      pr_asked_price: profile.signals.includes('pa_asked_price'),
      pr_stayed_long: profile.signals.includes('pa_stayed'),
      pr_looked_screen: profile.signals.includes('pa_leaned_in')
    }

    const { error: signalError } = await supabase
      .from('student_signals')
      .insert(signalData)

    if (signalError && !signalError.message.includes('duplicate')) {
      console.warn(`Signal warning for ${studentName}:`, signalError.message)
    } else {
      stats.signalsCreated++
    }

    // 3. Create conversion_signals (P3)
    await randomDelay(100, 300)

    const intentTier = getRandomIntent()
    const conversionData = {
      session_id: session.id,
      student_id: student.id,
      // TA signals (based on profile)
      pa_stayed: profile.signals.includes('pa_stayed'),
      pa_photo: profile.signals.includes('pa_photo'),
      pa_asked_price: profile.signals.includes('pa_asked_price'),
      pa_leaned_in: profile.signals.includes('pa_leaned_in'),
      pa_surprised: profile.signals.includes('pa_surprised'),
      ch_showed_parent: profile.signals.includes('ch_showed_parent'),
      ch_wants_continue: profile.signals.includes('ch_wants_continue'),
      ch_explained_parent: profile.signals.includes('ch_explained_parent'),
      // Sales signals
      sale_qr_shown: intentTier === 'Hot' || (intentTier === 'Warm' && Math.random() > 0.5),
      sale_deposit_taken: intentTier === 'Hot' && Math.random() > 0.3,
      sale_intent_tier: intentTier,
      sale_notes: intentTier ? `Test note for ${studentName} - ${profile.name}` : null,
      // Auto signals (simulated report interaction)
      rep_opened: Math.random() > 0.4,
      rep_read_depth: Math.random() > 0.6,
      rep_cta_clicked: Math.random() > 0.7
    }

    const { error: convError } = await supabase
      .from('conversion_signals')
      .insert(conversionData)

    if (convError && !convError.message.includes('duplicate')) {
      console.warn(`Conversion signal warning for ${studentName}:`, convError.message)
    } else {
      stats.conversionSignalsCreated++
    }

    // 4. Create some events
    await randomDelay(50, 200)

    const eventTypes = [
      { type: 'prompt_generated', dimension: 'competence' },
      { type: 'upgrade_selected', dimension: 'ownership' },
      { type: 'help_requested', dimension: 'persistence' },
      { type: 'hard_challenge_opened', dimension: 'curiosity' },
      { type: 'game_named', dimension: 'ownership' }
    ]

    const numEvents = Math.floor(Math.random() * 5) + 1
    for (let i = 0; i < numEvents; i++) {
      const event = randomChoice(eventTypes)

      const { error: eventError } = await supabase
        .from('student_events')
        .insert({
          student_id: student.id,
          event_type: event.type,
          dimension: event.dimension,
          data: { test: true, index: i }
        })

      if (!eventError) stats.eventsCreated++
      await randomDelay(20, 100)
    }

    // 5. Maybe create a report (for high intent students)
    if (profile.name === 'fast_converter' || profile.name === 'high_intent') {
      await randomDelay(100, 300)

      const { error: reportError } = await supabase
        .from('reports')
        .insert({
          session_id: session.id,
          student_id: student.id,
          content_zh: `${studentName} 今天表现出色！在试课中展现了很强的创造力和学习热情。`,
          content_en: `${studentName} did great today! Showed strong creativity and enthusiasm during the trial class.`,
          pathway_zh: '建议从基础游戏设计开始，逐步深入编程概念。',
          pathway_en: 'Recommend starting with basic game design, gradually introducing programming concepts.',
          cta_tier: intentTier === 'Hot' ? 'hot' : 'warm'
        })

      if (!reportError) stats.reportsCreated++
    }

    console.log(`✅ [${index + 1}/${NUM_STUDENTS}] ${studentName} (${profile.name}) - Intent: ${intentTier || 'none'}`)

  } catch (error) {
    console.error(`❌ Error for student ${index}:`, error.message)
    stats.errors.push({ index, error: error.message })
  }
}

// Main test runner
async function runPressureTest() {
  console.log('🚀 Starting P3 Pressure Test')
  console.log(`   Students: ${NUM_STUDENTS}`)
  console.log(`   Profiles: ${ACTIVITY_PROFILES.map(p => p.name).join(', ')}`)
  console.log('')

  stats.startTime = Date.now()

  try {
    // Create session
    const session = await createTestSession()
    console.log('')

    // Simulate students in batches (to avoid overwhelming)
    const BATCH_SIZE = 10
    const batches = Math.ceil(NUM_STUDENTS / BATCH_SIZE)

    for (let batch = 0; batch < batches; batch++) {
      const start = batch * BATCH_SIZE
      const end = Math.min(start + BATCH_SIZE, NUM_STUDENTS)

      console.log(`\n📦 Batch ${batch + 1}/${batches} (students ${start + 1}-${end})`)

      const promises = []
      for (let i = start; i < end; i++) {
        promises.push(simulateStudent(session, i))
        await sleep(50) // Stagger starts slightly
      }

      await Promise.all(promises)

      // Brief pause between batches
      if (batch < batches - 1) {
        console.log('   ⏳ Batch complete, pausing...')
        await sleep(500)
      }
    }

    stats.endTime = Date.now()

    // Print results
    console.log('\n' + '='.repeat(50))
    console.log('📊 PRESSURE TEST RESULTS')
    console.log('='.repeat(50))
    console.log(`⏱️  Duration: ${((stats.endTime - stats.startTime) / 1000).toFixed(2)}s`)
    console.log(`👤 Students created: ${stats.studentsCreated}/${NUM_STUDENTS}`)
    console.log(`📶 Signals created: ${stats.signalsCreated}`)
    console.log(`💰 Conversion signals: ${stats.conversionSignalsCreated}`)
    console.log(`📝 Events created: ${stats.eventsCreated}`)
    console.log(`📄 Reports created: ${stats.reportsCreated}`)
    console.log(`❌ Errors: ${stats.errors.length}`)

    if (stats.errors.length > 0) {
      console.log('\nError details:')
      stats.errors.forEach(e => console.log(`   - Student ${e.index}: ${e.error}`))
    }

    // Calculate rates
    const totalOps = stats.studentsCreated + stats.signalsCreated +
                     stats.conversionSignalsCreated + stats.eventsCreated +
                     stats.reportsCreated
    const duration = (stats.endTime - stats.startTime) / 1000
    console.log(`\n📈 Throughput: ${(totalOps / duration).toFixed(1)} ops/sec`)

    console.log('\n✅ Pressure test complete!')
    console.log(`   Session: ${TEST_SESSION_NAME}`)
    console.log(`   View in TA Dashboard: http://localhost:5177`)
    console.log(`   View in Sales App: http://localhost:5179`)

  } catch (error) {
    console.error('💥 Test failed:', error)
    process.exit(1)
  }
}

// Run
runPressureTest()
