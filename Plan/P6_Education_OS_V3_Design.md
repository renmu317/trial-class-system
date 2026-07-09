# Education OS V3 - Modular Architecture Design

## Overview

Transform the current "Trial Class System" into a modular, pluggable education platform supporting:
- **Multiple course types**: game, hardware, robotics
- **Different agent combinations** per course type
- **Complete conversation history** storage
- **Backward compatibility** with existing Lesson 1

## Key Decisions

| Decision | Choice |
|----------|--------|
| Lesson 1 | **Frozen** - never modify, keep backward compatible |
| Data storage | **Single `session_timeline` table** with `event_data` jsonb |
| Conversation history | **Entire conversation as jsonb** per conversation_id |
| conversation_id scope | **Per upgrade/debug session** (not per AgentPanel open) |
| Lesson 2 migration | **Build infrastructure first**, migrate lesson2 later |
| New agents | **SafetyCheck** (hardware) + **StepVerify** (robotics) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  App.jsx                                                    │
│  getLessonRuntime(lessonType) → { isLegacy, courseType }    │
└──────────────────────┬──────────────────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       ↓               ↓               ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ lesson1      │ │ lesson2+     │ │ lesson5+     │
│ (Legacy)     │ │ (Game)       │ │ (Hardware)   │
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       ↓                ↓                ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ agent_       │ │ session_     │ │ session_     │
│ sessions     │ │ timeline     │ │ timeline     │
│ (existing)   │ │ (new)        │ │ (new)        │
└──────────────┘ └──────────────┘ └──────────────┘
```

---

## Database Schema

### session_timeline (New Table)

```sql
CREATE TABLE session_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,

  -- Course identification
  lesson_type text NOT NULL,      -- 'lesson2' | 'lesson5' | 'lesson9'
  course_type text NOT NULL,      -- 'game' | 'hardware' | 'robotics'

  created_at timestamptz DEFAULT now(),

  -- Event classification
  event_type text NOT NULL,       -- 'conversation_start' | 'message' | 'tool_switch' | 'release' | 'complete'

  -- Conversation grouping
  conversation_id uuid,           -- Groups messages within one upgrade/debug session
  sequence_num int,               -- Order within conversation

  -- Agent info
  agent_type text,                -- 'gate1' | 'gate2' | 'debug' | 'safetyCheck' | 'stepVerify'
  agent_mode text,                -- For debug: 'orchestrator' | 'prompt_tool' | 'code_tool' | 'reset_tool'

  -- Message content
  role text,                      -- 'student' | 'agent' | 'system'
  content text,

  -- Flexible course-specific data
  event_data jsonb DEFAULT '{}',
  -- Examples:
  -- Gate 1: { "upgrade_id": "boss", "difficulty": "medium", "recommendations": {...} }
  -- Debug: { "bug_summary": "...", "fix_text": "...", "resolved": true }
  -- Hardware: { "component": "led", "pin": 13, "safety_checked": true }

  -- Metrics
  model_version text,
  token_count int,
  latency_ms int
);

-- Indexes
CREATE INDEX idx_timeline_student ON session_timeline(student_id);
CREATE INDEX idx_timeline_session ON session_timeline(session_id);
CREATE INDEX idx_timeline_conversation ON session_timeline(conversation_id);
CREATE INDEX idx_timeline_course ON session_timeline(course_type);
```

---

## Course Types Configuration

### courseTypes.js (New File)

```javascript
// src/lib/courseTypes.js

