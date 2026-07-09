# V17 Agent 系统 — 完整架构重构计划 V2
## Phase A（Lesson 2完成）→ Phase B（时间线架构）

---

## 为什么要重构

### 现有架构的三个根本问题

**问题1：System Prompt是规则列表，不是角色描述**

每次出现新bug就加一条规则。Orchestrator现在已经800+ tokens：
禁止问题列表、Q状态注入、预知信息模式、开场规则、JSON约束、round重置说明……
规则越多，DeepSeek遵守率越低，导致需要再加规则——死循环。

**问题2：状态管理分散在三个地方**

```
React状态：currentMode / toolRound / upgradeQuotes / pendingVerification
Supabase：agent_sessions / debug_sessions（各自独立）
System Prompt：告诉Agent「你现在在哪里」
```

三个地方的状态同步是脆弱的。任何一个出错，Agent就拿到错误信息。

**问题3：跨Tab上下文丢失**

Upgrade Tab的Gate 1对话 和 Debug Tab的Debug对话 互相不知道。
Debug Agent引用Gate 1的best_quote需要特殊设计（buildStudentContext），
但本质上它们是同一个学生同一节课的连续故事。

### 目标架构的三个原则

```
原则1：对话历史承担状态管理
  工具调用结果作为system turn进入对话历史
  Agent从完整对话历史推断状态，不依赖外部变量
  借鉴：ChatGPT Function Calling的turn结构

原则2：单一时间线统一跨Tab上下文
  session_timeline记录所有Tab的所有事件
  任何Agent调用时读时间线，自然知道完整背景
  借鉴：Claude.ai的完整对话历史驱动

原则3：System Prompt只描述角色
  150 tokens，不包含状态管理逻辑
  状态由对话历史的system turns提供
  简单规则（fix_quality评估）由代码执行，不让模型判断
```

---

## Phase A 完成状态检查（重构前提）

**以下功能必须全部验证通过才开始Phase B：**

```
□ Gate 1/2（Lesson 2，param_coverage放行）
□ Debug Orchestrator（四问分类，no_bug路由）
□ Debug Prompt Tool（四轮，student_fix=学生原话）
□ Debug Code Tool（三轮，学生写功能级修复）
□ Debug Reset Tool（Phase 1恢复 + Phase 2认知）
□ DebugChat持久界面（左边列表，切Tab恢复）
□ Gate 2 → Debug直连（失败后同一overlay继续）
□ Hard Upgrade draft_prompt预填
□ JSON parse稳定（四层解析，失败率<1/10轮）
□ Build Tab填空 + Prompt Tab分层显示
□ Medium Own Idea（动态params生成）
□ Hard Own Idea（无hint完全开放）
□ 统一课程入口（4位code识别课程）
□ Student去重（同名确认弹窗）
```

---

## Phase B 架构概览

```
┌─────────────────────────────────────────────────────────┐
│  代码层（确定性）                                        │
│  round计数 / fix_quality评估 / all_covered判断           │
│  不让模型做规则判断                                      │
└──────────────────┬──────────────────────────────────────┘
                   ↓ 工具调用结果写入
┌──────────────────▼──────────────────────────────────────┐
│  对话历史层（借鉴ChatGPT Function Calling）              │
│  工具调用结果作为system turn                             │
│  裁剪策略：当前Tool完整 / 已完成Tool压缩 / resolved Chat摘要│
└──────────────────┬──────────────────────────────────────┘
                   ↓ 格式化注入
┌──────────────────▼──────────────────────────────────────┐
│  时间线层（解决跨Tab问题）                               │
│  session_timeline：所有Tab所有事件                       │
│  formatForAgent()：转成自然语言上下文                    │
└──────────────────┬──────────────────────────────────────┘
                   ↓ 写入/读取
┌──────────────────▼──────────────────────────────────────┐
│  记忆层（借鉴ChatGPT Memory）                           │
│  热：当前session完整时间线                               │
│  温：上1-3节课的session_summaries（课程结束时压缩）      │
│  冷：student_profiles能力画像（多课后生成）              │
└──────────────────┬──────────────────────────────────────┘
                   ↓
┌──────────────────▼──────────────────────────────────────┐
│  模型层（借鉴Claude.ai）                                 │
│  System Prompt：150 tokens，只描述角色                   │
│  模型只做语言生成，不做状态推断                          │
└─────────────────────────────────────────────────────────┘
```

