# Education OS - Database Schema Reference

**Last Updated**: 2026-06-04
**Project**: aebxtunvdtabhdtihglh

## Core Tables

### sessions
Trial class sessions created by TAs.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Session name |
| join_code | text | 4-digit join code (unique) |
| lesson_type | text | Lesson configuration key (lesson1, lesson2, etc.) |
| organization_id | uuid | FK to organizations |
| status | text | 'running' or 'ended' |
| scheduled_end_at | timestamptz | Planned end time |
| created_at | timestamptz | Creation time |

### students
Students participating in trial classes.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| session_id | uuid | FK to sessions (CASCADE) |
| name | text | Student name |
| game_name | text | Name of student's game |
| current_step | text | Current design step |
| publish_link | text | Claude artifact share link |
| session_reflection | text | **P7** End-of-class reflection |
| enrollment_id | uuid | FK to student_enrollments |
| shortcode | text | 6-digit student code (deprecated, use enrollment) |
| organization_id | uuid | FK to organizations |
| deleted_at | timestamptz | Soft delete timestamp |

### session_timeline
**V17 Phase B** - Unified event tracking for all student activities.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| student_id | uuid | FK to students (CASCADE) |
| session_id | uuid | FK to sessions (CASCADE) |
| event_type | text | Event type (see below) |
| upgrade_id | text | Related upgrade ID |
| lesson_type | text | Lesson configuration |
| role | text | 'student' / 'agent' / 'system' |
| content | text | Event content |
| metadata | jsonb | Structured data |
| visible_to_agent | boolean | Show to AI agents |
| is_system_marker | boolean | System-generated marker |
| display_in_ui | boolean | Show in UI |
| created_at | timestamptz | Event timestamp |

**Event Types**:
- `build_complete` - Design wizard completed
- `prompt_generated` - Prompt created
- `prompt_copied` - Prompt copied to clipboard
- `gate1_round` - Gate 1 conversation round
- `gate1_complete` - Gate 1 finished
- `gate2_verify` - Gate 2 verification
- `debug_message` - Debug conversation
- `debug_complete` - Debug resolved
- `game_regenerated` - Game regenerated
- `prediction_made` - **P7** Student prediction before sending
- `prediction_validated` - **P7** Prediction vs reality comparison
- `validation_reflection` - **P7** Why matched/differed
- `iteration_idea` - **P7** Iteration improvement idea
- `recovery_insight` - **P7** Recovery learning
- `identity_reflection` - **P7** End-of-class identity reflection

### agent_sessions
**V17** - Agent interaction sessions (Gate 1/2).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| student_id | uuid | FK to students (CASCADE) |
| session_id | uuid | FK to sessions (CASCADE) |
| target_upgrade_id | text | Upgrade being worked on |
| target_upgrade_label | text | Upgrade display name |
| actual_rounds | int | Number of conversation rounds |
| early_release | boolean | Released on round 1 |
| best_student_quote | text | Best quote from student |
| gate1_completed | boolean | Gate 1 done |
| upgrade_appeared | boolean | Upgrade verified in game |
| gate2_mode | text | 'retry' or 'diagnose' |
| student_diagnosed | boolean | Student identified the issue |

### debug_sessions
Debug chat sessions for troubleshooting.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| student_id | uuid | FK to students (CASCADE) |
| session_id | uuid | FK to sessions (CASCADE) |
| bug_type | text | 'prompt' or 'code' |
| bug_summary | text | Description of the bug |
| resolved | boolean | Bug fixed |
| messages | jsonb | Chat history |

### reports
AI-generated parent reports.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| student_id | uuid | FK to students (CASCADE) |
| session_id | uuid | FK to sessions (CASCADE) |
| content_zh | text | Chinese narrative + P7 cognitive section |
| content_en | text | English narrative + P7 cognitive section |
| pathway_zh | text | Chinese learning pathway |
| pathway_en | text | English learning pathway |
| cta_tier | text | 'enrolled' / 'hot' / 'warm' / 'cold' |
| share_token | text | Public share token |

## Signal Tables

### student_signals
Auto-detected behavioral signals (5 dimensions).

| Column | Type | Description |
|--------|------|-------------|
| student_id | uuid | FK to students (unique) |
| cl_game_made | boolean | Made a game |
| cl_game_played | boolean | Played the game |
| ow_named | boolean | Named the game |
| ow_showed | boolean | Showed to parent |
| ps_got_stuck | boolean | Got stuck |
| ps_recovered | boolean | Recovered from stuck |
| cs_used_hard | boolean | Used hard upgrade |
| cs_own_idea | boolean | Created own idea |
| ... | | |

### conversion_signals
Sales funnel tracking.

| Column | Type | Description |
|--------|------|-------------|
| student_id | uuid | FK to students (unique) |
| pa_stayed | boolean | Parent stayed whole class |
| pa_photo | boolean | Parent took photo |
| pa_asked_price | boolean | Parent asked about price |
| ch_wants_continue | boolean | Child wants to continue |
| sale_deposit_taken | boolean | Deposit paid |
| sale_intent_tier | text | 'hot' / 'warm' / 'cold' |

## Enrollment System

### student_enrollments
Pre-registered student records with 6-digit shortcode.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| organization_id | uuid | FK to organizations |
| batch_id | uuid | FK to enrollment_batches |
| student_name | text | Student name |
| parent_phone | text | Parent phone |
| shortcode | text | 6-digit student code (unique) |
| enrollment_token | text | Parent verification token |
| status | text | 'pending' / 'enrolled' |

### enrollment_batches
CSV import batches for bulk enrollment.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| organization_id | uuid | FK to organizations |
| ta_id | uuid | FK to ta_profiles |
| filename | text | Original CSV filename |
| total_count | int | Number of students |
| status | text | 'pending' / 'processing' / 'completed' |

## Organization & Auth

### organizations
Multi-tenant organization support.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Organization name |
| slug | text | URL slug (unique) |

### ta_profiles
TA accounts linked to organizations.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | PK, FK to auth.users (CASCADE) |
| email | text | Email address |
| name | text | Display name |
| organization_id | uuid | FK to organizations |
| role | text | 'ta' / 'admin' / 'super_admin' |

## Indexes

### Performance-Critical Indexes
- `idx_timeline_student_session` - Timeline queries by student+session
- `idx_timeline_event_type` - **P7** Event type filtering
- `idx_agent_sessions_student` - Agent session lookups
- `idx_debug_student` - Debug session lookups
- `idx_students_session` - Students per session
- `idx_students_shortcode` - Shortcode lookups

## Row Level Security

All public tables have RLS enabled with permissive policies for MVP:
- Sessions: anon read/write
- Students: anon read/write
- Timeline: anon read/write

Production should implement proper policies based on organization membership.

## Data Flow

```
TA creates session (join_code, lesson_type)
    ↓
Student enters code → students record created
    ↓
Student designs game → session_timeline (build_complete, prompt_generated)
    ↓
Student uses upgrade → agent_sessions + session_timeline (gate1_*, gate2_*)
    ↓
Student makes prediction → session_timeline (prediction_made)      [P7]
    ↓
Student validates → session_timeline (prediction_validated)       [P7]
    ↓
Student debugs → debug_sessions + session_timeline (debug_*)
    ↓
Student reflects → students.session_reflection                    [P7]
    ↓
TA generates report → reports (includes P7 cognitive section)
```