export const COURSE_TYPES = {
  // Legacy: uses existing agent_sessions table
  legacy: {
    id: 'legacy',
    usesTimeline: false,
    description: 'Original lesson 1, uses agent_sessions',
  },

  // Game courses: lesson 2, 3, 4
  game: {
    id: 'game',
    usesTimeline: true,
    agents: {
      gate1: {
        enabled: true,
        promptPath: 'game/gate1',
        maxRounds: { easy: 1, medium: 3, hard: 4 },
        cognitiveGoal: 'Language precision - student articulates design intent',
      },
      gate2: {
        enabled: true,
        promptPath: 'game/gate2',
        cognitiveGoal: 'Causal attribution - student explains why upgrade worked/failed',
      },
      debug: {
        enabled: true,
        promptPath: 'game/debug',
        modes: ['orchestrator', 'prompt_tool', 'code_tool', 'reset_tool'],
        cognitiveGoal: 'Self-repair - student debugs with guidance',
      },
    },
    flow: ['build', 'prompt', 'upgrade', 'debug'],
  },

  // Hardware courses: lesson 5, 6, 7, 8
  hardware: {
    id: 'hardware',
    usesTimeline: true,
    agents: {
      gate1: {
        enabled: true,
        promptPath: 'hardware/gate1',
        maxRounds: { easy: 1, medium: 2, hard: 3 },
      },
      safetyCheck: {
        enabled: true,
        promptPath: 'hardware/safetyCheck',
        blocking: true, // Must pass before physical action
        maxRounds: 3,
        cognitiveGoal: 'Risk awareness - student self-checks connections',
      },
      debug: {
        enabled: true,
        promptPath: 'hardware/debug',
        modes: ['orchestrator', 'wiring_tool', 'code_tool'],
      },
    },
    flow: ['design', 'safety', 'build', 'test'],
  },

  // Robotics courses: lesson 9, 10, 11, 12
  robotics: {
    id: 'robotics',
    usesTimeline: true,
    agents: {
      gate1: {
        enabled: true,
        promptPath: 'robotics/gate1',
        maxRounds: { easy: 1, medium: 2, hard: 3 },
      },
      safetyCheck: {
        enabled: true,
        promptPath: 'robotics/safetyCheck',
        blocking: true,
      },
      stepVerify: {
        enabled: true,
        promptPath: 'robotics/stepVerify',
        supportsVision: true, // Can accept camera input
        maxRounds: 3,
        cognitiveGoal: 'Observation ability - student observes and estimates error',
      },
      debug: {
        enabled: true,
        promptPath: 'robotics/debug',
        modes: ['orchestrator', 'movement_tool', 'sensor_tool'],
      },
    },
    flow: ['design', 'safety', 'build', 'verify', 'test'],
  },
};

export function getCourseType(courseTypeId) {
  return COURSE_TYPES[courseTypeId] || COURSE_TYPES.legacy;
}

export function getAgentConfig(courseTypeId, agentType) {
  const courseType = getCourseType(courseTypeId);
  return courseType.agents?.[agentType] || null;
}
```

---

## Lesson Configuration

### lessonConfig.js (Modified)

```javascript
// src/lib/lessonConfig.js

import { LESSON, RECOVERY, LEVEL_CONFIG, TABS } from './lesson';
import { getCourseType } from './courseTypes';

// Lesson registry with course type mapping
export const LESSONS = {
  // Legacy lessons - frozen, use existing architecture
  lesson1: {
    courseType: 'legacy',
    lesson: LESSON,
    recovery: RECOVERY,
    levelConfig: LEVEL_CONFIG,
    tabs: TABS,
  },

  // New world lessons - dynamic import
  lesson2: {
    courseType: 'game',
    module: () => import('./lessons/game/lesson2'),
  },
  lesson3: {
    courseType: 'game',
    module: () => import('./lessons/game/lesson3'),
  },

  // Hardware lessons
  lesson5: {
    courseType: 'hardware',
    module: () => import('./lessons/hardware/lesson5'),
  },

  // Robotics lessons
  lesson9: {
    courseType: 'robotics',
    module: () => import('./lessons/robotics/lesson9'),
  },
};

/**
 * Get lesson runtime configuration
 * Returns either legacy config or new world config
 */
export async function getLessonRuntime(lessonType) {
  const entry = LESSONS[lessonType] || LESSONS.lesson1;

  // Legacy path: return existing structure
  if (entry.courseType === 'legacy') {
    return {
      isLegacy: true,
      courseType: 'legacy',
      lesson: entry.lesson,
      recovery: entry.recovery,
      levelConfig: entry.levelConfig,
      tabs: entry.tabs,
    };
  }

  // New world path: dynamic import + courseType config
  const courseTypeConfig = getCourseType(entry.courseType);
  const lessonModule = await entry.module();

  return {
    isLegacy: false,
    courseType: entry.courseType,
    courseTypeConfig,
    lesson: lessonModule.LESSON,
    recovery: lessonModule.RECOVERY,
    levelConfig: lessonModule.LEVEL_CONFIG,
    tabs: lessonModule.TABS,
    agents: courseTypeConfig.agents,
    flow: courseTypeConfig.flow,
  };
}
```

---

## AgentBridge (Modified)

### Dual-Path Routing

```javascript
// src/lib/AgentBridge.js

