# AI Creative Class - Education OS

## Overview

A modular education platform designed to support multiple courses, organizations, and learning pathways. The system features:

- **Modular Lesson Architecture**: Plug-and-play lesson configurations
- **Multi-Organization Support**: Google OAuth for TAs, organization-based access control
- **Adaptive AI Agents**: Conversational AI that guides students through design thinking
- **Game-to-Robotics Learning Pathway**: Progression from game design to hardware and robotics
- **P7 Cognitive Behavior System**: Validation, iteration, recovery training for learning habits
- **Bilingual Support (i18n)**: Full English/Chinese UI and AI responses

## Platform Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                        Education OS Platform                          │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐    │
│  │   Student App    │  │  TA Dashboard    │  │   Sales App      │    │
│  │   (port 5173)    │  │   (port 5174)    │  │   (port 5175)    │    │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘    │
│           │                     │                     │               │
│           └─────────────────────┼─────────────────────┘               │
│                                 │                                     │
│                        ┌────────▼────────┐                           │
│                        │    Supabase     │                           │
│                        │  (PostgreSQL +  │                           │
│                        │  Edge Functions)│                           │
│                        └────────┬────────┘                           │
│                                 │                                     │
│  ┌──────────────────────────────┼──────────────────────────────────┐ │
│  │              Modular Lesson System                              │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │ │
│  │  │ Lesson 1 │  │ Lesson 2 │  │ Lesson 3 │  │ Lesson N │        │ │
│  │  │ Catch    │  │ AI Maze  │  │ (Future) │  │ (Future) │        │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React + Vite |
| Styling | Tailwind CSS v4 |
| Backend | Supabase (PostgreSQL) |
| Auth | Google OAuth (TA) + Anonymous (Students) |
| AI | DeepSeek API (via Edge Function) |

## Multi-Organization System

### Google OAuth for TAs

TAs authenticate via Google OAuth, linked to organizations:

```sql
-- Organizations table
CREATE TABLE organizations (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  domain text,  -- e.g., 'aicreativeclass.com'
  created_at timestamptz DEFAULT now()
);

-- TA profiles linked to organizations
CREATE TABLE ta_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users,
  email text NOT NULL,
  name text,
  org_id uuid REFERENCES organizations,
  role text DEFAULT 'ta',  -- 'ta' | 'admin' | 'super_admin'
  created_at timestamptz DEFAULT now()
);
```

### Role Hierarchy

| Role | Permissions |
|------|-------------|
| `ta` | View/manage students in own sessions |
| `admin` | View all sessions in organization |
| `super_admin` | Access all organizations, system settings |

### Row Level Security

```sql
-- Sessions: TAs see own org's sessions
CREATE POLICY "TA sees own org sessions"
  ON sessions FOR SELECT
  USING (
    org_id = (SELECT org_id FROM ta_profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM ta_profiles WHERE id = auth.uid() AND role = 'super_admin')
  );
```

## Modular Lesson System

### Lesson Configuration Structure

Each lesson is a self-contained configuration file:

```javascript
// src/lib/lesson.js (Lesson 1: Catch Falling Game)
export const LESSON = {
  id: "catch-falling-v1",
  title: "Catch Falling Game",
  emoji: "🎮",

  // Design steps for prompt generation
  steps: [
    { id: "catchItem", label: "What do you catch?", options: [...] },
    { id: "avoidItem", label: "What do you avoid?", options: [...] },
    ...
  ],

  // Upgrades for learning progression
  upgrades: [
    { id: "lives", level: "easy", title: "Lives Counter", ... },
    { id: "boss", level: "medium", title: "Boss Battle", ... },
    { id: "difficulty-curve", level: "hard", title: "Balance Designer", ... },
  ],

  // Prompt builder
  buildPrompt: (choices, ownInputs, gameName) => `...`,

  // Agent configuration
  agent: {
    demo_description: "A catch game where player moves left/right...",
  },
};
```

### Adding New Lessons

1. Create `src/lib/lessonN.js` with the lesson configuration
2. Add to `src/lib/lessonConfig.js`:
```javascript
import { LESSON_N } from './lessonN';

export const LESSONS = {
  'lesson1': { lesson: LESSON, ... },
  'lesson2': { lesson: LESSON_2, ... },
  'lessonN': { lesson: LESSON_N, ... },  // New lesson
};
```
3. TA Dashboard will automatically show new lesson in session creation

