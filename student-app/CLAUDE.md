# Trial Class System

## Project Overview

A three-app system for AI Creative Class trial sessions:
- **Student App** (port 5173): Students design games and generate AI prompts + Report viewing
- **TA Dashboard** (port 5174): TAs monitor students, collect signals, generate AI reports
- **Sales App** (port 5175): Real-time sales dashboard with conversion signals (P3)

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React + Vite |
| Styling | Tailwind CSS v4 |
| Backend | Supabase (PostgreSQL) |
| Auth | Anonymous (anon key) |

## Project Structure

```
Trial_Class_System/
├── student-app/          # Student-facing app
│   ├── src/
│   │   ├── App.jsx       # Main app with session/event management
│   │   ├── main.jsx      # Router setup for /report/:token
│   │   ├── lib/
│   │   │   ├── supabase.js
│   │   │   ├── events.js    # Event reporting with offline queue
│   │   │   └── lesson.js    # LESSON config, RECOVERY, upgrades
│   │   ├── components/
│   │   │   ├── NameInput.jsx
│   │   │   ├── DesignCard.jsx
│   │   │   ├── PromptGenerator.jsx
│   │   │   ├── Recovery.jsx
│   │   │   ├── Upgrade.jsx
│   │   │   ├── GameNameBadge.jsx
│   │   │   └── Button.jsx
│   │   └── pages/
│   │       └── ReportPage.jsx    # P3: Public report page
│   └── .env.local
│
├── ta-dashboard/         # TA-facing dashboard
│   ├── src/
│   │   ├── App.jsx
│   │   ├── lib/
│   │   │   ├── supabase.js
│   │   │   ├── signalScore.js    # V17 conversion score algorithm
│   │   │   └── reportPrompt.js   # P3: DeepSeek AI prompt
│   │   └── components/
│   │       ├── Setup.jsx
│   │       ├── Dashboard.jsx
│   │       ├── StudentCard.jsx       # V17 + P3 conversion signals
│   │       ├── SessionQRCode.jsx
│   │       ├── ExportButton.jsx
│   │       ├── ReportGenerator.jsx   # P3: AI report generation
│   │       └── ReportReviewPanel.jsx # P3: Report preview/edit/send
│   └── .env.local                    # + VITE_DEEPSEEK_API_KEY
│
├── sales-app/            # P3: Sales-facing dashboard
│   ├── src/
│   │   ├── App.jsx       # Single-page MVP with realtime updates
│   │   └── lib/supabase.js
│   └── .env.local
│
├── supabase-schema-v17.sql   # V17 student_signals table
├── p3-schema.sql             # P3: conversion_signals + reports tables
├── p3-followup-schema.sql    # P3.1: follow-up fields for reports
├── scripts/                  # Test scripts
│   └── clear-and-test.js     # 40-person pressure test
├── Plan/
│   └── P3_Dev_Plan.md        # P3/P3.1 development plan
└── Plan-v3-dimensions.md     # V17 design document
```

## Supabase Configuration

**Project URL**: `https://aebxtunvdtabhdtihglh.supabase.co`

### Database Tables

| Table | Purpose |
|-------|---------|
| `sessions` | Trial class sessions (id, name, status) |
| `students` | Student records per session |
| `student_events` | Behavioral events from student app |
| `student_signals` | V17 signal-based tracking (boolean flags) |
| `conversion_signals` | P3: Sales conversion tracking (TA + Sales + auto) |
| `reports` | P3: AI-generated student reports |
| `scores` | Legacy 1-10 scoring (deprecated) |

## V17 Signal System

### 5 Dimensions

| Dimension | Auto Rate | TA Checkboxes |
|-----------|-----------|---------------|
| Competence Loop | 100% | 0 |
| Ownership | 33% | 2 (showed, explained) |
| Persistence | 100% | 0 |
| Challenge Seed | 60% | 1 (verbal want) |
| Parent Signal | 0% | 4 (photo, price, stayed, looked) |

### Auto-detected Events

| Event | Trigger | Signal |
|-------|---------|--------|
| `prompt_generated` | Copy prompt button | cl_game_made |
| `prompt_tab_revisited` | Return to prompt tab | cl_game_played |
| `upgrade_selected` | Copy any upgrade | cl_game_modified |
| `game_named` | Save custom name | ow_named |
| `help_requested` | Open recovery item | ps_asked_help |
| `medium_challenge_opened` | Expand medium section | cs_used_medium |
| `hard_challenge_opened` | Expand hard section | cs_used_hard |
| `upgrade_own_idea_submitted` | Submit own idea | cs_own_idea |

### Stuck Detection

- Student is "stuck" if no event for >3 minutes
- Auto-sets `ps_got_stuck = true`
- If activity resumes, sets `ps_recovered = true`

## P3 Agentic AI System

### Conversion Signals (conversion_signals table)

| Field | Source | Trigger Alert |
|-------|--------|---------------|
| `pa_stayed` | TA | No |
| `pa_photo` | TA | No |
| `pa_asked_price` | TA | Yes - Sales alert |
| `pa_leaned_in` | TA | No |
| `pa_surprised` | TA | No |
| `ch_showed_parent` | TA | Yes - Sales alert |
| `ch_wants_continue` | TA | Yes - Sales alert |
| `ch_explained_parent` | TA | No |
| `sale_qr_shown` | Sales | - |
| `sale_deposit_taken` | Sales | - |
| `sale_intent_tier` | Sales | Hot/Warm/Cold |
| `rep_opened` | Auto | Report opened |
| `rep_read_depth` | Auto | Scrolled >50% |
| `rep_cta_clicked` | Auto | CTA button clicked |

### AI Report Generation