import { writeMessage, startConversation, endConversation } from './timeline';

class AgentBridge {
  constructor() {
    this._isLegacy = true;
    this._courseType = 'legacy';
  }

  init(sessionId, studentId, lessonRuntime, onOpenAgentPanel) {
    this._sessionId = sessionId;
    this._studentId = studentId;
    this._isLegacy = lessonRuntime.isLegacy;
    this._courseType = lessonRuntime.courseType;
    this._agents = lessonRuntime.agents;
    this._onOpenAgentPanel = onOpenAgentPanel;
  }

  async trigger(eventType, payload) {
    if (this._isLegacy) {
      return this._triggerLegacy(eventType, payload);
    }
    return this._triggerNewWorld(eventType, payload);
  }

  // Legacy path: existing agent_sessions logic
  async _triggerLegacy(eventType, payload) {
    // ... existing implementation unchanged ...
  }

  // New world path: use session_timeline
  async _triggerNewWorld(eventType, payload) {
    const { upgradeId, difficulty } = payload;

    // Start new conversation
    const conversationId = await startConversation({
      studentId: this._studentId,
      sessionId: this._sessionId,
      courseType: this._courseType,
      agentType: 'gate1',
      eventData: { upgrade_id: upgradeId, difficulty },
    });

    // Get agent config
    const agentConfig = this._agents.gate1;

    // Open agent panel with timeline-aware callbacks
    this._onOpenAgentPanel({
      conversationId,
      agentType: 'gate1',
      agentConfig,
      onMessage: (role, content) => this._writeToTimeline(conversationId, role, content),
      onComplete: (result) => this._completeConversation(conversationId, result),
    });
  }

  async _writeToTimeline(conversationId, role, content) {
    await writeMessage({
      studentId: this._studentId,
      sessionId: this._sessionId,
      conversationId,
      role,
      content,
      courseType: this._courseType,
    });
  }

  async _completeConversation(conversationId, result) {
    await endConversation({
      conversationId,
      eventData: result,
    });
  }
}

export const agentBridge = new AgentBridge();
```

---

## Timeline Operations

### timeline.js (New File)

```javascript
// src/lib/timeline.js

import { supabase } from './supabase';
import { v4 as uuidv4 } from 'uuid';

/**
 * Start a new conversation (upgrade attempt, debug session, etc.)
 */
export async function startConversation({
  studentId,
  sessionId,
  lessonType,
  courseType,
  agentType,
  agentMode = null,
  eventData = {},
}) {
  const conversationId = uuidv4();

  await supabase.from('session_timeline').insert({
    student_id: studentId,
    session_id: sessionId,
    lesson_type: lessonType,
    course_type: courseType,
    event_type: 'conversation_start',
    conversation_id: conversationId,
    sequence_num: 0,
    agent_type: agentType,
    agent_mode: agentMode,
    role: 'system',
    content: `Started ${agentType} conversation`,
    event_data: eventData,
  });

  return conversationId;
}

/**
 * Write a message to the timeline
 */
export async function writeMessage({
  studentId,
  sessionId,
  conversationId,
  role,
  content,
  courseType,
  lessonType,
  agentType,
  agentMode = null,
  eventData = {},
  modelVersion = null,
  tokenCount = null,
  latencyMs = null,
}) {
  // Get next sequence number
  const { data: lastMsg } = await supabase
    .from('session_timeline')
    .select('sequence_num')
    .eq('conversation_id', conversationId)
    .order('sequence_num', { ascending: false })
    .limit(1)
    .single();

  const sequenceNum = (lastMsg?.sequence_num || 0) + 1;

  await supabase.from('session_timeline').insert({
    student_id: studentId,
    session_id: sessionId,
    lesson_type: lessonType,
    course_type: courseType,
    event_type: 'message',
    conversation_id: conversationId,
    sequence_num: sequenceNum,
    agent_type: agentType,
    agent_mode: agentMode,
    role,
    content,
    event_data: eventData,
    model_version: modelVersion,
    token_count: tokenCount,
    latency_ms: latencyMs,
  });
}