### Lesson Selection Flow

```
TA creates session → Selects lesson type → Session stores lesson_type
                              ↓
Student enters code → Queries session → Gets lesson_type → Loads lesson
```

## Learning Pathway: Game → Hardware → Robotics

### Three-Phase Curriculum

```
Phase 1: Game Design Foundation (Lessons 1-4)
├── Lesson 1: Catch Falling Game - Variables, scoring, lives
├── Lesson 2: AI Maze Game - Collision, pathfinding, rules
├── Lesson 3: Platformer - Physics, timing, levels
└── Lesson 4: Multiplayer - Networking, sync, state

     ↓ Skills Transfer: Logic → Sensors

Phase 2: Hardware Fundamentals (Lessons 5-8)
├── Lesson 5: Arduino LED - Digital output, timing
├── Lesson 6: Sensor Input - Analog reading, thresholds
├── Lesson 7: Motor Control - PWM, direction, speed
└── Lesson 8: Integration - Multi-component systems

     ↓ Skills Transfer: Components → Systems

Phase 3: Robotics & AI (Lessons 9-12)
├── Lesson 9: Basic Robot - Movement, navigation
├── Lesson 10: Sensor Fusion - Multiple inputs, decisions
├── Lesson 11: Computer Vision - Recognition, tracking
└── Lesson 12: Autonomous Behavior - Planning, learning
```

### AI Report Learning Path Integration

AI-generated reports include personalized learning pathway recommendations:

```javascript
// ta-dashboard/src/lib/reportPrompt.js
const DEFAULT_COURSE_OUTLINE = `
Phase 1: Game Design Foundation
- Lesson 1: Catch Falling Game (variables, scoring)
- Lesson 2: AI Maze Game (collision, rules)
- ...

Phase 2: Hardware Fundamentals
- Lesson 5: Arduino LED (digital output)
- ...

Phase 3: Robotics & AI
- Lesson 9: Basic Robot (movement)
- ...
`;
```

## Project Structure

```
Trial_Class_System/
├── student-app/                # Student-facing app
│   ├── src/
│   │   ├── App.jsx             # Main app with session/event management
│   │   ├── main.jsx            # Router setup
│   │   ├── i18n/               # Internationalization
│   │   │   ├── index.js        # t() function, useT() hook
│   │   │   ├── en.json         # English translations (~200 keys)
│   │   │   └── zh.json         # Chinese translations (~200 keys)
│   │   ├── lib/
│   │   │   ├── supabase.js
│   │   │   ├── timeline.js     # session_timeline read/write
│   │   │   ├── LanguageContext.jsx  # Language state provider
│   │   │   ├── lesson.js       # Lesson 1 configuration
│   │   │   ├── lesson2.js      # Lesson 2 configuration
│   │   │   ├── lessonConfig.js # Lesson registry + language
│   │   │   ├── AgentBridge.js  # Agent orchestration
│   │   │   └── prompts/        # AI System Prompts
│   │   │       ├── gate1Prompt.js
│   │   │       ├── debugOrchestratorPrompt.js
│   │   │       └── resolutionJudgePrompt.js  # P7 resolution AI
│   │   ├── components/
│   │   │   ├── DesignCard.jsx
│   │   │   ├── PromptGenerator.jsx
│   │   │   ├── Upgrade.jsx           # + P7 prediction integration
│   │   │   ├── AgentPanel.jsx        # Gate 1/2 AI conversations
│   │   │   ├── DebugChat.jsx         # + P7 iteration/recovery
│   │   │   ├── ShareGame.jsx         # + P7 identity reflection
│   │   │   ├── PredictionPrompt.jsx  # P7: Pre-send prediction modal
│   │   │   ├── ValidationCheck.jsx   # P7: Post-generate validation
│   │   │   └── StudentLogin.jsx      # Unified login flow
│   │   └── pages/
│   │       └── ReportPage.jsx  # Public report page
│   └── vercel.json
│
├── ta-dashboard/               # TA-facing dashboard
│   ├── src/
│   │   ├── App.jsx
│   │   ├── lib/
│   │   │   ├── supabase.js
│   │   │   ├── signalScore.js
│   │   │   └── reportPrompt.js # AI report generation
│   │   └── components/
│   │       ├── Setup.jsx       # Session creation with lesson selection
│   │       ├── Dashboard.jsx
│   │       ├── StudentCard.jsx
│   │       └── ReportReviewPanel.jsx
│   └── .env.local
│
├── sales-app/                  # Sales dashboard
│   └── src/App.jsx
│
└── supabase/
    └── functions/
        ├── deepseek-proxy/     # DeepSeek API proxy
        └── compress-session/   # Session data compression
```

## Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `organizations` | Multi-org support |
| `ta_profiles` | TA accounts with org linkage |
| `sessions` | Class sessions with lesson_type |
| `students` | Student records per session |
| `student_enrollments` | Student identity with 6-digit shortcode |
| `enrollment_batches` | CSV import batches |
| `session_timeline` | **V17** Unified event tracking |
| `agent_sessions` | **V17** Agent interaction records |
| `debug_sessions` | Debug chat sessions |
| `student_signals` | Conversion signal flags |
| `conversion_signals` | Sales funnel tracking |
| `reports` | AI-generated reports |

### Session Timeline (V17)

Unified event tracking for all student activities:

```sql
CREATE TABLE session_timeline (
  id uuid PRIMARY KEY,
  student_id uuid REFERENCES students,
  session_id uuid REFERENCES sessions,
  event_type text NOT NULL,
  upgrade_id text,
  role text,  -- 'student' | 'agent' | 'system'
  content text NOT NULL,
  metadata jsonb,
  visible_to_agent boolean DEFAULT true,
  is_system_marker boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

**Event Types**:
- Core: `build_complete`, `prompt_generated`, `prompt_copied`
- Gate: `gate1_round`, `gate1_complete`, `gate2_verify`
- Debug: `debug_message`, `debug_complete`
- **P7**: `prediction_made`, `prediction_validated`, `validation_reflection`, `iteration_idea`, `recovery_insight`, `identity_reflection`

### Session with Lesson Type

```sql
CREATE TABLE sessions (
  id uuid PRIMARY KEY,
  name text,
  code text UNIQUE,
  status text DEFAULT 'active',
  lesson_type text DEFAULT 'lesson1',  -- Links to lesson config
  org_id uuid REFERENCES organizations,
  created_by uuid REFERENCES ta_profiles,
  created_at timestamptz DEFAULT now()
);
```

### Student with Publish Link

```sql
CREATE TABLE students (
  id uuid PRIMARY KEY,
  session_id uuid REFERENCES sessions,
  name text NOT NULL,
  publish_link text,  -- Claude artifact share link
  session_reflection text,  -- Student end-of-class reflection (P7)
  enrollment_id uuid REFERENCES student_enrollments,
  shortcode text UNIQUE,  -- 6-digit student code (deprecated, use enrollment)
  created_at timestamptz DEFAULT now()
);
```

### Student Enrollment System

Students get a 6-digit `shortcode` for persistent identity across sessions:

```sql
-- Enrollment records (authoritative source for shortcode)
CREATE TABLE student_enrollments (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES organizations,
  batch_id uuid REFERENCES enrollment_batches,

  -- Student info (from CSV import)
  student_name text NOT NULL,
  parent_phone text,
  grade text,

  -- 6-digit student code (unique identifier)
  shortcode text UNIQUE,  -- e.g., "154100"

  -- Enrollment token for parent verification
  enrollment_token text UNIQUE,
  token_expires_at timestamptz,

  -- Status
  status text DEFAULT 'pending',  -- pending → enrolled
  enrolled_at timestamptz
);
```

#### Enrollment Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. TA imports CSV → creates student_enrollments records    │
│     (status: pending, shortcode: generated)                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  2. Parent receives enrollment link with token              │
│     → Verifies phone → status: enrolled                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  3. Student uses 6-digit shortcode to join sessions         │
│     → Creates students record linked via enrollment_id      │
└─────────────────────────────────────────────────────────────┘
```

#### Student Login Options

| Code Type | Length | Example | Purpose |
|-----------|--------|---------|---------|
| Session code | 4 digits | `1700` | Join a specific class session |
| Student shortcode | 6 digits | `154100` | Restore student identity |

#### Key Tables Relationship

```
student_enrollments (报名记录 - shortcode 权威来源)
├── id (uuid)
├── shortcode (6位) ← 唯一权威来源
├── student_name
└── status: pending → enrolled
        ↓
students (课堂学生记录)
├── id (uuid)
├── enrollment_id → student_enrollments.id
├── shortcode (6位) ← 从 enrollment 复制，计划移除
└── session_id → sessions.id
```