---

## Step 1：新建数据库表

### 1A：session_timeline（核心）

```sql
CREATE TABLE session_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  project_id uuid DEFAULT NULL,        -- 跨课时项目预留
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
CREATE INDEX idx_timeline_project
  ON session_timeline(project_id, created_at)
  WHERE project_id IS NOT NULL;
```

### 1B：session_summaries（温记忆）

```sql
CREATE TABLE session_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id),
  session_id uuid REFERENCES sessions(id),
  created_at timestamptz DEFAULT now(),
  summary_text text,    -- 150 tokens自然语言摘要
  summary_data jsonb    -- 结构化数据供报告使用
);
```

### 1C：student_profiles（冷记忆）

```sql
CREATE TABLE student_profiles (
  student_id uuid PRIMARY KEY REFERENCES students(id),
  updated_at timestamptz DEFAULT now(),
  profile_text text,    -- 100 tokens能力画像
  profile_data jsonb
);
```

---

## Step 2：timeline.js — 时间线写入和读取

**新建文件：`student-app/src/lib/timeline.js`**

### 2A：写入函数

```javascript
import { supabase } from './supabase'

// 统一写入入口
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

// 各事件写入函数
export const writeBuildComplete = (sId, ssId, choices, lessonType) =>
  writeEvent(sId, ssId, {
    type: 'build_complete', lessonType, role: 'system',
    content: `[BUILD] Student designed: ${JSON.stringify(choices)}`,
    metadata: { choices }, isSystemMarker: true,
  })

export const writeGate1Round = (sId, ssId, upgradeId, round, input, scores, lessonType) =>
  writeEvent(sId, ssId, {
    type: 'gate1_round', lessonType, upgradeId, role: 'student',
    content: input, metadata: { round, scores },
  })

export const writeGate1Complete = (sId, ssId, upgradeId, data, lessonType) =>
  writeEvent(sId, ssId, {
    type: 'gate1_complete', lessonType, upgradeId, role: 'system',
    content: `[GATE1-COMPLETE] ${data.upgradeLabel}: student said "${data.bestQuote}"`,
    metadata: {
      best_quote: data.bestQuote,
      actual_rounds: data.actualRounds,
      early_release: data.earlyRelease,
      draft_prompt: data.draftPrompt || null,
    },
    isSystemMarker: true,
  })

export const writeGate2Verify = (sId, ssId, upgradeId, data, lessonType) =>
  writeEvent(sId, ssId, {
    type: 'gate2_verify', lessonType, upgradeId, role: 'system',
    content: `[GATE2] ${data.upgradeLabel}: ${data.appeared ? '✓' : '✗'} appeared`,
    metadata: {
      upgrade_appeared: data.appeared,
      failure_type: data.failureType,
      gate2_mode: data.gate2Mode,
    },
    isSystemMarker: true,
  })

export const writeDebugMessage = (sId, ssId, role, content, debugSessionId, mode, lessonType) =>
  writeEvent(sId, ssId, {
    type: 'debug_message', lessonType, role, content,
    metadata: { debug_session_id: debugSessionId, agent_mode: mode },
    displayInUI: false,
  })

export const writeDebugToolSwitch = (sId, ssId, toMode, bugSummary, lessonType) =>
  writeEvent(sId, ssId, {
    type: 'debug_message', lessonType, role: 'system',
    content: `[ROUTED-TO-${toMode.toUpperCase()}] Bug: "${bugSummary}"`,
    isSystemMarker: true, displayInUI: false,
  })

export const writeDebugComplete = (sId, ssId, bugType, fixText, resolved, lessonType) =>
  writeEvent(sId, ssId, {
    type: 'debug_complete', lessonType, role: 'system',
    content: `[DEBUG-COMPLETE] ${bugType}: ${resolved ? 'resolved' : 'unresolved'}. Fix: "${fixText}"`,
    isSystemMarker: true,
  })
```