/**
 * End a conversation with final result
 */
export async function endConversation({
  conversationId,
  eventData = {},
}) {
  // Get conversation info
  const { data: firstMsg } = await supabase
    .from('session_timeline')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sequence_num', { ascending: true })
    .limit(1)
    .single();

  if (!firstMsg) return;

  const { data: lastMsg } = await supabase
    .from('session_timeline')
    .select('sequence_num')
    .eq('conversation_id', conversationId)
    .order('sequence_num', { ascending: false })
    .limit(1)
    .single();

  await supabase.from('session_timeline').insert({
    student_id: firstMsg.student_id,
    session_id: firstMsg.session_id,
    lesson_type: firstMsg.lesson_type,
    course_type: firstMsg.course_type,
    event_type: 'conversation_end',
    conversation_id: conversationId,
    sequence_num: (lastMsg?.sequence_num || 0) + 1,
    agent_type: firstMsg.agent_type,
    agent_mode: firstMsg.agent_mode,
    role: 'system',
    content: 'Conversation ended',
    event_data: eventData,
  });
}

/**
 * Get full timeline for a student session
 */
export async function getTimeline(studentId, sessionId) {
  const { data } = await supabase
    .from('session_timeline')
    .select('*')
    .eq('student_id', studentId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  return data || [];
}

/**
 * Get conversation history for a specific conversation
 */
export async function getConversation(conversationId) {
  const { data } = await supabase
    .from('session_timeline')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sequence_num', { ascending: true });

  return data || [];
}

/**
 * Format timeline for agent context
 */
export function formatForAgent(timeline, agentType) {
  // Filter and format based on agent type
  const relevant = timeline.filter(t => {
    if (agentType === 'debug') {
      return ['gate1', 'gate2', 'debug'].includes(t.agent_type);
    }
    return t.agent_type === agentType;
  });

  return relevant.map(t => ({
    role: t.role,
    content: t.content,
    timestamp: t.created_at,
    metadata: t.event_data,
  }));
}
```

---

## New Agent Designs

### SafetyCheck Agent (Hardware)

**Cognitive Goal**: Risk awareness + self-checking

```javascript
// src/lib/prompts/hardware/safetyCheck.js

export function buildSafetyCheckPrompt(context) {
  return `You are a safety awareness coach for hardware projects.
Your job is NOT to inspect - your job is to make the STUDENT check themselves.

STUDENT CONTEXT:
${context.currentDesign}

COMPONENT: ${context.component}
ACTION: ${context.action}

YOUR APPROACH (3 rounds max):
Round 1: "Before you ${context.action}, what connections did YOU check?"
- Listen for: specific pins mentioned, polarity awareness
- If vague: "Which specific wire goes where?"

Round 2: "How did you verify [specific connection]?"
- Listen for: visual check, multimeter, LED test
- If no method: "What could you use to test it?"

Round 3: "What would happen if [connection] was wrong?"
- Listen for: consequence awareness (short circuit, component damage)
- If unclear: "What's the worst case?"

RELEASE CRITERIA:
{
  "ready_to_proceed": checks_count >= 2 AND consequence_understood,
  "student_verbalized": {
    "connections_checked": ["VCC to 5V", "GND to GND", ...],
    "verification_method": "visual" | "multimeter" | "led_test",
    "understood_risk": true
  }
}

NEVER tell them what to check. ASK what they checked.
If they haven't checked, DON'T tell them - ask "What should you check first?"
`;
}
```

### StepVerify Agent (Robotics)

**Cognitive Goal**: Observation ability + error estimation

```javascript
// src/lib/prompts/robotics/stepVerify.js

export function buildStepVerifyPrompt(context) {
  return `You are an observation coach for robotics.
Your job is to develop the student's ability to OBSERVE and MEASURE.

STUDENT CONTEXT:
${context.robotState}

EXPECTED OUTCOME: ${context.expectedOutcome}
ACTUAL OBSERVATION: ${context.studentObservation || 'Not yet provided'}

YOUR APPROACH (3 rounds max):
Round 1: "Look at your robot. Where is [part] right now?"
- Listen for: position description, orientation
- If vague: "Can you be more specific? Use directions or distances."

Round 2: "Is that where you expected? How far off?"
- Listen for: error estimation (cm, degrees, etc.)
- If no estimate: "Take a guess - how many centimeters off?"

Round 3: "Why do you think it ended up there?"
- Listen for: hypothesis about cause
- If no idea: "What could affect [movement]?"

VISION MODE (if image provided):
Analyze the image and guide the student to notice specific details.
"I see the robot. What do YOU notice about [specific element]?"

RELEASE CRITERIA:
{
  "ready_to_proceed": observation_made AND error_estimated,
  "student_data": {
    "observed_position": "...",
    "expected_position": "...",
    "error_estimate": "~5cm left",
    "hypothesis": "friction" | "calibration" | "obstacle"
  }
}

NEVER tell them what you see. ASK what they see.
`;
}
```

---

## Prompt Directory Structure

```
src/lib/prompts/
├── index.js                    # Prompt router
├── game/
│   ├── gate1Prompt.js          # Existing, add language param
│   ├── gate2Prompt.js          # New
│   └── debug/
│       ├── orchestratorPrompt.js
│       ├── promptToolPrompt.js
│       ├── codeToolPrompt.js
│       └── resetToolPrompt.js
├── hardware/
│   ├── gate1Prompt.js
│   ├── safetyCheckPrompt.js    # New
│   └── debug/
│       ├── orchestratorPrompt.js
│       └── wiringToolPrompt.js
└── robotics/
    ├── gate1Prompt.js
    ├── safetyCheckPrompt.js
    ├── stepVerifyPrompt.js     # New
    └── debug/
        ├── orchestratorPrompt.js
        └── movementToolPrompt.js
```

---

## Migration Plan

### Phase 1: Infrastructure (Week 1)

| Day | Task |
|-----|------|
| 1-2 | Create `session_timeline` table in Supabase |
| 2-3 | Create `timeline.js` module with read/write |
| 3-4 | Create `courseTypes.js` |
| 4-5 | Unit test timeline operations |

### Phase 2: Integration (Week 2)

| Day | Task |
|-----|------|
| 1-2 | Modify `lessonConfig.js` for dual-path |
| 2-3 | Modify `AgentBridge.js` for Legacy/New World routing |
| 3-4 | Create `prompts/` directory structure |
| 4-5 | Integration test with lesson2 |

### Phase 3: New Agents (Week 3)

| Day | Task |
|-----|------|
| 1-2 | Implement SafetyCheck agent |
| 2-3 | Implement StepVerify agent |
| 3-4 | Create lesson5 template (hardware) |
| 4-5 | End-to-end test |

---

## Agent Cognitive Goals Summary

| Agent | Course | Cognitive Goal |
|-------|--------|----------------|
| Gate 1 | All | **Language precision** - Student articulates design intent clearly |
| Gate 2 | Game | **Causal attribution** - Student explains why upgrade worked/failed |
| Debug | All | **Self-repair** - Student develops debugging instincts |
| SafetyCheck | Hardware/Robotics | **Risk awareness** - Student self-checks before physical action |
| StepVerify | Robotics | **Observation ability** - Student observes, measures, estimates error |

---

## Validation Checklist

- [ ] session_timeline table created with proper indexes
- [ ] timeline.js functions tested
- [ ] courseTypes.js loaded correctly
- [ ] lessonConfig.js returns correct isLegacy flag
- [ ] AgentBridge routes to correct path
- [ ] Lesson 1 unchanged and working
- [ ] Lesson 2 uses new timeline
- [ ] SafetyCheck agent blocking behavior works
- [ ] StepVerify agent vision mode works
- [ ] Conversation history fully captured
- [ ] No console errors

---

*Created: 2026-06-04*
*Based on Education OS V3 design discussion*
