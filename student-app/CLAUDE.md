# Trial Class System

## Project Overview

A two-app system for AI Creative Class trial sessions:
- **Student App** (port 5173): Students design games and generate AI prompts
- **TA Dashboard** (port 5174): TAs monitor students and collect behavioral signals

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
│   │   ├── lib/
│   │   │   ├── supabase.js
│   │   │   ├── events.js    # Event reporting with offline queue
│   │   │   └── lesson.js    # LESSON config, RECOVERY, upgrades
│   │   └── components/
│   │       ├── NameInput.jsx
│   │       ├── DesignCard.jsx
│   │       ├── PromptGenerator.jsx
│   │       ├── Recovery.jsx
│   │       ├── Upgrade.jsx
│   │       ├── GameNameBadge.jsx
│   │       └── Button.jsx
│   └── .env.local        # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
│
├── ta-dashboard/         # TA-facing dashboard
│   ├── src/
│   │   ├── App.jsx
│   │   ├── lib/
│   │   │   ├── supabase.js
│   │   │   └── signalScore.js  # V17 conversion score algorithm
│   │   └── components/
│   │       ├── Setup.jsx
│   │       ├── Dashboard.jsx
│   │       ├── StudentCard.jsx   # V17 checkbox UI
│   │       ├── SessionQRCode.jsx
│   │       └── ExportButton.jsx
│   └── .env.local
│
├── supabase-schema-v17.sql   # V17 student_signals table
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

## Production Deployment (Vercel)

| App | URL | GitHub |
|-----|-----|--------|
| Student App | https://trial-class-system.vercel.app | renmu317/trial-class-system |
| TA Dashboard | https://ta-dashboard-xi.vercel.app | renmu317/trial-class-system |

### Environment Variables (Vercel)

Both apps require these environment variables in Vercel project settings:
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key

TA Dashboard additionally needs:
- `VITE_STUDENT_APP_URL` - Student app URL for QR code generation

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
```

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
- `ta-dashboard/src/lib/signalScore.js` - Conversion score calculation
- `Plan-v3-dimensions.md` - Complete V17 specification

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