### 2B：读取和格式化函数

```javascript
// 读取完整时间线（带30秒缓存）
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

export function invalidateCache() {
  _cache = null; _cacheTime = null; _cacheStudentId = null
}

// Gate 1格式化：只需完成的Upgrade记录
export function formatForGate1(timeline, demoDescription, currentPrompt) {
  const completed = timeline
    .filter(e => e.event_type === 'gate1_complete')
    .map(e => e.content).join('\n')
  return `Demo: ${demoDescription}
Current prompt: ${currentPrompt || 'not yet generated'}
${completed ? `\nCompleted upgrades:\n${completed}` : ''}`.trim()
}

// Gate 2格式化：Gate 1记录 + 时间模式
export function formatForGate2(timeline, gate2Mode, currentPrompt) {
  const gate1 = timeline
    .filter(e => e.event_type === 'gate1_complete')
    .map(e => e.content).join('\n')
  return `Current prompt: ${currentPrompt || 'N/A'}
Time mode: ${gate2Mode}
Gate 1 records:\n${gate1 || 'none'}`.trim()
}

// Debug格式化：完整时间线自然语言叙事
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

// Report格式化：完整结构化数据
export function formatForReport(timeline) {
  return timeline.filter(e => e.is_system_marker).map(e => e.content).join('\n')
}
```

---

## Step 3：对话历史层 — 工具调用结果作为system turn

**新建文件：`student-app/src/lib/conversationHistory.js`**

### 3A：工具调用写入

```javascript
// 三种工具调用，结果作为system turn进入对话历史

// 1. Orchestrator路由完成
export const addRouteMarker = (conversationHistory, route, bugSummary) => [
  ...conversationHistory,
  {
    role: 'system',
    content: `[ROUTED-TO-${route.toUpperCase()}] Bug confirmed: "${bugSummary}". Now help student find root cause.`,
    isToolResult: true,
  }
]

// 2. Gate 2失败切换Debug
export const addGate2DebugSwitch = (conversationHistory, failedUpgrade, studentSaid) => [
  ...conversationHistory,
  {
    role: 'system',
    content: `[SWITCH-TO-DEBUG] ${failedUpgrade} did not appear. Student said: "${studentSaid}". Starting debug classification.`,
    isToolResult: true,
  }
]

// 3. Gate 1 Medium推荐值生成
export const addParamRecommendations = (conversationHistory, recs) => [
  ...conversationHistory,
  {
    role: 'system',
    content: `[PARAM-RECOMMENDATIONS] ${
      Object.entries(recs).map(([k, v]) => `${k}=${v.value} (${v.reason})`).join(', ')
    }`,
    isToolResult: true,
  }
]
```

### 3B：对话历史裁剪

```javascript
// 裁剪策略：当前Tool完整保留 / 已完成Tool压缩 / resolved Chat摘要
export const trimConversationHistory = (history) => {
  // 找到最后一个路由标记的位置
  const lastRouteIdx = history.reduce((acc, turn, i) =>
    turn.content?.includes('[ROUTED-TO-') ? i : acc, -1)

  if (lastRouteIdx === -1) return history // 还在Orchestrator阶段，全部保留

  const beforeRoute = history.slice(0, lastRouteIdx)
  const currentTool = history.slice(lastRouteIdx)

  // 之前的Tool对话：只保留[CHAT-INSIGHT]和[ROUTED-TO-]标记
  const compressed = beforeRoute.filter(t =>
    t.is_system_marker ||
    t.content?.includes('[CHAT-INSIGHT]') ||
    t.content?.includes('[ORCHESTRATOR-SUMMARY]')
  )

  return [...compressed, ...currentTool]
}

// Tool完成时压缩该Tool的追问为summary
export const compressTool = (history, toolType, studentFix) => {
  const lastRouteIdx = history.reduce((acc, t, i) =>
    t.content?.includes('[ROUTED-TO-') ? i : acc, -1)
  const before = lastRouteIdx > 0 ? history.slice(0, lastRouteIdx) : []
  return [
    ...before,
    {
      role: 'system',
      content: `[${toolType.toUpperCase()}-SUMMARY] Student identified fix: "${studentFix}"`,
      isToolResult: true,
    }
  ]
}

// Chat resolved时整个Chat压缩为insight
export const compressChat = (history, bugType, fixText) => [
  {
    role: 'system',
    content: `[CHAT-INSIGHT] ${bugType} bug. Fix: "${fixText}". Resolved.`,
    isToolResult: true,
    displayInUI: false,
  }
]
```

