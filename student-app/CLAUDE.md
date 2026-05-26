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
│   │   │   ├── lesson.js    # LESSON config, RECOVERY, upgrades
│   │   │   ├── AgentBridge.js    # V17: Agent 触发逻辑
│   │   │   ├── agentGuards.js    # V17 Phase B: 代码层判断
│   │   │   ├── agentCaller.js    # V17 Phase B: API 调用层
│   │   │   ├── timeline.js       # V17 Phase B: 时间线读写
│   │   │   ├── conversationHistory.js  # V17 Phase B: 对话历史
│   │   │   └── prompts/          # V17 Phase B: System Prompts
│   │   ├── components/
│   │   │   ├── NameInput.jsx
│   │   │   ├── DesignCard.jsx
│   │   │   ├── PromptGenerator.jsx
│   │   │   ├── Recovery.jsx
│   │   │   ├── Upgrade.jsx
│   │   │   ├── GameNameBadge.jsx
│   │   │   ├── Button.jsx
│   │   │   ├── AgentPanel.jsx    # V17: Gate 1/2 对话界面
│   │   │   └── DebugChat.jsx     # V17: Debug 持久对话界面
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
│   └── .env.local
│
├── sales-app/            # P3: Sales-facing dashboard
│   ├── src/
│   │   ├── App.jsx       # Single-page MVP with realtime updates
│   │   └── lib/supabase.js
│   └── .env.local
│
├── supabase/
│   └── functions/
│       ├── deepseek-proxy/   # Edge Function: DeepSeek API 代理
│       │   └── index.ts
│       └── compress-session/ # Edge Function: V17 Phase B 时间线压缩
│           └── index.ts
│
├── supabase-schema-v17.sql   # V17 student_signals table
├── p3-schema.sql             # P3: conversion_signals + reports tables
├── p3-followup-schema.sql    # P3.1: follow-up fields for reports
├── scripts/                  # Test scripts
│   ├── clear-and-test.js     # 40-person pressure test
│   └── deduplicate-students.js  # 清理重复学生记录
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
| `session_timeline` | V17 Phase B: 热记忆（实时事件流） |
| `session_summaries` | V17 Phase B: 温记忆（课程摘要） |
| `student_profiles` | V17 Phase B: 冷记忆（学生画像） |

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

### Supabase Edge Functions

| Function | Purpose | Secret |
|----------|---------|--------|
| `deepseek-proxy` | 代理 DeepSeek API 调用，保护 API Key | `DEEPSEEK_API_KEY` |

**安全架构**：
- DeepSeek API Key 存储在 Supabase Secret（不暴露给前端）
- Student App 调用 Edge Function → Edge Function 调用 DeepSeek API
- Edge Function URL: `https://aebxtunvdtabhdtihglh.supabase.co/functions/v1/deepseek-proxy`

### Environment Variables (Vercel)

| App | Variables |
|-----|-----------|
| student-app | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| ta-dashboard | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DEEPSEEK_API_KEY` |
| sales-app | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |

**注意**：Student App 不再需要 `VITE_DEEPSEEK_API_KEY`，已迁移到 Supabase Edge Function。

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

## Student Join Methods (统一入口)

**统一入口**：`trial-class-system-zeta.vercel.app`

学生只需输入 4 位 code，系统自动识别课程。不再需要 `?lesson=` URL 参数。

| Method | URL | Use Case |
|--------|-----|----------|
| **Short Code (推荐)** | `trial-class-system-zeta.vercel.app` → 输入 4 位 code | 所有用户 |
| URL with Code | `trial-class-system-zeta.vercel.app/?code=1234` | 直接链接分享 |
| QR Code | 扫 TA Dashboard 显示的二维码 | 手机用户 |

### 统一入口工作流程

1. **TA 创建 session** → 选择课程 (Lesson 1 或 Lesson 2) → 生成 4 位 code
2. **Session 存储 `lesson_type`** → `lesson1` 或 `lesson2`
3. **学生输入 code** → 查询 session → 读取 `lesson_type` → 自动加载对应课程
4. **无需 URL 参数** → 课程由 session 决定，不是由 URL 决定

### 数据库字段

```sql
-- sessions 表
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS lesson_type text DEFAULT 'lesson1';
```

### lesson_type 值对应

| lesson_type | 课程 | 标签 |
|-------------|------|------|
| `lesson1` | Catch Falling Game | 🎮 Catch |
| `lesson2` | AI Maze Game | 🧩 Maze |

## Workflow

1. TA creates session in Dashboard → **选择课程** → gets 4-digit join code
2. TA shares code with students (write on board, or share QR/link)
3. Students go to `trial-class-system-zeta.vercel.app` → enter code → **自动加载对应课程** → enter name
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
- `scripts/deduplicate-students.js` - 清理重复 student 记录
- `Plan/P3_Dev_Plan.md` - P3/P3.1 development plan

## Student 去重机制

### 问题
同一个学生多次输入相同名字进入 session，会创建多条 student 记录。

### 解决方案

**App.jsx handleNameSubmit**：
1. 查询同 session 同名 student（大小写不敏感）
2. 如果存在 → 显示「Welcome back」确认弹窗
3. 「Yes, that's me」→ 复用旧记录
4. 「No, different person」→ 创建新记录，名字加 `(2)` 后缀

### 清理脚本

```bash
cd scripts

# Dry run（查看会影响哪些记录）
SUPABASE_ANON_KEY=xxx node deduplicate-students.js

# 实际执行
SUPABASE_SERVICE_KEY=xxx node deduplicate-students.js --confirm
```

清理逻辑：
1. 找出同 session 同名 student（不区分大小写）
2. 保留最早创建的一条（primary）
3. 把其他记录的 agent_sessions / student_events 合并到 primary
4. 删除重复记录

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

---

## V17 Agent 系统架构

### 核心文件

| 文件 | 职责 |
|------|------|
| `AgentPanel.jsx` | Agent 对话 UI + DeepSeek API 调用 |
| `AgentBridge.js` | 触发逻辑 + Supabase 写入 |
| `lesson.js` / `lesson2.js` | 课程配置（upgrades, language_dimensions） |

### 通用 Agent 设计

Agent 代码是通用的，通过 `lesson.js` 配置实现课程可拔插：

```javascript
// AgentPanel.jsx 读取 lesson 配置
function buildGate1SystemPrompt(upgrade, lesson) {
  return `
    Game type: ${lesson.title}
    Selected upgrade: ${upgrade.title} - ${upgrade.prompt || upgrade.hint || ''}
    Language Dimensions: ${upgrade.language_dimensions}
  `;
}
```

### 三种 Upgrade 级别结构

#### Easy Upgrade
```javascript
{
  id: "lives",
  level: "easy",
  title: "Lives Counter",
  emoji: "❤️",
  prompt: "Add a lives counter...",  // 固定 prompt，直接复制
  agent_context: "显示剩余生命数的计数器",
  language_dimensions: [DIMENSION_LIBRARY.quantity, ...],
}
```
- **交互**：Start → Agent 追问 → Copy 固定 prompt
- **Agent 目的**：帮助学生理解功能

#### Medium Upgrade
```javascript
{
  id: "boss",
  level: "medium",
  title: "Boss Battle",
  emoji: "👹",
  think: "How long should players play...",  // 思考提示
  params: [
    { key: "score", label: "Boss appears at score", default: 20, min: 5, max: 100, hint: "..." },
    { key: "hits", label: "Hits to defeat", default: 3, min: 1, max: 10, hint: "..." },
  ],
  buildPrompt: (p) => `When player reaches ${p.score} points...`,  // 动态生成
  agent_context: "Boss战斗系统",
  language_dimensions: ["出现时机意图（...）", "战斗难度意图（...）"],
}
```
- **交互**：Start → Agent 追问意图 → 填 params 数字 → Copy 动态 prompt
- **Agent 目的**：追问设计意图，帮助学生决定参数

#### Hard Upgrade
```javascript
{
  id: "difficulty-curve",
  level: "hard",
  title: "Balance Designer",
  emoji: "⚖️",
  hint: "What makes a game start easy, then get hard?",  // 提示
  prompt: null,  // 学生自己写
  agent_context: "难度平衡设计",
  language_dimensions: [DIMENSION_LIBRARY.speed, ...],
}
```
- **交互**：Start → Agent 追问 → 学生写描述 → Copy 学生写的 prompt
- **Agent 目的**：帮助学生把模糊想法变成精确语言

### Agent Gate 1 流程

```
1. 用户点击 [Start] 按钮
   ↓
