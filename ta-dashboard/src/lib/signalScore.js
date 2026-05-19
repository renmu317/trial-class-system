// V17 Signal-based Conversion Score

export function calculateConversionScore(signals) {
  if (!signals) return null

  // Dimension weights (based on conversion importance)
  const weights = {
    competence: 2.0,     // Most important: can make something
    ownership: 1.5,      // Important: has ownership
    persistence: 1.0,    // Medium: can persist
    challenge: 1.5,      // Important: wants more
    parent: 2.5          // Most important: parent will pay
  }

  // Calculate each dimension score (0-1)
  const dimensionScores = {
    competence: average([
      signals.cl_game_made,
      signals.cl_game_played,
      signals.cl_game_modified
    ]),

    ownership: average([
      signals.ow_named,
      signals.ow_showed,
      signals.ow_explained
    ]),

    persistence: calculatePersistence(signals),

    challenge: average([
      signals.cs_used_hard || signals.cs_used_medium,  // Used any difficulty
      signals.cs_own_idea,
      signals.cs_verbal_want,
      signals.cs_kept_working
    ]),

    parent: average([
      signals.pr_took_photo,
      signals.pr_asked_price,
      signals.pr_stayed_long,
      signals.pr_looked_screen
    ])
  }

  // Weighted average
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0)
  const weightedSum = Object.entries(weights).reduce(
    (sum, [key, weight]) => sum + (dimensionScores[key] || 0) * weight,
    0
  )

  return (weightedSum / totalWeight).toFixed(2)
}

function average(booleans) {
  const valid = booleans.filter(b => b !== null && b !== undefined)
  if (valid.length === 0) return 0
  return valid.filter(Boolean).length / valid.length
}

function calculatePersistence(signals) {
  // Special logic: no stuck = full score, stuck + recovered = full score, stuck not recovered = 0
  if (!signals.ps_got_stuck) return 1
  if (signals.ps_recovered) return 1
  // Stuck but asked for help = 0.5
  if (signals.ps_asked_help) return 0.5
  return 0
}

// Calculate dimension completion counts for UI
export function getDimensionStatus(signals) {
  if (!signals) {
    return {
      competence: { count: 0, total: 3, items: [] },
      ownership: { count: 0, total: 3, items: [] },
      persistence: { count: 0, total: 3, items: [] },
      challenge: { count: 0, total: 4, items: [] },
      parent: { count: 0, total: 4, items: [] }
    }
  }

  return {
    competence: {
      count: [signals.cl_game_made, signals.cl_game_played, signals.cl_game_modified].filter(Boolean).length,
      total: 3,
      items: [
        { key: 'cl_game_made', label: 'Made game', value: signals.cl_game_made, auto: true },
        { key: 'cl_game_played', label: 'Played', value: signals.cl_game_played, auto: true },
        { key: 'cl_game_modified', label: 'Modified', value: signals.cl_game_modified, auto: true }
      ]
    },
    ownership: {
      count: [signals.ow_named, signals.ow_showed, signals.ow_explained].filter(Boolean).length,
      total: 3,
      items: [
        { key: 'ow_named', label: signals.ow_custom_name ? `Named: "${signals.ow_custom_name}"` : 'Named', value: signals.ow_named, auto: true },
        { key: 'ow_showed', label: 'Showed to peer', value: signals.ow_showed, auto: false },
        { key: 'ow_explained', label: 'Explained to TA', value: signals.ow_explained, auto: false }
      ]
    },
    persistence: {
      count: calculatePersistenceCount(signals),
      total: 3,
      items: [
        { key: 'ps_got_stuck', label: 'Got stuck (3m+)', value: signals.ps_got_stuck, auto: true, neutral: true },
        { key: 'ps_recovered', label: 'Recovered', value: signals.ps_recovered, auto: true },
        { key: 'ps_asked_help', label: 'Asked help', value: signals.ps_asked_help, auto: true }
      ]
    },
    challenge: {
      count: [
        signals.cs_used_hard || signals.cs_used_medium,
        signals.cs_own_idea,
        signals.cs_verbal_want,
        signals.cs_kept_working
      ].filter(Boolean).length,
      total: 4,
      items: [
        { key: 'cs_used_hard', label: 'Hard level', value: signals.cs_used_hard, auto: true },
        { key: 'cs_used_medium', label: 'Medium level', value: signals.cs_used_medium, auto: true },
        { key: 'cs_own_idea', label: 'Own idea', value: signals.cs_own_idea, auto: true },
        { key: 'cs_verbal_want', label: 'Said "I want to add..."', value: signals.cs_verbal_want, auto: false }
      ]
    },
    parent: {
      count: [signals.pr_took_photo, signals.pr_asked_price, signals.pr_stayed_long, signals.pr_looked_screen].filter(Boolean).length,
      total: 4,
      items: [
        { key: 'pr_took_photo', label: 'Took photo', value: signals.pr_took_photo, auto: false },
        { key: 'pr_asked_price', label: 'Asked price', value: signals.pr_asked_price, auto: false },
        { key: 'pr_stayed_long', label: 'Stayed >5min', value: signals.pr_stayed_long, auto: false },
        { key: 'pr_looked_screen', label: 'Looked at screen', value: signals.pr_looked_screen, auto: false }
      ]
    }
  }
}

function calculatePersistenceCount(signals) {
  // Persistence is special: no stuck = good (3/3), stuck + recovered = good (3/3)
  if (!signals.ps_got_stuck) return 3
  let count = 1 // Got stuck counts
  if (signals.ps_recovered) count++
  if (signals.ps_asked_help) count++
  return count
}

// Auto-signals that can be derived from events
export function deriveAutoSignals(events, currentSignals) {
  const signals = { ...currentSignals }

  if (!events || events.length === 0) return signals

  // Check events to derive signals
  events.forEach(e => {
    switch (e.event_type) {
      case 'prompt_generated':
        signals.cl_game_made = true
        break
      case 'prompt_tab_revisited':
        signals.cl_game_played = true
        break
      case 'upgrade_selected':
        signals.cl_game_modified = true
        break
      case 'game_named':
        signals.ow_named = true
        if (e.data?.isCustomName && e.data?.new) {
          signals.ow_custom_name = e.data.new
        }
        break
      case 'help_requested':
        signals.ps_asked_help = true
        break
      case 'hard_challenge_opened':
        signals.cs_used_hard = true
        break
      case 'medium_challenge_opened':
        signals.cs_used_medium = true
        break
      case 'upgrade_own_idea_submitted':
        signals.cs_own_idea = true
        break
    }
  })

  return signals
}

// Detect if student is stuck (>3 min no event)
export function detectStuck(lastEventTime) {
  if (!lastEventTime) return false
  const minutesSinceLastEvent = (Date.now() - new Date(lastEventTime).getTime()) / 60000
  return minutesSinceLastEvent > 3
}
