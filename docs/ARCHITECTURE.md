# Education OS - Architecture Design

## V17 Agent System - Complete Architecture Refactor Plan

### Why Refactor

#### Three Fundamental Problems with Existing Architecture

**Problem 1: System Prompt is a Rule List, Not a Role Description**

Every new bug adds a new rule. Orchestrator now exceeds 800+ tokens:
- Forbidden question lists
- Q-state injection
- Pre-knowledge patterns
- Opening rules
- JSON constraints
- Round reset instructions

More rules → Lower DeepSeek compliance → Need more rules → Death spiral.

**Problem 2: State Management Scattered Across Three Places**

```
React State: currentMode / toolRound / upgradeQuotes / pendingVerification
Supabase: agent_sessions / debug_sessions (independent)
System Prompt: Tells agent "where you are"
```

Synchronizing three state sources is fragile. Any error gives the agent wrong information.

**Problem 3: Cross-Tab Context Loss**

Upgrade Tab's Gate 1 conversation and Debug Tab's Debug conversation don't know about each other. Debug Agent referencing Gate 1's best_quote requires special design (buildStudentContext), but fundamentally they're the same student's continuous story in the same class.

### Target Architecture Principles

```
Principle 1: Conversation History Handles State Management
  Tool call results enter conversation history as system turns
  Agent infers state from complete conversation history, not external variables
  Reference: ChatGPT Function Calling turn structure

Principle 2: Single Timeline Unifies Cross-Tab Context
  session_timeline records all events from all tabs
  Any agent call reads timeline, naturally knows complete background
  Reference: Claude.ai's complete conversation history driven approach

Principle 3: System Prompt Only Describes Role
  150 tokens, no state management logic
  State provided by system turns in conversation history
  Simple rules (fix_quality evaluation) executed by code, not model
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Code Layer (Deterministic)                                  │
│  round counting / fix_quality evaluation / all_covered check │
│  Don't let model make rule judgments                         │
└──────────────────┬──────────────────────────────────────────┘
                   ↓ Tool call results write to
┌──────────────────▼──────────────────────────────────────────┐
│  Conversation History Layer (ChatGPT Function Calling)       │
│  Tool call results as system turns                           │
│  Trim strategy: current tool full / completed tools compress │
│              / resolved chats summarize                      │
└──────────────────┬──────────────────────────────────────────┘
                   ↓ Format and inject
┌──────────────────▼──────────────────────────────────────────┐
│  Timeline Layer (Solves cross-tab problem)                   │
│  session_timeline: all tabs, all events                      │
│  formatForAgent(): converts to natural language context      │
└──────────────────┬──────────────────────────────────────────┘
                   ↓ Write/Read
┌──────────────────▼──────────────────────────────────────────┐
│  Memory Layer (ChatGPT Memory inspired)                      │
│  Hot: current session complete timeline                      │
│  Warm: last 1-3 session summaries (compressed at class end)  │
│  Cold: student profiles (generated after 3+ classes)         │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌──────────────────▼──────────────────────────────────────────┐
│  Model Layer (Claude.ai inspired)                            │
│  System Prompt: 150 tokens, role description only            │
│  Model only does language generation, not state inference    │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Tables

### session_timeline (Core)

```sql
CREATE TABLE session_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  project_id uuid DEFAULT NULL,        -- Reserved for cross-class projects
  created_at timestamptz DEFAULT now(),

  event_type text NOT NULL,
  -- 'build_complete' | 'prompt_generated' | 'prompt_copied'
  -- 'gate1_round' | 'gate1_complete'
  -- 'gate2_verify' | 'gate2_complete'
  -- 'debug_message' | 'debug_complete'
  -- 'game_regenerated'

  upgrade_id text,
  lesson_type text,
  role text,                           -- 'student' | 'agent' | 'system'
  content text NOT NULL,

  metadata jsonb DEFAULT '{}',
  visible_to_agent boolean DEFAULT true,
  is_system_marker boolean DEFAULT false,
  display_in_ui boolean DEFAULT true
);

CREATE INDEX idx_timeline_student_session
  ON session_timeline(student_id, session_id, created_at);
```

### session_summaries (Warm Memory)

```sql
CREATE TABLE session_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id),
  session_id uuid REFERENCES sessions(id),
  created_at timestamptz DEFAULT now(),
  summary_text text,    -- 150 tokens natural language summary
  summary_data jsonb    -- Structured data for reports
);
```

### student_profiles (Cold Memory)

```sql
CREATE TABLE student_profiles (
  student_id uuid PRIMARY KEY REFERENCES students(id),
  updated_at timestamptz DEFAULT now(),
  profile_text text,    -- 100 tokens ability profile
  profile_data jsonb
);
```

---

## Timeline Module

### Write Functions

```javascript
import { supabase } from './supabase'