2. Upgrade.jsx 调用 onStartUpgrade(upgradeId, level)
   ↓
3. App.jsx 调用 agentBridge.trigger('upgrade_started', upgradeId)
   ↓
4. AgentBridge 创建 agent_sessions 记录，调用 onOpenPanel()
   ↓
5. AgentPanel 打开，构建 System Prompt，调用 DeepSeek API
   ↓
6. 学生回答 → AI 评分 → 决定继续/结束
   ↓
7. Gate 1 完成 → AgentBridge.onGate1Complete() 写入数据库
   ↓
8. onGate1Complete 回调 → completedUpgrades 更新 → UI 显示 Copy/params
```

### Agent Gate 2 流程

```
1. 用户返回 Prompt Tab
   ↓
2. AgentBridge 检测 prompt_tab_revisited 事件
   ↓
3. 查询 agent_sessions：pendingVerify + incomplete
   ↓
4. 合并 agenda，打开 AgentPanel (mode='gate2')
   ↓
5. 验证 Upgrade（按难度不同）
   ├─ Easy/Medium: 「Did [X] appear in your game?」
   └─ Hard: 「Did the result MATCH what you described?」
   ↓
6. AgentBridge.onGate2Complete() 批量写入
```

### Hard Gate 2 验证逻辑（V17 重设计）

**关键区别**：
- Easy/Medium：问「出现了吗」→ appeared = true/false
- Hard：问「匹配吗」→ matched = true/false（appeared 默认为 true）

**为什么不同**：Hard Upgrade 学生自己写 prompt，Claude 几乎肯定会执行*某些东西*。
问题不是「有没有」，而是「和学生描述的一不一致」。

**验证流程**：
```
1. 引用 bestQuote 问："You described '[quote]'. Did the result match what you imagined?"
   ↓
2. 如果匹配 (matched = true):
   - 追问: "What made it work? What was clear in your description?"
   - 记录: attributed = true
   ↓
3. 如果不匹配 (matched = false):
   - 先问: "What's different from what you described?"
   - 再问: "Which part of your description was missing or unclear?"
   ↓
4. 分类失败类型:
   - no_prompt: 学生意识到自己没描述那部分
   - prompt_ignored: 学生描述了但 Claude 做得不一样
```

**Response 格式（Hard 专用字段）**：
```javascript
{
  "upgrade_id": "difficulty-curve",
  "appeared": true,           // Hard 默认为 true
  "matched": false,           // ← Hard 专用：是否匹配描述
  "attributed": true,
  "failure_type": "prompt_ignored",
  "mismatch_detail": "Speed increased but not gradually"  // ← Hard 专用
}
```

### System Prompt 评分标准

#### Easy / Hard 评分（分数放行）
```javascript
scores: {
  specificity: 0-3,  // 具体性
  causality: 0-3,    // 因果性
  autonomy: 0-3,     // 自主性
  total: 0-9
}

// 动态轮数逻辑
Round 1 后：
├─ total ≥ 6 → 放行 (early_release)
├─ total 3-5 → 填空题 (mode: "fill")
└─ total ≤ 2 → 选择题 (mode: "choice")

Round 3：无条件结束
```

#### Medium 评分（param_coverage 放行）
```javascript
// V17 重设计：Medium 使用 param_coverage 而非分数阈值
{
  "param_coverage": {
    "score": { "covered": true, "intent": "late-game reward" },
    "hits":  { "covered": true, "intent": "epic long battle" }
  },
  "all_covered": true,  // ← 放行条件
  "scores": {
    "intent_clarity": 0-3,     // 意图清晰度
    "design_reasoning": 0-3,   // 设计理由
    "autonomy": 0-3,           // 自主性
    "total": 0-9
  },
  "continue": true/false,
  "mode": "open" | "choice"
}

// 放行逻辑
all_covered: true → continue: false, early_release: true
all_covered: false → continue: true
  ├─ 无意图表达 → mode: "choice"
  └─ 部分意图 → mode: "open"

Round 3：无条件结束
```

#### Medium 的关键区别
- **不问数字**：「How many hits?」❌ → 「Quick fight or epic battle?」✓
- **追问意图**：理解学生的设计偏好，而非具体数值
- **coverage 追踪**：每个 param 是否有表达意图
- **all_covered 放行**：所有 params 都有意图表达时放行

### 已知问题（待修复）

#### 问题 1：Medium 的 System Prompt 缺少 params 信息
```javascript
// 当前：只传 upgrade.prompt || upgrade.hint
Selected upgrade: ${upgrade.title} - ${upgrade.prompt || upgrade.hint || ''}

// Medium 实际结构：
// - prompt = undefined
// - hint = undefined
// - think = "思考提示"（未被使用）
// - params = [{key, label, min, max, hint}]（未被使用）
```

#### 问题 2：Agent 对话与 params 断开
```
Agent 问：「想让 Boss 早出现还是晚出现？」
学生答：「晚一点，玩很久才见到」
Agent 说：「好的！」

然后学生看到：
  Boss appears at score: [20]  ← 默认值，不知道该填多少

没有：「根据你的回答，建议填 50-80」
```

#### 问题 3：评分标准不适用于意图问题
```
language_dimensions: ["出现时机意图（想让 Boss 早点出现还是晚出现）"]

学生回答：「我想让 Boss 晚点出现」