---

## Step 4：替换 AgentBridge.js 的 buildStudentContext()

```javascript
// AgentBridge.js — 替换后的context构建
import { getTimeline, invalidateCache, formatForGate1, formatForGate2, formatForDebug } from './timeline'

// Gate 1触发时
async function handleUpgradeStarted(upgradeId, difficulty) {
  invalidateCache()
  const timeline = await getTimeline(_studentId, _sessionId)
  const contextString = formatForGate1(
    timeline,
    _lesson.agent?.demo_description,
    getCurrentPrompt()
  )
  _onOpenPanel({ mode: 'gate1', contextString, upgrade, ... })
}

// Gate 2触发时
async function handlePromptTabRevisited() {
  const timeline = await getTimeline(_studentId, _sessionId)
  const gate2Mode = computeGate2Mode(timeline)
  const contextString = formatForGate2(timeline, gate2Mode, getCurrentPrompt())
  _onOpenPanel({ mode: 'gate2', contextString, gate2Mode, ... })
}

// Gate 1/2完成时刷新缓存
export async function onGate1Complete(sessionRecordId, data) {
  await supabase.from('agent_sessions').update({...}).eq('id', sessionRecordId)
  invalidateCache()
  // 写入时间线
  await writeGate1Complete(_studentId, _sessionId, data.upgradeId, data, _lesson.id)
}
```

---

## Step 5：简化所有 System Prompt

### Gate 1（800 tokens → 150 tokens）

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

### Debug Orchestrator（800 tokens → 150 tokens）

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

### Debug Prompt Tool（600 tokens → 150 tokens）

```javascript
const buildPromptToolPrompt = (contextString, bugSummary, currentRound) => `
IMPORTANT: Return JSON only. { } No markdown. ONE QUESTION ONLY.

Bug: ${bugSummary}. Help student find why. Never write the fix.
student_fix = student's exact words only. "ok"/"yes" are NOT fix instructions.
Round ${currentRound}: ${
  currentRound <= 2 ? 'Ask if they described this in their prompt.' :
  currentRound === 3 ? 'Ask what specific description was missing.' :
  'Ask student to write one sentence telling Claude what to fix.'
}

Return: {"response":"...","round":${currentRound},"continue":true,"student_fix":"","fix_quality":""}

[Session Context]
${contextString}
`
```

### Debug Code Tool（500 tokens → 100 tokens）

```javascript
const buildCodeToolPrompt = (contextString, bugSummary, currentRound) => `
IMPORTANT: Return JSON only. { } No markdown. ONE QUESTION ONLY.

Bug: ${bugSummary}. Help student describe symptoms precisely.
Round ${currentRound}: ${
  currentRound === 1 ? 'Ask: what exactly happens? (what + when + how)' :
  currentRound === 2 ? 'Ask: how do you trigger this? Every time?' :
  'Ask student to write: Fix [feature]: it should [expected behavior]'
}
Do NOT reference Gate 1 context.

Return: {"response":"...","round":${currentRound},"continue":true,"student_fix":"","fix_quality":""}

[Context]
Current prompt: ${contextString}
`
```

---

## Step 6：删除已被替换的状态变量