- Uses **DeepSeek API** (`deepseek-chat` model)
- Generates bilingual reports (Chinese + English)
- Includes learning pathway recommendations
- CTA tier: enrolled / hot / warm / cold

### Report Page Features

- Route: `/report/:token` (student-app)
- Language toggle (EN/CN)
- Analytics tracking (open, scroll depth, CTA click)

### Discount Logic (P3.1 Updated)

| Discount | Condition |
|----------|-----------|
| **-$200** | Deposit paid on-spot (`sale_deposit_taken = true`) |
| **-$100** | Within 24h after trial ends |
| **-$50** | 24-48h after trial ends |
| **None** | After 48h |

### Sales App Features

- Real-time updates via Supabase Realtime
- Highlights students with trigger signals
- Quick actions: QR Shown, Deposit, Intent Tier
- Sorted by hot leads first

## P3.1 Follow-up System (2026-05-19)

### Double-Send Timeline

| Time | Action | Trigger |
|------|--------|---------|
| 0-2h after trial | First send: Report | TA triggers |
| Async | Parent behavior tracking | Auto (rep_opened, rep_shared) |
| 24-48h | Second send: Follow-up | TA triggers |

### New Database Fields (reports table)

```sql
ALTER TABLE reports ADD COLUMN followup_content_zh text;
ALTER TABLE reports ADD COLUMN followup_content_en text;
ALTER TABLE reports ADD COLUMN followup_sent_at timestamptz;
```

### Follow-up AI Generation

- Uses parent behavior data to customize message:
  - `rep_opened`: Did parent open the report?
  - `rep_read_depth`: Did parent finish reading?
  - `rep_shared`: Did parent share with family?
- AI generates contextual follow-up (not repeating first report)
- Located in `reportPrompt.js`: `buildFollowUpPrompt()`, `generateFollowUp()`

### ReportReviewPanel Tabs

| Tab | Purpose |
|-----|---------|
| **Report** | Original report preview/edit/send |
| **Follow-up** | Parent behavior display + AI follow-up generation |

### Sales App Banners (P3.1)

| Banner | Color | Trigger |
|--------|-------|---------|
| Report Sent | Amber | `reports.sent_at` changes |
| Parent Shared | Blue | `conversion_signals.rep_shared` becomes true |
| Follow-up Sent | Pink | `reports.followup_sent_at` changes |

Features:
- Real-time via Supabase Realtime subscriptions
- Shows intent tier and discount remaining time
- Dismissible with X button

## Production Deployment (Vercel)

| App | URL |
|-----|-----|
| Student App | https://trial-class-system-zeta.vercel.app |
| TA Dashboard | https://ta-dashboard-xi.vercel.app |
| Sales App | https://sales-app-chi-two.vercel.app |

### Environment Variables (Vercel)

| App | Variables |
|-----|-----------|
| student-app | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| ta-dashboard | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DEEPSEEK_API_KEY` |
| sales-app | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

## Running Locally

```bash
# Terminal 1: Student App
cd student-app
npm run dev
# http://localhost:5173

# Terminal 2: TA Dashboard
cd ta-dashboard
npm run dev
# http://localhost:5174

# Terminal 3: Sales App (P3)
cd sales-app
npm run dev
# http://localhost:5175
```

### Environment Variables

| App | Variables |
|-----|-----------|
| student-app | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| ta-dashboard | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_STUDENT_APP_URL`, `VITE_DEEPSEEK_API_KEY` |
| sales-app | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

## Student Join Methods

| Method | URL | Use Case |
|--------|-----|----------|
| Short Code | `trial-class-system.vercel.app` → enter 4-digit code | Laptop users (recommended) |
| URL with Code | `trial-class-system.vercel.app/?code=1234` | Direct link sharing |
| QR Code | Scan from TA Dashboard | Phone users |
| Legacy UUID | `trial-class-system.vercel.app/?session=<uuid>` | Old links |

### 4-Digit Join Code System
- TA creates session → system generates random 4-digit code (1000-9999)
- TA writes code on board or shares verbally
- Students visit student app → enter code → enter name → start designing

## Workflow

1. TA creates session in Dashboard → gets 4-digit join code
2. TA shares code with students (write on board, or share QR/link)
3. Students go to `localhost:5173` → enter code → enter name
4. Students design game → generate prompt → copy to Claude
5. TA monitors progress, checks behavioral signals
6. TA ends session → exports CSV

## Key Files

- `student-app/src/lib/lesson.js` - Game design options, upgrades, recovery items
- `student-app/src/pages/ReportPage.jsx` - P3: Public report page with analytics
- `ta-dashboard/src/lib/signalScore.js` - Conversion score calculation
- `ta-dashboard/src/lib/reportPrompt.js` - P3/P3.1: DeepSeek prompt builder + follow-up
- `ta-dashboard/src/components/ReportGenerator.jsx` - P3: AI report generation button
- `ta-dashboard/src/components/ReportReviewPanel.jsx` - P3.1: Report + Follow-up tabs
- `sales-app/src/App.jsx` - P3.1: Sales dashboard with 3 banner types
- `p3-schema.sql` - P3: Database schema (conversion_signals, reports)
- `p3-followup-schema.sql` - P3.1: Follow-up fields for reports table
- `scripts/clear-and-test.js` - Pressure test script (40 students)
- `Plan/P3_Dev_Plan.md` - P3/P3.1 development plan

## Conversion Score Formula

```javascript
weights = {
  competence: 2.0,   // Can make something
  ownership: 1.5,    // Has ownership
  persistence: 1.0,  // Can persist
  challenge: 1.5,    // Wants more
  parent: 2.5        // Parent will pay
}
```

Score = weighted average of dimension completion rates (0-1)