这不是关于 specificity/causality/autonomy，而是设计偏好
评分标准与问题类型不匹配
```

### V17 Bug 修复记录 (2026-05-23)

#### 修复 1：Gate 2 触发条件错误
**问题**：从 Upgrade Tab 返回 Prompt Tab 时，Gate 2 不触发
**原因**：`handleTabChange` 检查的是 `prevTab` 而不是当前 `tab`
**修复**：
```javascript
// App.jsx - 修改前
if (newTab === 'prompt' && prevTab !== 'prompt' && prevTab !== 'design') {

// App.jsx - 修改后
if (newTab === 'prompt' && (tab === 'upgrade' || tab === 'help')) {
```

#### 修复 2：Hard Upgrade textarea 空白问题
**问题**：Agent 对话完成后，Hard 卡片显示空白 textarea，对话内容丢失
**原因**：`bestQuote` 未传递到 Upgrade 组件
**修复**：
- `AgentPanel.jsx`: `onGate1Complete` 返回 `{ upgradeId, upgradeLevel, recommendations, bestQuote }`
- `App.jsx`: 添加 `upgradeQuotes` state，存储 Hard 升级的 bestQuote
- `Upgrade.jsx`: Hard 卡片显示三区域：bestQuote 展示 + 写作提示 + 空白 textarea

#### 修复 3：Hard 模式 "闪退" 问题
**问题**：AI 回复后 Panel 立即关闭，用户来不及看到回复
**原因**：`handleGate1Finish` 直接调用 `onGate1Complete`，触发 Panel 关闭
**修复**：
```javascript
// AgentPanel.jsx
const [gate1CompletionData, setGate1CompletionData] = useState(null);

// handleGate1Finish: 存储数据，不触发回调
setGate1CompletionData({ upgradeId, upgradeLevel, recommendations, bestQuote });

// handleClose: 用户点击 Continue 时才触发回调
if (gate1CompletionData && onGate1Complete) {
  onGate1Complete(gate1CompletionData);
}
```

#### 修复 4：API 错误后对话卡住
**问题**：DeepSeek 返回空响应后，对话框卡住无法继续
**原因**：`choices` 和 `currentMode` 未重置
**修复**：
```javascript
// AgentPanel.jsx - 错误处理
} catch (error) {
  if (currentRound >= 3) {
    // Round 3 API 失败也完成 Gate 1（Round 3 是无条件结束）
    handleGate1Finish(rounds, false, bestQuote);
  } else {
    // 重置到开放输入模式
    setCurrentMode('open');
    setChoices([]);
    setFillTemplate('');
  }
}
```

### 数据库表 agent_sessions

```sql
CREATE TABLE agent_sessions (
  id uuid PRIMARY KEY,
  student_id uuid,
  session_id uuid,
  lesson_type text,

  -- Upgrade 信息
  upgrade_sequence int,
  target_upgrade_id text,
  target_upgrade_label text,
  upgrade_difficulty text,

  -- Gate 1 状态
  gate1_completed boolean DEFAULT false,
  actual_rounds int,
  early_release boolean,

  -- Round 1-3 数据
  round_1_input text,
  round_1_score_specificity int,
  round_1_score_causality int,
  round_1_score_autonomy int,
  round_1_total int,
  -- ... round_2, round_3 同结构

  -- Gate 2 字段
  upgrade_appeared boolean,
  upgrade_matched boolean,    -- Hard专用：描述是否匹配游戏结果
  mismatch_detail text,       -- Hard专用：不匹配时的具体差异描述
  student_attributed boolean,
  gate2_failure_type text,    -- 'no_prompt' | 'prompt_ignored'

  -- 报告素材
  best_student_quote text,
  language_growth_note text,
);
```

### 扩展端口

| 端口 | 位置 | 用途 |
|------|------|------|
| **端口1** | `lesson.agent.demo_description` | 每节课的示范作品描述 |
| **端口2** | `agent_sessions.lesson_type` | 区分不同课程的数据 |
| **端口3** | `DIMENSION_LIBRARY` | 跨课程复用维度描述 |

新课接入：只需填写 lesson.js 的配置，AgentPanel 零改动。

---

## Lesson 1: Catch Falling Game

### 文件位置
`student-app/src/lib/lesson.js`

### 课程配置
```javascript
export const LESSON = {
  id: "catch-falling-v1",
  title: "Catch Falling Game",
  emoji: "🎮",
  agent: {
    demo_description: "一个接落物游戏，玩家左右移动接住下落的星星，躲避炸弹，有3条命",
  },
  steps: [
    { id: "catchItem", label: "What do you catch?", options: [...] },
    { id: "avoidItem", label: "What do you avoid?", options: [...] },
    { id: "background", label: "Background color?", options: [...] },
    { id: "difficulty", label: "How hard?", options: [...] },
  ],
  buildPrompt: (choices, ownInputs, gameName) => `...`,
  upgrades: [...],
};
```

### Upgrade 列表（V17 重设计）

| Level | ID | Title | 类型 |
|-------|-----|-------|------|
| Easy | lives | Lives Counter | **fillParam** (无 Gate 1) |
| Easy | highscore | High Score | **fillParam** (无 Gate 1) |
| Easy | speedup | Speed Boost | **fillParam** (无 Gate 1) |
| Easy | twotypes | Two Object Types | **fillParam** (无 Gate 1) |
| Easy | colorchange | Color Change | **fillParam** (无 Gate 1) |
| Easy | powerup | Power-Up | **fillParam** (无 Gate 1) |
| Easy | __own__ | My Own Idea | 学生输入 |
| Medium | boss | Boss Battle | params: score, hits |
| Medium | levels | Multiple Levels | params: levels, pointsPerLevel |
| Medium | sounds | Sound Effects | params: volume |
| Medium | talkingchar | Talking Character | params: every |
| Hard | difficulty-curve | Balance Designer | 学生写 prompt |
| Hard | storyteller | Storyteller | 学生写 prompt |
| Hard | signature | Signature Move | 学生写 prompt |

### V17 Lesson 1: Easy Upgrade fillParam 结构

**重设计目标**：Easy 升级不需要 Gate 1，学生直接填数字即可复制 prompt。

```javascript
// Lives Counter 示例
{
  id: "lives",
  level: "easy",
  title: "Lives Counter",
  emoji: "❤️",
  fillParam: {
    key: "lives",
    label: "Starting lives",       // 标签
    default: 3,
    min: 1,
    max: 9,
    hint: "1 = one mistake = game over · 3 = standard · 9 = very forgiving"
  },
  buildPrompt: (p) =>
    `Add a lives counter at the top that starts at ${p.lives} and shows hearts...`,
  language_dimensions: [],  // Easy 不触发 Gate 1
}
```

**全部 6 个 Easy fillParam**:

| ID | fillParam.key | 范围 | 默认 | 说明 |
|----|---------------|------|------|------|
| lives | lives | 1-9 | 3 | 初始生命数 |
| highscore | records | 1-5 | 1 | 保存前 N 名记录 |
| speedup | every | 3-30 | 10 | 每 N 分加速 |
| twotypes | bonus | 2-10 | 5 | 特殊物品分值 |
| colorchange | every | 5-30 | 10 | 每 N 分换色 |
| powerup | duration | 2-15 | 5 | 道具持续秒数 |

**buildPrompt 格式差异**:
- Lesson 1: `buildPrompt: (p) => ... ${p.lives} ...` （对象参数）
- Lesson 2: `buildPrompt: (seconds) => ... ${seconds} ...` （数字参数）
- EasyFillCard 组件自动兼容两种格式

### Medium Upgrade params 结构（含 hint）
```javascript
// Boss Battle
params: [
  { key: "score", label: "Boss appears at score", default: 20, min: 5, max: 100,
    hint: "Low (5-15) = quick boss fight · High (50+) = boss is late-game reward" },
  { key: "hits", label: "Hits to defeat boss", default: 3, min: 1, max: 10,
    hint: "1 = easy win · 3 = fair challenge · 10 = epic battle" },
]
language_dimensions: [
  "出现时机意图（想让 Boss 早点出现还是玩很久才见到）",
  "战斗难度意图（想让 Boss 战很快结束还是持久战）",
]
```

---

## Lesson 2: AI Maze Game

### 文件位置
`student-app/src/lib/lesson2.js`

### 课程配置
```javascript
export const LESSON_2 = {
  id: "maze-game-v1",
  title: "AI Maze Game",
  emoji: "🧩",
  agent: {
    demo_description: "A maze with 10 pathways where the player navigates from top-left to bottom-right",
  },
  steps: [
    { id: "theme", label: "Maze theme?", options: [...] },
    { id: "obstacle", label: "Dangerous thing to avoid?", options: [...] },
    { id: "reward", label: "Reward at the end?", options: [...] },
    { id: "size", label: "Maze size?", options: [...] },
    { id: "background", label: "Background color?", options: [...] },
  ],
  ruleDesign: { enabled: true, fields: [...] },  // Lesson 2 专属
  debugLog: { enabled: true, breakTypes: [...] }, // Lesson 2 专属
  buildPrompt: (choices, ownInputs, gameName, rules) => `...`,
  upgrades: [...],
};
```

### Lesson 2 专属功能

| 功能 | Tab | 说明 |
|------|-----|------|
| Rule Design | Rules | 4 个规则字段：collision, win, lose, difficulty |
| Debug Log | Debug | 6 种问题类型：wall, path, spawn, reward, collision, other |

### Upgrade 列表（V17 Lesson 2 更新）

| Level | ID | Title | 类型 |
|-------|-----|-------|------|
| Easy | timer | Time Limit | **fillParam** (无 Gate 1) |
| Easy | lives-counter | Lives Counter | **fillParam** (无 Gate 1) |
| Easy | collectibles | Collectibles | **fillParam** (无 Gate 1) |
| Easy | __own__ | My Own Idea | 学生输入 |
| Medium | moving-obstacle | Moving Obstacle | params: patrol_seconds |
| Medium | chasing-enemy | Chasing Enemy | params: speed |
| Medium | multiple-levels | Multiple Levels | params: levels |
| Hard | hidden-passage | Hidden Passage | 学生写 prompt |
| Hard | difficulty-curve | Difficulty Curve | 学生写 prompt |
| Hard | signature-rule | Signature Rule | 学生写 prompt |

### V17 Lesson 2: Easy Upgrade fillParam 结构

**与 Lesson 1 的区别**：Lesson 2 的 Easy 升级使用 `fillParam` 替代固定 `prompt`，允许学生直接输入数字，**无需 Gate 1**。

```javascript
// Timer 示例
{
  id: "timer",
  level: "easy",
  title: "Time Limit",
  emoji: "⏱️",
  fillParam: {
    key: "seconds",
    label: "Add a",           // 前缀文字
    suffix: "second timer",   // 后缀文字
    default: 60,
    min: 10,
    max: 300,
    hint: "30s = fast game · 120s = relaxed pace"
  },
  buildPrompt: (seconds) => `Add a ${seconds}-second countdown timer...`,
}
```

**UI 显示**：`Add a [60] second timer` — 数字可编辑，直接显示 Copy 按钮

**Upgrade.jsx 组件**：`EasyFillCard` 处理 fillParam 类型的 Easy 卡片

### Medium Upgrade params 结构（含 hint）
```javascript
// Moving Obstacle
params: [
  { key: "patrol_seconds", label: "Trap patrols every ___ seconds", default: 3, min: 1, max: 10,
    hint: "1s = very fast (hard), 10s = very slow (easy)" },
]
language_dimensions: [
  "难度意图（想让陷阱很难躲还是容易躲）",
  "移动节奏意图（想让陷阱快速来回还是缓慢移动）",
]
```

---

## Lesson 与 Agent 连接方式

### 1. 课程切换机制

```javascript
// lessonConfig.js
export const LESSONS = {
  'lesson1': { lesson: LESSON, levelConfig: LEVEL_CONFIG, ... },
  'lesson2': { lesson: LESSON_2, levelConfig: LEVEL_CONFIG_2, ... },
};

// URL 参数切换
// ?lesson=lesson1 或 ?lesson=lesson2
export function getLessonFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return LESSONS[params.get('lesson')] || LESSONS['lesson1'];
}
```

### 2. Agent 读取课程配置

```javascript
// AgentPanel.jsx
function buildGate1SystemPrompt(upgrade, lesson) {
  // 从 lesson 读取课程信息
  const gameType = lesson.title;  // "Catch Falling Game" 或 "AI Maze Game"

  // 从 upgrade 读取功能信息
  const upgradeTitle = upgrade.title;
  const upgradeContext = upgrade.agent_context;
  const dimensions = upgrade.language_dimensions;

  return `You are a game design assistant...
    Game type: ${gameType}
    Selected upgrade: ${upgradeTitle}
    Language Dimensions: ${dimensions.join('\n')}
  `;
}
```

### 3. AgentBridge 初始化

```javascript
// App.jsx
useEffect(() => {
  if (sessionId && studentId) {
    // 传入当前课程配置
    agentBridge.init(sessionId, studentId, lessonConfig.lesson, handleOpenAgentPanel);
  }
}, [sessionId, studentId, lessonConfig]);
```

### 4. Upgrade 组件接收课程配置

```javascript
// App.jsx
<Upgrade
  lessonConfig={lessonConfig}        // 传入课程配置
  onStartUpgrade={handleStartUpgrade}
  completedUpgrades={completedUpgrades}
  ...