**Phase B完成后安全删除：**

```javascript
// App.jsx — 删除
const [upgradeQuotes, setUpgradeQuotes]             // → 时间线里有best_quote
const [upgradeRecs, setUpgradeRecs]                 // → 时间线里有param_recommendations
const [dynamicUpgradeConfig, setDynamicUpgradeConfig] // → 时间线里有

// AgentBridge.js — 删除
buildStudentContext()                               // → 被getTimeline()替换
formatContext.forGate1/Gate2/Debug/...             // → 被timeline.js替换
_contextCache / _contextCacheTime                  // → 被timeline.js缓存替换

// DebugChat.jsx — 删除
const [toolRound, setToolRound]                    // → 从对话历史system turns推断
```

**保留：**
```javascript
const [pendingVerification, setPendingVerification]  // 仍然需要，区分Debug返回和正常Gate 2
const [completedUpgrades, setCompletedUpgrades]      // UI层面仍然需要
const [agentGateActive, setAgentGateActive]          // overlay控制仍然需要
```

---

## Step 7：记忆层（温/冷）

### 7A：课程结束时压缩（温记忆）

**触发：TA点End Class → 自动运行**

```javascript
// ta-dashboard触发 或 session status改为ended时
const compressSessionToSummary = async (studentId, sessionId) => {
  const timeline = await readTimeline(studentId, sessionId)

  const summary = {
    lesson_type: timeline[0]?.lesson_type,
    upgrade_summaries: timeline
      .filter(e => e.event_type === 'gate1_complete')
      .map(e => ({ upgrade: e.upgrade_id, best_quote: e.metadata?.best_quote, rounds: e.metadata?.actual_rounds })),
    debug_insights: timeline
      .filter(e => e.event_type === 'debug_complete')
      .map(e => e.metadata?.fix_text),
    language_metrics: {
      early_releases: timeline.filter(e => e.event_type === 'gate1_complete' && e.metadata?.early_release).length,
      total_upgrades: timeline.filter(e => e.event_type === 'gate1_complete').length,
      debug_sessions: timeline.filter(e => e.event_type === 'debug_complete').length,
    }
  }

  const summaryText = `
[Lesson ${summary.lesson_type} - ${new Date().toLocaleDateString()}]
Upgrades: ${summary.upgrade_summaries.map(u => `${u.upgrade}(${u.rounds}轮): "${u.best_quote}"`).join(' | ')}
Debug: ${summary.debug_insights.join(' | ') || 'none'}
Metrics: ${summary.language_metrics.early_releases}次1轮放行, ${summary.language_metrics.debug_sessions}次debug
  `.trim()

  await supabase.from('session_summaries').insert({
    student_id: studentId, session_id: sessionId,
    summary_text: summaryText, summary_data: summary,
  })
}
```

### 7B：多课后生成能力画像（冷记忆）

**触发：第3节课结束后自动生成**

```javascript
const buildStudentProfile = async (studentId) => {
  const { data: summaries } = await supabase
    .from('session_summaries').select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false }).limit(5)

  if (!summaries || summaries.length < 3) return // 至少3节课才生成

  // 分析模式
  const totalSessions = summaries.length
  const avgEarlyRelease = summaries.reduce((a, s) =>
    a + (s.summary_data?.language_metrics?.early_releases || 0), 0) / totalSessions
  const totalDebug = summaries.reduce((a, s) =>
    a + (s.summary_data?.language_metrics?.debug_sessions || 0), 0)

  const profile = `Student language profile (${totalSessions} lessons):
- Early release rate: ${Math.round(avgEarlyRelease * 10) / 10} per lesson (higher = stronger)
- Debug frequency: ${Math.round(totalDebug / totalSessions * 10) / 10} per lesson
- Lesson history: ${summaries.map(s => s.summary_data?.lesson_type).join(' → ')}`

  await supabase.from('student_profiles').upsert({
    student_id: studentId,
    profile_text: profile,
    updated_at: new Date().toISOString(),
  })
}
```