**Note**: `students.shortcode` is deprecated. Use `student_enrollments.shortcode` as the authoritative source.

## AI Agent System

### Agent Types

| Agent | Purpose | Trigger |
|-------|---------|---------|
| Gate 1 | Guide upgrade design | Student clicks [Start] on upgrade |
| Gate 2 | Verify upgrade worked | Student returns to Prompt tab |
| Debug Orchestrator | Triage bugs | Student opens Debug tab |
| Debug Prompt Tool | Fix missing prompts | Bug is prompt-related |
| Debug Code Tool | Fix code issues | Bug is code-related |

### Agent Context Sharing

All agents share student context via `buildStudentContext()`:

```javascript
const context = await buildStudentContext(studentId, sessionId, currentPrompt);
// Returns: upgradeSummaries, recentBugs, timeRemaining, etc.
```

## Feature Highlights

### 1. Publish Link Sharing

Students can share their Claude game link:
- Student pastes link in ShareGame component
- Link saved to `students.publish_link`
- Displayed in TA Dashboard
- Included in AI reports and public report page

### 2. Bilingual Reports

AI-generated reports support English and Chinese:
- `report.content_en` / `report.content_zh`
- `report.pathway_en` / `report.pathway_zh`
- Public report page has language toggle

### 3. Conversion Tracking

Real-time conversion signals for sales:
- Auto-detected: `rep_opened`, `rep_read_depth`, `rep_cta_clicked`
- TA-entered: `pa_stayed`, `pa_photo`, `pa_asked_price`
- Sales-entered: `sale_qr_shown`, `sale_deposit_taken`

## P7 Cognitive Behavior System

Based on the AI-era talent formation theory, P7 trains four cognitive behaviors:

### Behavior Loop

```
Experience → Competence → Self-Efficacy → Motivation → Identity
→ Problem Framing → Problem Breakdown → Validation → Iteration
→ Value Creation → Identity Reinforcement
```

### Four Training Modules

| Module | Trigger | Component | Event Type |
|--------|---------|-----------|------------|
| **Validation Training** | Copy upgrade prompt | `PredictionPrompt.jsx` | `prediction_made` |
| | Return to Prompt tab | `ValidationCheck.jsx` | `prediction_validated`, `validation_reflection` |
| **Iteration Training** | Debug resolved | `DebugChat.jsx` | `iteration_idea` |
| **Recovery Training** | Reset with removed features | `DebugChat.jsx` | `recovery_insight` |
| **Identity Reinforcement** | Share game link | `ShareGame.jsx` | `identity_reflection` |

### Prediction Flow

```
Student clicks Copy on Upgrade
    ↓
PredictionPrompt modal appears
    ↓
Student writes prediction → writes to session_timeline
    ↓
Copy to clipboard + open Claude
    ↓
Student returns to Prompt tab
    ↓
ValidationCheck modal appears (if prediction exists)
    ↓
Yes/No + reflection → writes to session_timeline
```

### Parent Report Integration

P7 data is included in AI-generated reports:

```javascript
// ta-dashboard/src/lib/reportPrompt.js
const cognitiveData = await getCognitiveBehaviorData(studentId, sessionId);
const section = buildCognitiveBehaviorSection(cognitiveData, studentName, 'zh');
// Returns:
// ### 🧠 思维训练表现
// - **预测准确度**: 75% (优秀)
// - **迭代创意**: 提出了 2 个改进想法
// - **反思能力**: 对 3 次结果进行了深入思考
```

## i18n Bilingual System

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  App.jsx                                                    │
│  <LanguageProvider value={{ language, setLanguage }}>       │
└──────────────────────┬──────────────────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       ↓               ↓               ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ UI Components│ │ Lesson Config│ │ AI Prompts   │
│ useT() hook  │ │ getLesson(l) │ │ buildXxx(l)  │
└──────────────┘ └──────────────┘ └──────────────┘
       ↓               ↓               ↓
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ i18n/en.json │ │ lesson.js    │ │ System Prompt│
│ i18n/zh.json │ │ lessonZh.js  │ │ + lang instr │
└──────────────┘ └──────────────┘ └──────────────┘
```

### Usage

```jsx
// In components
import { useT } from '../i18n';

function MyComponent() {
  const t = useT();
  return <h1>{t('common.loading')}</h1>;
}