/>

// Upgrade.jsx
export default function Upgrade({ lessonConfig, ... }) {
  const { lesson, levelConfig } = getLessonAndConfig(lessonConfig);
  // 使用 lesson.upgrades 渲染
}
```

### 5. 数据流总结（统一入口）

```
┌─────────────────────────────────────────────────────────────┐
│  学生访问: trial-class-system-zeta.vercel.app               │
│  输入 4 位 code（如 1700）                                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  App.jsx: handleCodeSubmit(code)                            │
│  → 查询 sessions 表，获取 lesson_type                        │
│  → setLessonConfig(LESSONS[lesson_type])                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  App.jsx: lessonConfig state                                │
│  → 传递给 Upgrade, AgentBridge, DesignCard 等               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Upgrade.jsx: 渲染 lesson.upgrades                          │
│  → 用户点击 [Start]                                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  AgentBridge: trigger('upgrade_started', upgradeId)         │
│  → 查找 upgrade = lesson.upgrades.find(u => u.id === id)    │
│  → 创建 agent_sessions 记录                                  │
│  → 调用 onOpenPanel({ upgrade, ... })                       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  AgentPanel.jsx: 构建 System Prompt                         │
│  → 使用 upgrade.language_dimensions                         │
│  → 使用 lesson.title                                        │
│  → 调用 DeepSeek API                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Lesson 1 vs Lesson 2 Upgrade 对比

| 特性 | Lesson 1 | Lesson 2 |
|------|----------|----------|
| **Easy 类型** | 固定 `prompt` + Gate 1 | `fillParam` 数字输入，无 Gate 1 |
| **Easy 组件** | 默认 UpgradeCard | EasyFillCard |
| **Easy UI** | [Start] → Agent → [Copy] | [数字输入] → [Copy] |
| **Medium** | params + Gate 1 | params + Gate 1（相同） |
| **Hard** | bestQuote + textarea | bestQuote + textarea（相同） |

### Upgrade.jsx 渲染逻辑

```javascript
// UpgradeCard 内部判断
if (up.isOwn) → My Own Idea 输入框
if (up.level === "hard" && up.prompt === null) → Hard 三区域界面
if (up.level === "medium") → MediumCard
if (up.level === "easy" && up.fillParam) → EasyFillCard (Lesson 2)
default → 默认 Easy 卡片 (Lesson 1)
```

---

## 更新日志

### 2026-05-26 V17 Phase B 架构重构

**核心设计原则**：
```
需要读懂意思 → 模型
不需要读懂意思 → 代码
```

**新增模块** (`student-app/src/lib/`):

| 文件 | 职责 |
|------|------|
| `agentGuards.js` | 代码层判断（RoundCounter, preCheckInput, 最大轮次） |
| `agentCaller.js` | 调用层（整合预检、API 调用、后处理） |
| `timeline.js` | 时间线读写（30秒缓存）和格式化 |
| `conversationHistory.js` | 对话历史管理（路由标记、裁剪、压缩） |
| `prompts/*.js` | 模型层 System Prompt（~150-200 tokens） |