### 7C：完整context构建（热+温+冷）

```javascript
const buildFullContext = async (studentId, sessionId, agentType, currentPrompt) => {
  // 热记忆：当前session完整时间线
  const timeline = await getTimeline(studentId, sessionId)
  const hot = getFormatFunction(agentType)(timeline, currentPrompt)

  // 温记忆：上几节课摘要（Debug和Report才需要）
  let warm = ''
  if (agentType === 'debug' || agentType === 'report') {
    const { data: summaries } = await supabase
      .from('session_summaries').select('summary_text')
      .eq('student_id', studentId).neq('session_id', sessionId)
      .order('created_at', { ascending: false }).limit(3)
    warm = summaries?.map(s => s.summary_text).join('\n') || ''
  }

  // 冷记忆：能力画像（所有Agent都可以用）
  const { data: profile } = await supabase
    .from('student_profiles').select('profile_text')
    .eq('student_id', studentId).single()
  const cold = profile?.profile_text || ''

  // 组装（热记忆优先，控制总token数）
  const parts = [
    cold ? `[Student Profile]\n${cold}` : '',
    warm ? `[Previous Sessions]\n${warm}` : '',
    `[Current Session]\n${hot}`,
  ].filter(Boolean)

  return parts.join('\n\n')
}
```

---

## 实施顺序和工期

```
Step 1：新建三张表（1天）
  session_timeline / session_summaries / student_profiles
  不改任何现有代码

Step 2：timeline.js写入接入（2天）
  在现有事件触发点加写入调用
  验证：时间线数据正确写入Supabase

Step 3：DebugChat改用时间线（3天）
  最需要跨Tab上下文，优先改
  formatForDebug() + 工具调用system turn
  裁剪策略实施
  Debug System Prompt简化到150 tokens
  验证：Debug能引用Gate 1内容，JSON失败率降低

Step 4：Gate 1/2改用时间线（2天）
  AgentBridge.js替换buildStudentContext()
  Gate 1/2 System Prompt简化
  验证：Gate 2能读Gate 1 best_quote

Step 5：清理状态变量（1天）
  删除upgradeQuotes/upgradeRecs等
  验证：功能不变

Step 6：Report接入（1天）
  reportPrompt.js用formatForReport()
  验证：报告包含完整学习历史

Step 7：记忆层（2天）
  课程结束压缩触发
  能力画像生成（3节课后）

总工期：12天
```

---

## 新课程接入（重构后）

**接入Lesson 5只需要写一个文件：**

```javascript
// lesson5.js
export const LESSON_5 = {
  id: 'platformer-v1',
  agent: { demo_description: '三层平台跳跃游戏，向右走，无敌人' },
  upgrades: [
    {
      id: 'double-jump',
      agent_context: '按两次跳跃键，空中再跳一次',
      language_dimensions: [DIMENSION_LIBRARY.trigger, DIMENSION_LIBRARY.result],
    },
  ],
  buildPrompt: (choices, ownInputs, gameName) => `...`,
}
```

**AgentBridge、DebugChat、所有Agent System Prompt、session_timeline——全部零改动。**

---

## 验证检查点

### 功能不变验证
- [ ] Gate 1放行条件正确（param_coverage / language_dimensions）
- [ ] Gate 2验证流程正常，失败后直连Debug
- [ ] Debug三工具正常，student_fix=学生原话
- [ ] DebugChat切Tab后对话恢复
- [ ] Build填空 + Prompt分层显示

### 架构改进验证
- [ ] Debug Agent第一轮能引用Gate 1 best_quote（不需要特殊设计）
- [ ] System Prompt总长度 < 200 tokens（每个Agent）
- [ ] JSON parse失败率 < 1/10轮对话
- [ ] 对话历史在trim后 < 600 tokens

### 新课程接入验证
- [ ] 新建lesson5.js，不改任何Agent代码
- [ ] Lesson 5 Gate 1/Debug正常工作
- [ ] session_timeline lesson_type字段正确写入