// With parameters
{t('returning.welcomeBack', { name: studentName })}
```

### Language Toggle

```jsx
import { LanguageToggle } from './lib/LanguageContext';

// Renders: [中文] or [EN] button
<LanguageToggle />
```

## Production Deployment

| App | URL |
|-----|-----|
| Student App | https://trial-class-system-zeta.vercel.app |
| TA Dashboard | https://ta-dashboard-xi.vercel.app |
| Sales App | https://sales-app-chi-two.vercel.app |

### Environment Variables

| App | Variables |
|-----|-----------|
| student-app | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| ta-dashboard | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DEEPSEEK_API_KEY` |
| sales-app | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

## Running Locally

```bash
# Terminal 1: Student App
cd student-app && npm run dev  # http://localhost:5173

# Terminal 2: TA Dashboard
cd ta-dashboard && npm run dev  # http://localhost:5174

# Terminal 3: Sales App
cd sales-app && npm run dev  # http://localhost:5175
```

## Key Concepts

### Lesson Configuration Keys

| Key | Type | Description |
|-----|------|-------------|
| `id` | string | Unique lesson identifier |
| `title` | string | Display name |
| `steps` | array | Design wizard steps |
| `upgrades` | array | Learning upgrades (easy/medium/hard) |
| `buildPrompt` | function | Generates AI prompt from choices |
| `agent.demo_description` | string | For AI context |

### Upgrade Levels

| Level | Agent Gate 1 | User Action | Goal |
|-------|--------------|-------------|------|
| Easy | No | Fill number | Practice parameters |
| Medium | Yes | Discuss intent → Fill params | Design thinking |
| Hard | Yes | Write description | Full prompt authorship |

### Signal Dimensions

| Dimension | Auto Rate | Description |
|-----------|-----------|-------------|
| Competence | 100% | Can make something |
| Ownership | 33% | Has ownership of creation |
| Persistence | 100% | Can persist through challenges |
| Challenge Seed | 60% | Wants more challenges |
| Parent Signal | 0% | Parent engagement indicators |

## Future Roadmap

### Near-term
- [ ] Lesson 3: Platformer Game
- [ ] Lesson 4: Multiplayer basics
- [ ] Chinese language UI (i18n system ready)

### Mid-term
- [ ] Phase 2: Hardware lessons (Arduino integration)
- [ ] Physical kit integration
- [ ] Parent dashboard

### Long-term
- [ ] Phase 3: Robotics lessons
- [ ] AI-powered adaptive curriculum
- [ ] Cross-lesson progress tracking

---

## Quick Reference

### Create New Lesson

1. Copy `lesson.js` as template
2. Update `id`, `title`, `steps`, `upgrades`
3. Register in `lessonConfig.js`
4. Add to TA Dashboard lesson selector

### Add Organization

```sql
INSERT INTO organizations (name, domain)
VALUES ('New School', 'newschool.edu');
```

### Debug Common Issues

| Issue | Solution |
|-------|----------|
| Lesson not loading | Check `sessions.lesson_type` matches key in `LESSONS` |
| Report not showing game link | Verify `students.publish_link` is set |
| Agent not responding | Check DeepSeek API key in Supabase secrets |
| Student shortcode not working | Query `student_enrollments.shortcode`, not `students.shortcode` |
| P7 data not in report | Check `session_timeline` for P7 event types |
| Language not switching | Check `LanguageProvider` wraps `AppContent` |
| Blank page on localhost | Clear browser cache, check console for JS errors |

### Student Identity Lookup

```sql
-- Find student by 6-digit shortcode
SELECT se.*, s.id as student_id, s.session_id
FROM student_enrollments se
LEFT JOIN students s ON s.enrollment_id = se.id
WHERE se.shortcode = '154100';
```

---

### P7 Cognitive Behavior Queries

```sql
-- Get prediction accuracy for a student
SELECT
  COUNT(*) FILTER (WHERE metadata->>'matched' = 'true') as matched,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE metadata->>'matched' = 'true') / COUNT(*)) as accuracy
FROM session_timeline
WHERE student_id = 'xxx' AND event_type = 'prediction_validated';

-- Get all P7 events for a session
SELECT event_type, content, metadata, created_at
FROM session_timeline
WHERE student_id = 'xxx'
  AND event_type IN ('prediction_made', 'prediction_validated',
    'iteration_idea', 'recovery_insight', 'identity_reflection')
ORDER BY created_at;
```

---

*Last updated: 2026-06-04*