**代码层判断（不调用 API）**：
- `ok/yes/sure` 等确认词 → 直接追问
- 少于 3 个词 → 直接追问
- 超过最大轮次 → 强制放行

**记忆层架构**：
| 层级 | 表 | 触发时机 |
|------|-----|----------|
| 热记忆 | `session_timeline` | 实时写入 |
| 温记忆 | `session_summaries` | End Class 时压缩 |
| 冷记忆 | `student_profiles` | 3 节课后生成 |

**Edge Function**：
- `compress-session`: 课程结束时压缩 timeline → summaries → profiles
- TA Dashboard End Class 按钮自动调用

**文件变更**：
- 新增: `agentGuards.js`, `agentCaller.js`, `timeline.js`, `conversationHistory.js`
- 新增: `prompts/gate1Prompt.js`, `prompts/debugOrchestratorPrompt.js`, `prompts/debugPromptToolPrompt.js`, `prompts/debugCodeToolPrompt.js`
- 新增: `supabase/functions/compress-session/index.ts`
- 新增: `v17-phase-b-schema.sql`
- 修改: `AgentPanel.jsx` (Gate 1 RoundCounter + preCheckInput)
- 修改: `DebugChat.jsx` (RoundCounter + preCheckInput + 路由标记)
- 修改: `AgentBridge.js` (invalidateTimelineCache 同步)
- 修改: `ta-dashboard/Dashboard.jsx` (End Class 调用 compress-session)

### 2026-05-26 DebugChat.jsx 关键问题修复

**问题1：buildStudentContext 未完成迁移**
- ❌ 仍使用旧的 `buildStudentContext()` + `formatContext`
- ✅ 修复：改用 `getTimeline()` + `formatForDebug()`
- 效果：Debug Agent 现在能读取 Gate 1/2 记录，实现跨 Tab 上下文共享

**问题2：forceRelease 路径没有实际放行**
- ❌ 只打 log，仍然调用 API
- ✅ 修复：超过最大轮次时直接返回，设置 `executionPayload`
- 代码：
```javascript
if (preCheck.forceRelease) {
  setExecutionPayload({ type: 'prompt_fix', fixText: textContent });
  return;  // ← 必须 return，不继续调用 API
}
```

**问题3：isFirstAfterRoute 标记未被使用**
- ❌ 路由切换后学生说「ok」仍发给 Tool
- ✅ 修复：在 `preCheckInput` 之前检测确认词并忽略
- 代码：
```javascript
if (isFirstAfterRoute && CONFIRMATION_WORDS.test(textContent.trim())) {
  setInputText('');
  setIsFirstAfterRoute(false);
  return;  // Tool 开场已由 Agent 生成，不需要学生触发
}
```

**文件变更**：
- 修改: `DebugChat.jsx` (+53/-18 行)
  - 移除 `buildStudentContext` 和 `formatContext` 导入
  - 新增 `getSuccessfulUpgradesFromTimeline` 导入
  - 新增 `CONFIRMATION_WORDS` 正则
  - `buildSystemPrompt()` 改用 timeline
  - `handleSend()` 新增 isFirstAfterRoute 检测和 forceRelease 放行

### 2026-05-26 序列化安全 + Prompt Tool fix_quality 时机

**修复1（技术）：updateChatHistory 400 错误**
- ❌ 只过滤 `imagePreview`，其他 blob 字段可能导致序列化失败
- ✅ 修复：过滤更多字段 (`imagePreview`, `imageData`, `blob`, `file`)
- ✅ 新增：JSON.stringify 测试，失败时回退到安全字段
- 代码：
```javascript
const { imagePreview, imageData, blob, file, ...rest } = m;
try {
  JSON.stringify(dbMessages);
} catch (e) {
  // 回退：只保留 role/content/timestamp
  const safeMessages = dbMessages.map(m => ({
    role: m.role,
    content: typeof m.content === 'string' ? m.content : String(m.content || ''),
    timestamp: m.timestamp,
  }));
}
```

**修复2（设计）：Prompt Tool 不应在 Round 1-3 评估 fix_quality**
- ❌ Round 1 就返回 `fix_quality: "vague"`，但学生还在描述 bug，不是写修复指令
- ✅ 修复：Round 1-3 始终返回 `fix_quality: ""` 和 `student_fix: ""`
- ✅ Round 4 才评估修复指令质量

| Round | 任务 | fix_quality |
|-------|------|-------------|
| 1 | 确认 bug 描述 | `""` (始终空) |
| 2 | 问是否在 prompt 描述过 | `""` (始终空) |
| 3 | 问缺了什么描述 | `""` (始终空) |
| 4 | 学生写修复句子 | `precise/specific/vague` |

**System Prompt 新增规则**：
```
FIX_QUALITY RULE (Round 1-3):
- fix_quality only applies in Round 4 when student writes a fix instruction
- In Round 1-3, ALWAYS return fix_quality: "" and student_fix: ""
- DO NOT evaluate student's response as a "fix" — they are describing the bug, not fixing it
```

**文件变更**：
- 修改: `DebugChat.jsx` - updateChatHistory 序列化安全
- 修改: `prompts/debugPromptToolPrompt.js` - fix_quality 只在 Round 4 评估

### 2026-05-26 currentMode 竞态条件修复

**问题**：路由切换后，handleSend() 仍使用旧的 currentMode 构建 System Prompt

**根本原因**：
- `handleRoute()` 调用 `setCurrentMode(newMode)` 是 React 异步状态更新
- `handleSend()` 下次执行时可能还读到旧的 `currentMode` 值
- 导致路由到 Tool 后，第一轮消息仍用 Orchestrator 的 System Prompt

**解决方案**：使用 `useRef` 同步存储 mode
```javascript
// V17 修复：用 ref 同步存储 currentMode，避免 setState 异步竞态
const currentModeRef = useRef('debug_orchestrator');

// handleRoute() 里同步更新 ref + 异步更新 state
currentModeRef.current = newMode;  // 同步（逻辑用）
setCurrentMode(newMode);           // 异步（UI 渲染用）

// handleSend() 里使用 ref
const activeMode = currentModeRef.current;  // 构建 System Prompt
const modeForProcessing = currentModeRef.current;  // 处理响应
```

**修改范围**：
- `handleSend()`: API 调用使用 `activeMode = currentModeRef.current`
- `handleSend()`: 响应处理使用 `modeForProcessing = currentModeRef.current`
- `handleRoute()`: 先更新 ref 再更新 state
- 新增调试日志：`[DebugChat] Calling agent with mode: X round: Y`

**文件变更**：
- 修改: `DebugChat.jsx` (+22/-11 行)

### 2026-05-23 API Key 安全迁移

**DeepSeek API Key 安全架构**：
- ✅ 创建 Supabase Edge Function `deepseek-proxy`
- ✅ API Key 存储在 Supabase Secret（不暴露给前端）
- ✅ Student App 通过 Edge Function 调用 DeepSeek API
- ✅ 从 Vercel 移除 `VITE_DEEPSEEK_API_KEY`

**文件变更**：
- 新增: `supabase/functions/deepseek-proxy/index.ts`
- 修改: `student-app/src/components/AgentPanel.jsx` (使用 Edge Function)

### 2026-05-23 V17 Agent 修复与扩展