// Unified write entry
export async function writeEvent(studentId, sessionId, event) {
  await supabase.from('session_timeline').insert({
    student_id: studentId,
    session_id: sessionId,
    lesson_type: event.lessonType,
    event_type: event.type,
    upgrade_id: event.upgradeId || null,
    role: event.role,
    content: event.content,
    metadata: event.metadata || {},
    visible_to_agent: event.visibleToAgent !== false,
    is_system_marker: event.isSystemMarker || false,
    display_in_ui: event.displayInUI !== false,
  })
}

// Event-specific write functions
export const writeBuildComplete = (sId, ssId, choices, lessonType) =>
  writeEvent(sId, ssId, {
    type: 'build_complete', lessonType, role: 'system',
    content: `[BUILD] Student designed: ${JSON.stringify(choices)}`,
    metadata: { choices }, isSystemMarker: true,
  })

export const writeGate1Complete = (sId, ssId, upgradeId, data, lessonType) =>
  writeEvent(sId, ssId, {
    type: 'gate1_complete', lessonType, upgradeId, role: 'system',
    content: `[GATE1-COMPLETE] ${data.upgradeLabel}: student said "${data.bestQuote}"`,
    metadata: {
      best_quote: data.bestQuote,
      actual_rounds: data.actualRounds,
      early_release: data.earlyRelease,
    },
    isSystemMarker: true,
  })
```

### Read and Format Functions

```javascript
// Read complete timeline (with 30s cache)
let _cache = null, _cacheTime = null, _cacheStudentId = null
const CACHE_TTL = 30000

export async function getTimeline(studentId, sessionId) {
  const now = Date.now()
  if (_cache && _cacheStudentId === studentId && now - _cacheTime < CACHE_TTL)
    return _cache
  const { data } = await supabase
    .from('session_timeline')
    .select('*')
    .eq('student_id', studentId)
    .eq('session_id', sessionId)
    .eq('visible_to_agent', true)
    .order('created_at', { ascending: true })
  _cache = data || []
  _cacheTime = now
  _cacheStudentId = studentId
  return _cache
}

// Gate 1 format: only completed upgrade records
export function formatForGate1(timeline, demoDescription, currentPrompt) {
  const completed = timeline
    .filter(e => e.event_type === 'gate1_complete')
    .map(e => e.content).join('\n')
  return `Demo: ${demoDescription}
Current prompt: ${currentPrompt || 'not yet generated'}
${completed ? `\nCompleted upgrades:\n${completed}` : ''}`.trim()
}

