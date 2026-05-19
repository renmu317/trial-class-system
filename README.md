# Trial Class Data Collection System

A two-app system for conducting AI creative coding trial classes with real-time data collection.

## Overview

- **Student App** (port 5173): Game design assistant where students build AI prompts
- **TA Dashboard** (port 5174): Real-time monitoring and scoring interface for TAs

## Setup

### 1. Create Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Create a new project
3. Go to SQL Editor and run the schema from `supabase-schema.sql`

### 2. Configure Environment

Copy `.env.local.example` to `.env.local` in both apps and fill in your Supabase credentials:

```bash
# student-app/.env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

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

Terminal 1:
```bash
cd student-app && npm run dev
```

Terminal 2:
```bash
cd ta-dashboard && npm run dev
```

## Usage

### For TAs

1. Open TA Dashboard at `http://localhost:5174`
2. Create a new session or select an existing one
3. Choose your TA role (TA1 or TA2)
4. Share the QR code or link with students
5. Monitor student progress and score in real-time

### For Students

1. Scan QR code or click the link shared by TA
2. Enter your name to join the class
3. Follow the 4-step game design process
4. Generate prompts and upgrade your game

## Features

### Student App
- 4-step game design flow
- AI prompt generator
- Help section with common questions
- Game upgrade system with 3 difficulty levels
- Offline event queue with automatic retry

### TA Dashboard
- Session management with QR code sharing
- Real-time student monitoring (5s polling)
- 5-dimension scoring with +/- buttons
- Multi-TA support (scores are averaged)
- Adjustable scoring weights
- CSV export

## Data Model

- **sessions**: Trial class instances
- **students**: Student records per session
- **scores**: 5-dimension scores (ownership, persistence, curiosity, expression, parent_signal)
- **student_events**: Behavioral events for analytics

## Event Types

| Event | Dimension | Trigger |
|-------|-----------|---------|
| game_named | ownership | Student names their game |
| own_idea_typed | ownership | Student enters custom idea |
| upgrade_selected | ownership | Student copies upgrade prompt |
| upgrade_retried | persistence | Student copies same upgrade 2+ times |
| help_requested | persistence | Student opens help item |
| medium_challenge_opened | curiosity | Student opens medium difficulty |
| hard_challenge_opened | curiosity | Student opens hard difficulty |

## Deployment

Both apps can be deployed to Vercel:

```bash
# Student App
cd student-app
vercel

# TA Dashboard
cd ta-dashboard
vercel
```

Update `VITE_STUDENT_APP_URL` in ta-dashboard to point to deployed student app URL.