**Lesson 1 Bug 修复**：
- ✅ Gate 2 触发条件修复
- ✅ Hard Upgrade bestQuote 传递
- ✅ Hard 模式闪退问题
- ✅ API 错误后对话恢复

**Lesson 2 新功能**：
- ✅ Easy Upgrade fillParam 结构
- ✅ EasyFillCard 组件
- ✅ 无 Gate 1 直接数字输入

**Lesson 1 重设计（基于 Lesson 2 经验）**：
- ✅ 6 个 Easy Upgrade 全部加 fillParam
- ✅ Easy 不触发 Gate 1，直接数字输入
- ✅ EasyFillCard 兼容对象参数格式 `buildPrompt({ key: value })`
- ✅ language_dimensions 清空（Easy 无需追问）

**Medium Upgrade param_coverage 放行逻辑**：
- ✅ System Prompt 使用 param_coverage 追踪意图覆盖
- ✅ all_covered: true 时放行（替代分数阈值）
- ✅ 评分维度改为 intent_clarity / design_reasoning / autonomy
- ✅ 不问数字，问设计意图

**Hard Upgrade Gate 2 匹配验证逻辑**：
- ✅ 问「匹配吗」而非「出现了吗」
- ✅ 引用 bestQuote 进行验证
- ✅ 新增 matched 和 mismatch_detail 字段
- ✅ 不匹配时追问具体差异和语言缺失

**统一课程入口（2026-05-23）**：
- ✅ sessions 表新增 `lesson_type` 字段
- ✅ TA Dashboard 创建 session 时选择课程
- ✅ session 列表显示课程标签 (🎮 Catch / 🧩 Maze)
- ✅ Student App 从 session 的 `lesson_type` 读取课程
- ✅ 不再需要 `?lesson=` URL 参数
- ✅ 学生只需输入 4 位 code，自动加载对应课程

**学生去重修复（2026-05-23）**：
- ✅ 同名学生再次进入显示「Welcome back」确认弹窗
- ✅ 点「Yes, that's me」复用旧记录
- ✅ 点「No, different person」创建新记录（名字加后缀）
- ✅ 清理脚本 `scripts/deduplicate-students.js`

### 2026-05-24 Debug Multi-Agent System 修复

**JSON 解析稳定性修复**：
- ✅ 移除 `response_format: { type: 'json_object' }`（DeepSeek 不支持会返回空响应）
- ✅ 所有 Debug System Prompt 开头添加显式 JSON 指令
- ✅ Edge Function 注入系统级 JSON 约束消息（单独 system message）
- ✅ 多策略 JSON 解析保留：直接解析 → 提取代码块 → 提取{...} → 结构化 fallback

**Edge Function 更新** (`deepseek-proxy/index.ts`):
```javascript
const jsonSystemMessage = {
  role: 'system',
  content: `OUTPUT FORMAT: JSON ONLY.
You are a JSON API. Every response must be a valid JSON object.
Rules:
1. First character must be {
2. Last character must be }
3. No text before or after the JSON
4. No markdown (**bold** or *italic*)
5. No \`\`\`json code blocks
If you output anything other than JSON, the system will crash.`
}
const enhancedMessages = [jsonSystemMessage, ...messages]
```

**406 错误修复**：
- ✅ 移除 `scheduled_end_at` 查询（列不存在导致 Supabase 406 错误）
- ✅ 从 App.jsx 和 AgentBridge.js 中移除所有 `scheduled_end_at` 引用

**Debug Agent fix_quality 评分标准更新** (`buildDebugPromptToolPrompt`):
```
vague (不通过，继续追问):
- 只有名词，没有动词描述动作
  ❌ "the rocks move" → 太模糊
- 动词太模糊 (move/work/fix/appear) 没有具体细节
  ❌ "the rocks move around in the maze" → 追问方向/速度
- 缺少：方向 OR 速度 OR 频率

specific (再问一个问题):
- 有方向但缺速度/频率
  ⚠️ "make the rock move left and right" → 追问速度

precise (通过):
- 有：功能名 + 具体动作 + 至少一个数字/度量
  ✅ "Fix the rock: move left and right every 2 seconds"
```

**Markdown 格式移除**：
- ✅ 所有 Debug Prompt 添加 `FORMATTING: No **bold**, no *italic*, no bullet points`
- ✅ Agent 响应使用纯文本，不含 Markdown 语法

**Debug Tab 改为 Debug Agent**：
- ✅ 移除静态 DebugLog 组件渲染
- ✅ Debug Tab 直接触发 `agentBridge.triggerDebug()`
- ✅ Debug Agent 走完整 Orchestrator → Tool 流程

### 2026-05-24 Medium/Hard Own Idea 功能

**Medium Own Idea (`__own_medium__`)** — 动态 params 生成：
- ✅ `lesson2.js` 新增 `__own_medium__` Upgrade（`dynamicParams: true`）
- ✅ `AgentPanel.jsx` 新增 `buildMediumOwnIdeaSystemPrompt()` 函数
- ✅ Agent 追问学生想法 → 动态生成 params + prompt_template
- ✅ Gate 1 完成后，params 和 template 存储到 `dynamicUpgradeConfig`
- ✅ `Upgrade.jsx` 渲染动态 params 输入框，学生填数字后 Copy

**Medium Own Idea 数据流**：
```
[Start] → AgentPanel (Medium Own Idea System Prompt)
    ↓
DeepSeek 返回: params_so_far + prompt_template_so_far
    ↓
Gate 1 完成 → handleGate1Finish 传递 dynamicParams + promptTemplate
    ↓
App.jsx handleGate1Complete → 存储到 dynamicUpgradeConfig[upgradeId]
    ↓
Upgrade.jsx 读取 dynamicConfig → 渲染动态 params 输入框
    ↓
学生填数字 → buildPrompt(values, template) → [Copy]
```

**Medium Own Idea System Prompt 关键逻辑**：
- Phase 1 (Round 1-2): 理解学生想法
- Phase 2 (Round 2+): 边追问边生成 params（每次一个）
- 每个 param 结构: `{ key, label, min, max, hint, intent }`
- `prompt_template_so_far` 使用 `{key}` 占位符语法
- 最多 4 个 params，Round 3 后无条件结束

**Hard Own Idea (`__own_hard__`)**：
- ✅ `lesson2.js` 新增 `__own_hard__` Upgrade
- ✅ 使用现有 Hard 逻辑：Gate 1 追问 → bestQuote 展示 → 学生写描述 → Copy

**文件变更**：
- 修改: `student-app/src/components/AgentPanel.jsx`
  - 新增 `buildMediumOwnIdeaSystemPrompt()` 函数
  - 新增 `dynamicParams` 和 `promptTemplate` state
  - `sendGate1Message` 跟踪 `params_so_far` 和 `prompt_template_so_far`
  - `handleGate1Finish` 传递动态 params 数据
- 修改: `student-app/src/App.jsx`
  - 新增 `dynamicUpgradeConfig` state
  - `handleGate1Complete` 处理动态 params 存储
- 修改: `student-app/src/components/Upgrade.jsx`
  - 新增 Medium Own Idea 卡片渲染逻辑
  - 动态 params 输入框 + Copy 按钮
- 修改: `student-app/src/lib/lesson2.js`
  - 新增 `__own_medium__` Upgrade 定义
  - 新增 `__own_hard__` Upgrade 定义
- 修改: `supabase/functions/deepseek-proxy/index.ts`
  - 注入系统级 JSON 约束消息

### 2026-05-24 Student Context Layer 架构重构

**设计原则**：
- 所有 Agent 共享统一的 `buildStudentContext()` 函数
- 每个 Agent 按需注入精简 context，减少 token 消耗
- 30秒缓存机制减少 DB 查询
- 事件触发时自动刷新缓存

**核心架构**：
```
┌─────────────────────────────────────────────────────────┐
│                 Student Context Layer                   │
│                                                         │
│  buildStudentContext(studentId, sessionId, currentPrompt)│
│                                                         │
│  ┌─────────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │ agent_sessions  │  │debug_sessions│  │ sessions  │  │
│  │ Gate 1/2 记录   │  │ Debug 记录   │  │ 课程/时间  │  │
│  └─────────────────┘  └──────────────┘  └───────────┘  │
│           ↓                  ↓                ↓         │
│  upgradeSummaries     recentBugs        timeRemaining   │
│  successfulUpgrades   resolvedBugs      lessonType      │
│                                                         │
│  30秒缓存，Gate切换时刷新                                │
└──────────────────────┬──────────────────────────────────┘
                       │ 按需注入
         ┌─────────────┼──────────────┬──────────────┐
         ↓             ↓              ↓              ↓
    Gate 1 Agent  Gate 2 Agent  Debug Agents  Report Agent