// Debug format: complete timeline as natural language narrative
export function formatForDebug(timeline, currentPrompt) {
  const lines = timeline.map(e => {
    if (e.is_system_marker) return e.content
    if (e.role === 'student') return `Student: ${e.content}`
    if (e.role === 'agent') return `Agent: ${e.content}`
    return null
  }).filter(Boolean)
  return `Current prompt: ${currentPrompt || 'N/A'}
Session history:\n${lines.join('\n') || 'No history yet'}`.trim()
}
```

---

## Simplified System Prompts

### Gate 1 (800 tokens → 150 tokens)

```javascript
const buildGate1Prompt = (contextString, upgrade, currentRound) => `
IMPORTANT: Return JSON only. { } No markdown. ONE QUESTION ONLY.

You are a design coach. Help student articulate their idea precisely.
Never write the prompt for them.

Upgrade: ${upgrade.title} — ${upgrade.agent_context}
Dimensions: ${upgrade.language_dimensions?.join(' | ')}
Current round: ${currentRound}
${currentRound >= 3 ? 'FINAL ROUND: accept any answer, set continue:false' : ''}

Return: {"response":"...","continue":true,"all_covered":false,"best_quote":"","draft_prompt":""}

[Context]
${contextString}
`
```

### Debug Orchestrator (800 tokens → 150 tokens)

```javascript
const buildOrchestratorPrompt = (contextString) => `
IMPORTANT: Return JSON only. { } No markdown. ONE QUESTION ONLY.

Classify the bug with Q1→Q2→Q3→Q4:
Q1 crashed? → reset | Q2 multiple? → reset | Q3 missing? → prompt | Q4 detail? → code

Return: {"response":"...","route":"pending","q_asked":"Q1","bug_summary":"","related_upgrade":null}

[Session Context]
${contextString}
`
```

---

## Memory Layer

### Session End Compression (Warm Memory)

**Trigger: TA clicks End Class → Auto-run**

```javascript
const compressSessionToSummary = async (studentId, sessionId) => {
  const timeline = await readTimeline(studentId, sessionId)

  const summary = {
    lesson_type: timeline[0]?.lesson_type,
    upgrade_summaries: timeline
      .filter(e => e.event_type === 'gate1_complete')
      .map(e => ({
        upgrade: e.upgrade_id,
        best_quote: e.metadata?.best_quote,
        rounds: e.metadata?.actual_rounds
      })),
    debug_insights: timeline
      .filter(e => e.event_type === 'debug_complete')
      .map(e => e.metadata?.fix_text),
    language_metrics: {
      early_releases: timeline.filter(e =>
        e.event_type === 'gate1_complete' && e.metadata?.early_release).length,
      total_upgrades: timeline.filter(e =>
        e.event_type === 'gate1_complete').length,
      debug_sessions: timeline.filter(e =>
        e.event_type === 'debug_complete').length,
    }
  }

  await supabase.from('session_summaries').insert({
    student_id: studentId,
    session_id: sessionId,
    summary_text: formatSummaryText(summary),
    summary_data: summary,
  })
}
```

### Multi-Session Profile Generation (Cold Memory)

**Trigger: Auto-generate after 3rd class**

```javascript
const buildStudentProfile = async (studentId) => {
  const { data: summaries } = await supabase
    .from('session_summaries').select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false }).limit(5)

  if (!summaries || summaries.length < 3) return // Need at least 3 classes

  const totalSessions = summaries.length
  const avgEarlyRelease = summaries.reduce((a, s) =>
    a + (s.summary_data?.language_metrics?.early_releases || 0), 0) / totalSessions

  const profile = `Student language profile (${totalSessions} lessons):
- Early release rate: ${Math.round(avgEarlyRelease * 10) / 10} per lesson
- Lesson history: ${summaries.map(s => s.summary_data?.lesson_type).join(' → ')}`

  await supabase.from('student_profiles').upsert({
    student_id: studentId,
    profile_text: profile,
    updated_at: new Date().toISOString(),
  })
}
```

---

## Implementation Timeline

| Step | Duration | Tasks |
|------|----------|-------|
| 1 | 1 day | Create three new tables (session_timeline, session_summaries, student_profiles) |
| 2 | 2 days | Integrate timeline.js write calls at existing event triggers |
| 3 | 3 days | Migrate DebugChat to use timeline (highest cross-tab context need) |
| 4 | 2 days | Migrate Gate 1/2 to use timeline |
| 5 | 1 day | Clean up deprecated state variables |
| 6 | 1 day | Integrate Report generation with timeline |
| 7 | 2 days | Implement memory layer (session compression, profile generation) |

**Total: 12 days**

---

## New Lesson Integration (Post-Refactor)

**Adding Lesson 5 requires only ONE file:**

```javascript
// lesson5.js
export const LESSON_5 = {
  id: 'platformer-v1',
  agent: { demo_description: 'Three-layer platform jumping game, move right, no enemies' },
  upgrades: [
    {
      id: 'double-jump',
      agent_context: 'Press jump key twice, jump again in mid-air',
      language_dimensions: [DIMENSION_LIBRARY.trigger, DIMENSION_LIBRARY.result],
    },
  ],
  buildPrompt: (choices, ownInputs, gameName) => `...`,
}
```

**AgentBridge, DebugChat, all Agent System Prompts, session_timeline — ZERO changes required.**

---

## Verification Checklist

### Functionality Verification
- [ ] Gate 1 release conditions correct (param_coverage / language_dimensions)
- [ ] Gate 2 verification flow normal, Debug direct connection after failure
- [ ] Debug three tools normal, student_fix = student's exact words
- [ ] DebugChat conversation restored after tab switch
- [ ] Build fill-in + Prompt layered display

### Architecture Improvement Verification
- [ ] Debug Agent first round can reference Gate 1 best_quote (no special design needed)
- [ ] System Prompt total length < 200 tokens (per agent)
- [ ] JSON parse failure rate < 1/10 conversation rounds
- [ ] Conversation history after trim < 600 tokens

### New Lesson Integration Verification
- [ ] Create lesson5.js, no changes to any Agent code
- [ ] Lesson 5 Gate 1/Debug works normally
- [ ] session_timeline lesson_type field written correctly
