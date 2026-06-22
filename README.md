# Education OS - AI-Powered Creative Coding Platform

An AI-powered education platform for teaching creative coding to children (K-12), featuring real-time student monitoring, AI conversation agents, and multi-dimensional skill assessment.

## Overview

- **Student App** (port 5173): Interactive game design assistant where students build AI prompts
- **TA Dashboard** (port 5174): Real-time monitoring and scoring interface for teaching assistants

## Key Features

### Student App
- 4-step game design wizard
- AI prompt generator with guided flow
- Help section with common questions
- Game upgrade system with 3 difficulty levels (Easy/Medium/Hard)
- Offline event queue with automatic retry
- Gate 1/2 AI conversation system for skill verification

### TA Dashboard
- Session management with QR code sharing
- Real-time student monitoring (5s polling)
- 5-dimension scoring with auto-detection + TA confirmation
- Multi-TA support (scores are averaged)
- AI-generated parent reports (Chinese/English)
- CSV export for analytics

### AI Agent System
- **Gate 1**: Conversational agent helping students articulate design ideas
- **Gate 2**: Verification agent checking if upgrades appear in game
- **Debug Orchestrator**: Routes bugs to specialized tools (Prompt/Code/Reset)
- **Timeline Architecture**: ChatGPT-style function calling with conversation history

## Tech Stack

- **Frontend**: React 19.2, Vite, Tailwind CSS 4.3
- **Backend**: Supabase (PostgreSQL + Auth + Edge Functions)
- **AI**: DeepSeek API / Claude API
- **Deployment**: Vercel

## Quick Start

### 1. Create Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Create a new project
3. Go to SQL Editor and run the schema from `database/schema.sql`

### 2. Configure Environment

Copy `.env.example` to `.env.local` in both apps:

```bash
# student-app/.env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_AI_API_KEY=your-deepseek-or-claude-key

# ta-dashboard/.env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_STUDENT_APP_URL=http://localhost:5173
```

### 3. Install Dependencies

```bash
cd student-app && npm install
cd ../ta-dashboard && npm install
```

### 4. Run Development Servers

```bash
# Terminal 1
cd student-app && npm run dev

# Terminal 2
cd ta-dashboard && npm run dev
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Code Layer (Deterministic)                                  │
│  round counting / fix_quality evaluation / all_covered check │
└──────────────────┬──────────────────────────────────────────┘
                   ↓ Tool call results write to
┌──────────────────▼──────────────────────────────────────────┐
│  Conversation History Layer (ChatGPT Function Calling style) │
│  Tool call results as system turns                           │
│  Trim strategy: current tool full / completed tools compress │
└──────────────────┬──────────────────────────────────────────┘
                   ↓ Format and inject
┌──────────────────▼──────────────────────────────────────────┐
│  Timeline Layer (Solves cross-tab context)                   │
│  session_timeline: all tabs, all events                      │
│  formatForAgent(): converts to natural language context      │
└──────────────────┬──────────────────────────────────────────┘
                   ↓ Write/Read
┌──────────────────▼──────────────────────────────────────────┐
│  Memory Layer (ChatGPT Memory inspired)                      │
│  Hot: current session full timeline                          │
│  Warm: last 1-3 session summaries                            │
│  Cold: student profiles (after 3+ sessions)                  │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌──────────────────▼──────────────────────────────────────────┐
│  Model Layer (Claude.ai inspired)                            │
│  System Prompt: 150 tokens, role description only            │
│  Model does language generation, not state inference         │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

See [DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) for complete reference.

### Core Tables

| Table | Description |
|-------|-------------|
| `sessions` | Trial class instances with join codes |
| `students` | Student records per session |
| `session_timeline` | Unified event tracking (V17) |
| `agent_sessions` | Gate 1/2 conversation records |
| `debug_sessions` | Debug chat sessions |
| `reports` | AI-generated parent reports |
| `student_signals` | Auto-detected behavioral signals |
| `conversion_signals` | Sales funnel tracking |

### Multi-Tenant Support

| Table | Description |
|-------|-------------|
| `organizations` | Multi-tenant organization support |
| `ta_profiles` | TA accounts with Magic Link auth |
| `student_enrollments` | Pre-registration with shortcodes |

## Scoring System

### 5-Dimension Assessment

| Dimension | Auto-Detected Signals | TA Confirmation |
|-----------|----------------------|-----------------|
| **Competence Loop** | game_made, game_played | - |
| **Ownership** | game_named, showed_to_parent | own_idea_used |
| **Persistence** | got_stuck, recovered | help_requested |
| **Challenge Seed** | hard_upgrade_used | - |
| **Parent Signal** | - | stayed, took_photo, asked_price |

## Event Types

| Event | Description |
|-------|-------------|
| `build_complete` | Design wizard completed |
| `prompt_generated` | Prompt created |
| `gate1_round` | Gate 1 conversation round |
| `gate1_complete` | Gate 1 finished |
| `gate2_verify` | Gate 2 verification |
| `debug_message` | Debug conversation |
| `debug_complete` | Debug resolved |

## Deployment

Both apps can be deployed to Vercel:

```bash
# Student App
cd student-app && vercel

# TA Dashboard
cd ta-dashboard && vercel
```

Update `VITE_STUDENT_APP_URL` in ta-dashboard to point to deployed student app URL.

## Project Structure

```
education-os/
├── apps/
│   ├── student-app/          # Student learning interface
│   │   ├── src/
│   │   │   ├── components/   # React components
│   │   │   ├── lib/          # Utilities (supabase, timeline, agent)
│   │   │   └── lessons/      # Lesson configurations
│   │   └── package.json
│   │
│   └── ta-dashboard/         # TA management interface
│       ├── src/
│       │   ├── components/   # Dashboard components
│       │   └── lib/          # Utilities
│       └── package.json
│
├── database/
│   ├── schema.sql            # Main database schema
│   ├── auth-schema.sql       # Authentication tables
│   └── migrations/           # Version migrations
│
├── docs/
│   ├── DATABASE_SCHEMA.md    # Schema reference
│   ├── ARCHITECTURE.md       # System architecture
│   └── AUTH_SYSTEM.md        # Auth system design
│
└── README.md
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

- Built with [Supabase](https://supabase.com)
- UI components from [Tailwind CSS](https://tailwindcss.com)
- Icons from [Lucide](https://lucide.dev)