```

**新增函数** (`AgentBridge.js`):

1. **`buildStudentContext(studentId, sessionId, currentPrompt)`**
   - 并行读取三张表：`agent_sessions`, `debug_sessions`, `sessions`
   - 返回统一的 context 对象
   - 30秒缓存，`currentPrompt` 不缓存

2. **`invalidateContextCache()`**
   - 手动刷新缓存
   - 在以下时机调用：
     - `handleUpgradeStarted` - 新 Upgrade 开始
     - `onGate1Complete` - Gate 1 完成
     - `onGate2Complete` - Gate 2 完成
     - `updateDebugSession` - Debug 完成

3. **`formatContext`** 工具对象
   - `forGate1(context)` - Gate 1 用
   - `forGate2(context)` - Gate 2 用
   - `forDebugOrchestrator(context)` - Debug 分诊用
   - `forDebugPrompt(context, bugSummary, relatedUpgrade)` - A类修复用
   - `forDebugCode(context, bugSummary)` - B类修复用
   - `forReset(context, bugSummary)` - C类重置用
   - `forReport(context)` - 报告生成用

**Context 对象结构**：
```javascript
{
  // Gate 1/2 用
  upgradeSummaries: [{
    upgradeId, upgradeLabel, difficulty,
    studentSaid,      // Gate 1 最精确的一句话
    appearedInGame,   // Gate 2 结果
    failureType,      // no_prompt | prompt_ignored
    rounds, earlyRelease,
  }],

  // Reset Tool 用
  successfulUpgrades: [{ id, label, studentSaid }],

  // Debug 用
  recentBugs: [...],
  resolvedBugs: number,
  unresolvedBugs: number,

  // Gate 2 用
  timeRemaining: number,
  gate2Mode: 'retry' | 'diagnose',

  // 通用
  lessonType, demoDescription,
  sessionId, studentId,
  currentPrompt,  // 实时状态，不缓存
}
```

**跨阶段数据连接**：
- Debug Prompt Tool Round 2：能引用 Gate 1 的 `best_student_quote`
- Reset Tool Phase 1：展示 `upgrade_appeared=true` 的 Upgrade 列表
- Report Agent：能读到所有 Agent 的输出（Gate 1/2 + Debug）

**性能优化**：
- 同一对话 session 内，连续调用只触发一次 DB 查询
- Gate 完成后第一次调用能读到新数据（缓存已刷新）

**文件变更**：
- 修改: `student-app/src/lib/AgentBridge.js`
  - 新增 `buildStudentContext()` 核心函数
  - 新增 `invalidateContextCache()` 缓存刷新
  - 新增 `formatContext` 工具对象
  - 移除旧的 `buildDebugContext()` 和 `getTimeRemaining()`
  - 所有完成回调添加 `invalidateContextCache()` 调用
  - Debug 函数改用 `buildStudentContext()`

### 2026-05-24 DebugChat 持久对话界面

**架构变更**：Debug 从弹窗 overlay 改为 Tab 内持久界面

**新增数据库字段** (`debug_sessions` 表):
```sql
ALTER TABLE debug_sessions
  ADD COLUMN IF NOT EXISTS conversation_history jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS chat_title text,
  ADD COLUMN IF NOT EXISTS current_mode text DEFAULT 'debug_orchestrator',
  ADD COLUMN IF NOT EXISTS started_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_debug_chat_list
  ON debug_sessions(student_id, started_at DESC);
```

**conversation_history 格式**:
```javascript
[
  { "role": "assistant", "content": "What happened?", "timestamp": "..." },
  { "role": "user", "content": "the rock is blocking", "timestamp": "..." },
  ...
]
```

**UI 结构**:
```
┌────────────────────────────────────────────────────────────┐
│  Debug Tab (持久界面)                                       │
├────────────────┬───────────────────────────────────────────┤
│  ChatSidebar   │  ChatWindow                               │
│  ┌──────────┐  │  ┌─────────────────────────────────────┐  │
│  │ [+New]   │  │  │ Assistant: What happened?          │  │
│  ├──────────┤  │  │ User: the rock is blocking         │  │
│  │ Chat 1 ● │  │  │ Assistant: Did you tell Claude?    │  │
│  │ Chat 2 ○ │  │  │ ...                                │  │
│  │ Chat 3 ○ │  │  ├─────────────────────────────────────┤  │
│  └──────────┘  │  │ ExecutionUI (fix_prompt + buttons) │  │
│                │  ├─────────────────────────────────────┤  │
│                │  │ [Input box] [Send]                  │  │
│                │  └─────────────────────────────────────┘  │
└────────────────┴───────────────────────────────────────────┘
```

**核心组件** (`DebugChat.jsx`):
- `ChatSidebar` - 左侧聊天历史列表
- `ChatWindow` - 右侧对话窗口
- `ExecutionUI` - fix prompt 展示 + Copy/Go Generate 按钮
- `UpgradeSelector` - Reset 模式特性选择

**关键 Props**:
```jsx
<DebugChat
  studentId={studentId}
  sessionId={sessionId}
  currentPrompt={currentPrompt}
  pendingVerification={pendingVerification}
  setPendingVerification={setPendingVerification}
/>
```

**对话流程**:
```
[+New] → 创建 debug_session → 发送首条消息 "What happened?"
                ↓
学生输入 → 调用 DeepSeek → Orchestrator 分诊
                ↓
route:"pending" → 继续追问
route:"prompt_tool" → 切换到 Prompt Tool 模式
route:"code_tool" → 切换到 Code Tool 模式
route:"reset_tool" → 切换到 Reset Tool 模式
route:"no_bug" → 结束对话，显示 "Great! Your game is working!"
                ↓
Tool 完成 → 显示 ExecutionUI (fix_prompt)
                ↓
学生点 [Go Generate] → setPendingVerification → 自动切到 Prompt Tab
```

**对话标题生成**:
- 自动从第一条用户消息截取（最多 30 字符）
- 用于 ChatSidebar 显示

**已解决/未解决状态**:
- `resolved = true` → 对话列表显示 ✓
- `resolved = false` → 显示 ○
- 学生点 [Go Generate] 后设为 resolved

**App.jsx 集成变更**:
- 移除 `handleDebugTabOpen()` 函数
- Debug Tab 渲染 `<DebugChat>` 替代占位符
- `pendingDebugVerification` 重命名为 `pendingVerification`

**文件变更**:
- 新增: `student-app/src/components/DebugChat.jsx` (~700 行)
- 新增: `debug-chat-schema.sql` 数据库迁移脚本
- 修改: `student-app/src/App.jsx`
  - 导入 DebugChat 替代 DebugLog
  - Debug Tab 渲染 DebugChat
  - 移除 handleDebugTabOpen / handleDebugToolComplete
  - pendingDebugVerification → pendingVerification

### 2026-05-24 Hard Upgrade draft_prompt 预填功能

**问题**：学生在 Gate 1 对话中已经说清楚想法，但完成后还要在 textarea 里重新写一遍。

**解决方案**：Gate 1 完成时，Agent 把对话内容整理成 `draft_prompt`，预填到 textarea。

**System Prompt 变更**（Hard 模式）:
```
【放行时生成 draft_prompt — continue:false 时必须执行】

基于整个对话历史，生成一个完整的 Claude 可执行 prompt。

draft_prompt 生成规则：
1. 整合学生在对话中说过的所有精确信息
2. 用第三人称描述（「Add a...」）
3. 包含位置、触发方式、视觉效果、结果（如果对话中提到了）
4. 3-5句话，Claude 看了能直接执行
5. 不添加学生没有提到的内容
```

**Response 格式变更**:
```javascript
{
  "scores": {...},
  "continue": false,
  "response": "Based on our conversation, here's a description you can use:",
  "best_quote": "最精确的一句学生原话",
  "draft_prompt": "完整的3-5句Claude可执行prompt"  // ← 新增
}
```

**数据流**:
```
Gate 1 对话 → Agent 评估 → continue:false
            ↓
  AI 返回 draft_prompt（3-5句完整描述）
            ↓
AgentPanel 存储 → handleGate1Finish(draftPrompt)
            ↓
App.jsx → upgradeDrafts[upgradeId] = draftPrompt
            ↓
Upgrade.jsx → useEffect 预填 hardText
            ↓
Hard 卡片显示预填内容 + "✏️ Based on your conversation — feel free to edit"
            ↓
学生点 Copy → 发给 Claude
```

**UI 变更**:
- bestQuote 区域降低视觉重量（小字、浅色背景）
- textarea 预填 draftPrompt
- 当 textarea 内容 = draftPrompt 时，显示「✏️ Based on your conversation — feel free to edit」

**新增数据库字段**:
```sql
ALTER TABLE agent_sessions
  ADD COLUMN IF NOT EXISTS draft_prompt text;
```

**文件变更**:
- 修改: `student-app/src/components/AgentPanel.jsx`
  - buildUpgradeContext 新增 Hard draft_prompt 规则
  - 新增 draftPrompt state
  - handleGate1Finish 接收并存储 draft_prompt
  - gate1CompletionData 包含 draftPrompt
- 修改: `student-app/src/lib/AgentBridge.js`
  - onGate1Complete 接收并保存 draft_prompt 到数据库
- 修改: `student-app/src/App.jsx`
  - 新增 upgradeDrafts state
  - handleGate1Complete 存储 draftPrompt
  - 传递 upgradeDrafts 给 Upgrade 组件
- 修改: `student-app/src/components/Upgrade.jsx`
  - 导入 useEffect
  - UpgradeCard 接收 draftPrompt prop
  - useEffect 预填 hardText
  - Hard 卡片 UI 优化
- 新增: `hard-upgrade-draft-schema.sql` 数据库迁移脚本

### 2026-05-24 Gate 2 → Debug 直连

**问题**：Gate 2 验证 upgrade 没出现时，Agent 说「感谢反馈」就结束了，学生不知道下一步该做什么。

**解决方案**：当 `upgrade_appeared=false` 时，Gate 2 Agent 无缝切换到 Debug 模式，在同一个 overlay 内继续对话。

**触发条件**：
- Gate 2 验证阶段
- 学生确认 Upgrade 没有出现（或 Hard Upgrade 结果不匹配）
- Agent 返回 `switch_to_debug: true`

**切换流程**：
```
Gate 2: "Did [Timer] appear in your game?"
学生: "No, it didn't"
    ↓
Gate 2 返回 switch_to_debug: true + debug_context
    ↓
1. 创建 debug_sessions 记录（conversation_history 包含 Gate 2 对话）
2. 更新 agent_sessions.gate2_failure_context
3. 切换 activeMode → 'debug_orchestrator'
4. 设置 debugPreKnown（传递失败上下文）
    ↓
Agent: "Okay, Timer didn't appear — is your game still running, or did it crash?"
学生继续回答 → Debug Orchestrator 分诊 → 路由到 Tool
    ↓
Tool 完成 → 显示 fix_prompt + Copy/Go Generate 按钮
```

**System Prompt 变更**（Gate 2 失败处理部分）：
```
### Upgrade Did Not Appear (Failure)
When student confirms upgrade is NOT working:
1. Say "Okay, let's figure out why [X] isn't working"
2. Return switch_to_debug: true with debug_context

### Response Format for Failure → Debug Switch
{
  "response": "Okay, [Upgrade name] didn't appear — is your game still running, or did it crash?",
  "next_action": "switch_to_debug",
  "switch_to_debug": true,
  "debug_context": {
    "failed_upgrade": "[Upgrade label]",
    "failed_upgrade_id": "[Upgrade ID]",
    "student_said": "[What student said about the failure]",
    "failure_type": "not_appeared" | "not_matched"
  }
}
```

**AgentPanel 状态管理**：
```javascript
// Gate 2 → Debug 切换状态
const [activeMode, setActiveMode] = useState(mode);  // 可动态切换
const [activeDebugSessionId, setActiveDebugSessionId] = useState(debugSessionId);
const [debugPreKnown, setDebugPreKnown] = useState(null);
const [activeBugSummary, setActiveBugSummary] = useState(bugSummary);
const [activeRelatedUpgrade, setActiveRelatedUpgrade] = useState(relatedUpgrade);
```

**UI 渲染使用 activeMode**：
- Header 标题、颜色根据 `activeMode` 切换
- Input placeholder、样式根据 `activeMode` 切换
- 完成按钮文字根据 `activeMode` 切换

**Debug Tool 内部路由**：
当 Debug Orchestrator 在 Gate 2 → Debug 场景下路由到 Tool 时：
```javascript
if (mode === 'gate2' && activeMode === 'debug_orchestrator') {
  // 内部切换：更新 activeMode，不打开新 Panel
  setActiveMode('debug_prompt'); // 或 debug_code, debug_reset_phase1
  setCompleted(false);
  // 添加 Tool 初始消息
} else {
  // 正常流程：通过 agentBridge.routeDebug 打开新 Panel
}
```

**数据库变更**：
```sql
ALTER TABLE agent_sessions
  ADD COLUMN IF NOT EXISTS gate2_failure_context jsonb;
```

**Debug Session 关联**：
- `debug_sessions.conversation_history` 包含完整对话（Gate 2 部分 + Debug 部分）
- `debug_sessions.chat_title` 为 "[Upgrade] not working"
- 学生返回 Debug Tab 时可以在 DebugChat 中看到这个对话记录

**文件变更**:
- 修改: `student-app/src/components/AgentPanel.jsx`
  - 新增 Gate 2 → Debug 状态变量（activeMode, activeDebugSessionId 等）
  - Gate 2 System Prompt 新增 switch_to_debug 逻辑
  - sendGate2Message 处理 switch_to_debug 响应
  - sendDebugOrchestratorMessage 处理内部模式切换
  - UI 渲染改用 activeMode 替代 mode
  - Debug Tool 完成按钮使用 activeDebugSessionId || debugSessionId
