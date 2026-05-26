# V17 Agent 架构重构 Phase B 实施计划

## 核心设计原则

### 边界原则（一句话）

```
需要读懂意思 → 模型
不需要读懂意思 → 代码
```

### 完整分工表

| 判断 | 输入 | 负责方 | 原因 |
|------|------|--------|------|
| round 计数 | 事件计数 | **代码** | 无语义，纯计数 |
| 「ok/yes」不是修复指令 | 单词匹配 | **代码** | 确定性规则 |
| 少于 3 个词不是有效回答 | 长度 | **代码** | 确定性规则 |
| 超过 N 轮强制放行 | 计数 | **代码** | 兜底规则 |
| fix_quality specific/precise | 自然语言 | **模型** | 需要语义理解 |
| all_covered true/false | 自然语言 | **模型** | 维度覆盖是语义判断 |
| bug 分类 A/B/C | 自然语言 | **模型** | 需要理解症状 |
| 归因质量 完整/部分/无 | 自然语言 | **模型** | 需要理解因果描述 |
| 「very fast」算不算量化 | 自然语言 | **模型** | 语境依赖的语义判断 |

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│  代码层（确定性）— agentGuards.js                           │
│  round计数 / 明显无效检测 / 最大轮次兜底                     │
│  不让代码做语义判断，不让模型做计数                          │
└──────────────────┬──────────────────────────────────────────┘
                   ↓ preCheckInput() 过滤
┌──────────────────▼──────────────────────────────────────────┐
│  调用层 — agentCaller.js                                    │
│  代码层先过滤，通过后才调用模型                              │
│  模型返回后，代码层后处理（最大轮次兜底）                    │
└──────────────────┬──────────────────────────────────────────┘
                   ↓ callDeepSeek()
┌──────────────────▼──────────────────────────────────────────┐
│  模型层 — prompts/*.js                                      │
│  System Prompt 极简（~150 tokens）                          │
│  模型负责：all_covered / fix_quality / bug分类 / 归因       │
└──────────────────┬──────────────────────────────────────────┘
                   ↓ 写入/读取
┌──────────────────▼──────────────────────────────────────────┐
│  时间线层 — timeline.js                                     │
│  session_timeline：所有 Tab 所有事件                        │
│  formatForAgent()：转成自然语言上下文                       │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌──────────────────▼──────────────────────────────────────────┐
│  记忆层                                                     │
│  热：当前 session 完整时间线                                │
│  温：上 1-3 节课的 session_summaries                        │
│  冷：student_profiles 能力画像                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 调用流程图

```
学生输入
    ↓
preCheckInput()（代码层）
    ↓
┌───────────────┬──────────────────────┐
│ 明显无效       │ 通过                  │
│ （ok/yes/空）  │                      │
↓               ↓                      │
直接追问         callDeepSeek()         │
不消耗 API       模型判断语义           │
                ↓                      │
           parseAgentResponse()        │
                ↓                      │
           checkMaxRounds()（代码层）   │
                ↓                      │
           如果超限：强制 continue:false │
                ↓                      ↓
           返回给 UI 渲染 ←────────────┘
```

---

## 实施步骤

### Step 1: 新建数据库表（1天）

**文件**: Supabase SQL Editor

```sql
-- 1. session_timeline（核心热记忆）
CREATE TABLE session_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  project_id uuid DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  event_type text NOT NULL,
  upgrade_id text,
  lesson_type text,
  role text,
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

-- 2. session_summaries（温记忆）
CREATE TABLE session_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id),
  session_id uuid REFERENCES sessions(id),
  created_at timestamptz DEFAULT now(),
  summary_text text,
  summary_data jsonb
);

-- 3. student_profiles（冷记忆）
CREATE TABLE student_profiles (
  student_id uuid PRIMARY KEY REFERENCES students(id),
  updated_at timestamptz DEFAULT now(),
  profile_text text,
  profile_data jsonb
);
```

---

### Step 2: agentGuards.js — 代码层（1天）

**新建文件**: `student-app/src/lib/agentGuards.js`

```javascript
/**
 * Agent Guards — 代码层判断
 * 所有判断：不需要读懂意思，只需要结构化规则
 */

// ─── 1. round 计数 ───────────────────────────────────────────
export class RoundCounter {
  constructor() { this.round = 1 }
  increment() { this.round += 1 }
  reset() { this.round = 1 }
  get() { return this.round }
}

// ─── 2. 明显无效输入检测 ──────────────────────────────────────
const CONFIRMATION_WORDS = /^(ok|okay|yes|no|sure|good|great|yeah|yep|got\s*it|fine|alright)\.?$/i
const MIN_WORD_COUNT = 3

export const checkObviouslyInvalid = (text) => {
  const trimmed = text?.trim() || ''
  if (!trimmed) return { invalid: true, reason: 'empty' }
  if (CONFIRMATION_WORDS.test(trimmed)) return { invalid: true, reason: 'confirmation' }
  if (trimmed.split(/\s+/).length < MIN_WORD_COUNT) return { invalid: true, reason: 'too_short' }
  return { invalid: false }
}

export const INVALID_RESPONSE_TEMPLATES = {
  empty: 'Please describe what\'s happening in your game.',
  confirmation: 'Can you describe it in a full sentence? For example: "Fix the [feature]: it should [behavior]"',
  too_short: 'Can you say more? Describe what the feature should do.',
}

// ─── 3. 最大轮次兜底 ──────────────────────────────────────────
const MAX_ROUNDS = {
  gate1_easy: 1,
  gate1_medium: 3,
  gate1_hard: 4,
  debug_orchestrator: 5,
  debug_prompt: 5,
  debug_code: 4,
  debug_reset: 3,
}

export const checkMaxRounds = (mode, currentRound) => {
  const max = MAX_ROUNDS[mode] || 5
  if (currentRound > max) return { exceeded: true }
  return { exceeded: false }
}

// ─── 4. 统一预检入口 ──────────────────────────────────────────
export const preCheckInput = (text, mode, currentRound) => {
  const invalidCheck = checkObviouslyInvalid(text)
  if (invalidCheck.invalid) {
    return {
      shouldCallModel: false,
      directResponse: INVALID_RESPONSE_TEMPLATES[invalidCheck.reason],
      reason: invalidCheck.reason,
    }
  }
  const roundCheck = checkMaxRounds(mode, currentRound)
  if (roundCheck.exceeded) {
    return { shouldCallModel: false, forceRelease: true, reason: 'max_rounds_exceeded' }
  }
  return { shouldCallModel: true }
}
```

---

### Step 3: agentCaller.js — 调用层（1天）

**新建文件**: `student-app/src/lib/agentCaller.js`

```javascript
import { preCheckInput, checkMaxRounds } from './agentGuards'
import { callDeepSeek } from './deepseek'
import { parseAgentResponse } from './parseAgentResponse'
import { trimConversationHistory } from './conversationHistory'

export const callAgent = async ({ mode, userInput, currentRound, systemPrompt, conversationHistory }) => {
  // Step 1: 代码层预检
  const preCheck = preCheckInput(userInput, mode, currentRound)
  if (!preCheck.shouldCallModel) {
    if (preCheck.forceRelease) {
      return { response: 'Let\'s move on.', continue: false, forceReleased: true }
    }
    return { response: preCheck.directResponse, continue: true, skippedModel: true }
  }

  // Step 2: 裁剪对话历史
  const trimmedHistory = trimConversationHistory(conversationHistory)

  // Step 3: 调用模型
  const rawResponse = await callDeepSeek({
    systemPrompt,
    messages: [
      ...trimmedHistory,
      { role: 'user', content: userInput },
      { role: 'user', content: '__FORMAT__: Return JSON only. { } No other text.' }
    ],
    maxTokens: 500,
  })

  // Step 4: 解析响应
  const parsed = parseAgentResponse(rawResponse, currentRound)

  // Step 5: 代码层后处理（最大轮次兜底）
  const { exceeded } = checkMaxRounds(mode, currentRound)
  if (exceeded && parsed.continue) {
    parsed.continue = false
    parsed.forceReleased = true
  }

  return parsed
}
```

---

### Step 4: prompts/*.js — 模型层 System Prompt（2天）

**新建目录**: `student-app/src/lib/prompts/`

#### gate1Prompt.js (~150 tokens)

```javascript
export const buildGate1Prompt = (contextString, upgrade, currentRound, maxRounds) => `
IMPORTANT: Return JSON only. Start { end }. No markdown. ONE QUESTION ONLY.

You are a design coach. Help student articulate their game idea precisely.
Never write the prompt for them.

Upgrade: ${upgrade.title}
Context: ${upgrade.agent_context}
Dimensions: ${upgrade.language_dimensions?.join(' | ') || 'none'}
Round: ${currentRound} of ${maxRounds}
${currentRound >= maxRounds ? 'FINAL ROUND: set continue:false regardless.' : ''}

YOUR JUDGMENT:
- all_covered: true when student expressed intent for ALL dimensions
- If student expressed core idea well → all_covered:true, continue:false

Return:
{"response":"...","continue":true,"all_covered":false,"best_quote":"","draft_prompt":""}

[Context]
${contextString}
`
```

#### debugOrchestratorPrompt.js (~200 tokens)

```javascript
export const buildOrchestratorPrompt = (contextString, currentRound) => `
IMPORTANT: Return JSON only. Start { end }. No markdown. ONE QUESTION ONLY.

Classify bug using Q1→Q2→Q3→Q4.
Step 0: confirm this is actually a bug.

Q1: running? → crashed = reset_tool
Q2: one or multiple? → multiple = reset_tool
Q3: missing or wrong? → missing = prompt_tool
Q4: opposite or detail? → opposite = prompt_tool, detail = code_tool
Not a bug → no_bug

Round ${currentRound} of 5.
${currentRound >= 5 ? 'FINAL: must route now.' : ''}

Return:
{"response":"...","route":"pending|prompt_tool|code_tool|reset_tool|no_bug",
 "q_asked":"Q1|Q2|Q3|Q4|S0|done","bug_summary":"","related_upgrade":null}

[Context]
${contextString}
`
```

#### debugPromptToolPrompt.js (~200 tokens)

```javascript
export const buildPromptToolPrompt = (contextString, bugSummary, currentRound, maxRounds) => `
IMPORTANT: Return JSON only. Start { end }. No markdown. ONE QUESTION ONLY.

Bug: "${bugSummary}"
Round: ${currentRound} of ${maxRounds}
${currentRound >= maxRounds ? 'FINAL: accept answer, set continue:false.' : ''}

Round guide:
2: Ask if described in prompt
3: Ask what description was missing
4: Ask student to write fix sentence
4+: Evaluate student's fix

YOUR JUDGMENT on fix_quality:
- precise: feature + specific behavior + detail (e.g. "patrol left and right every 2 seconds")
- specific: feature + behavior, missing details
- vague: unclear what should happen

Return:
{"response":"...","round":${currentRound},"continue":true,"student_fix":"","fix_quality":""}

[Context]
${contextString}
`
```

#### debugCodeToolPrompt.js (~150 tokens)

```javascript
export const buildCodeToolPrompt = (contextString, bugSummary, currentRound, maxRounds) => `
IMPORTANT: Return JSON only. Start { end }. No markdown. ONE QUESTION ONLY.

Bug: "${bugSummary}"
Round: ${currentRound} of ${maxRounds}
${currentRound >= maxRounds ? 'FINAL: accept answer, set continue:false.' : ''}

Round guide:
1: What exactly happens? (what + when + how)
2: How do you trigger it? Every time?
3: Student writes: "Fix [feature]: it should [expected] instead of [current]"

Do NOT reference Gate 1 context.

Return:
{"response":"...","round":${currentRound},"continue":true,"student_fix":"","fix_quality":""}

[Context]
${contextString}
`
```

---

### Step 5: timeline.js — 时间线层（2天）

**新建文件**: `student-app/src/lib/timeline.js`

```javascript
import { supabase } from './supabase'

// =====================================================
// 写入函数
// =====================================================

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

// Build Tab 完成
export const writeBuildComplete = (sId, ssId, choices, lessonType) =>
  writeEvent(sId, ssId, {
    type: 'build_complete', lessonType, role: 'system',
    content: `[BUILD] Student designed: ${JSON.stringify(choices)}`,
    metadata: { choices }, isSystemMarker: true,
  })

// Prompt 生成
export const writePromptGenerated = (sId, ssId, prompt, lessonType) =>
  writeEvent(sId, ssId, {
    type: 'prompt_generated', lessonType, role: 'system',
    content: `[PROMPT] Generated: ${prompt.slice(0, 100)}...`,
    metadata: { prompt }, isSystemMarker: true,
  })

// Prompt 复制
export const writePromptCopied = (sId, ssId, lessonType) =>
  writeEvent(sId, ssId, {
    type: 'prompt_copied', lessonType, role: 'system',
    content: '[COPIED] Student copied prompt to Claude',
    isSystemMarker: true,
  })

// Gate 1 每轮对话
export const writeGate1Round = (sId, ssId, upgradeId, round, input, scores, lessonType) =>
  writeEvent(sId, ssId, {
    type: 'gate1_round', lessonType, upgradeId, role: 'student',
    content: input,
    metadata: { round, scores },
  })

// Gate 1 完成
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

// Gate 2 验证
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

// Debug 消息（每轮对话）
export const writeDebugMessage = (sId, ssId, role, content, debugSessionId, mode, lessonType) =>
  writeEvent(sId, ssId, {
    type: 'debug_message', lessonType, role, content,
    metadata: { debug_session_id: debugSessionId, agent_mode: mode },
    displayInUI: false,
  })

// Debug 工具切换
export const writeDebugToolSwitch = (sId, ssId, toMode, bugSummary, lessonType) =>
  writeEvent(sId, ssId, {
    type: 'debug_message', lessonType, role: 'system',
    content: `[ROUTED-TO-${toMode.toUpperCase()}] Bug: "${bugSummary}"`,
    isSystemMarker: true, displayInUI: false,
  })

// Debug 完成
export const writeDebugComplete = (sId, ssId, bugType, fixText, resolved, lessonType) =>
  writeEvent(sId, ssId, {
    type: 'debug_complete', lessonType, role: 'system',
    content: `[DEBUG-COMPLETE] ${bugType}: ${resolved ? 'resolved' : 'unresolved'}. Fix: "${fixText}"`,
    isSystemMarker: true,
  })

// 游戏重新生成
export const writeGameRegenerated = (sId, ssId, lessonType) =>
  writeEvent(sId, ssId, {
    type: 'game_regenerated', lessonType, role: 'system',
    content: '[REGENERATED] Student regenerated game with updated prompt',
    isSystemMarker: true,
  })

// =====================================================
// 读取函数（带30秒缓存）
// =====================================================

let _cache = null
let _cacheTime = null
let _cacheStudentId = null
const CACHE_TTL = 30000

export async function getTimeline(studentId, sessionId) {
  const now = Date.now()
  if (_cache && _cacheStudentId === studentId && now - _cacheTime < CACHE_TTL) {
    return _cache
  }
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
  _cache = null
  _cacheTime = null
  _cacheStudentId = null
}

// =====================================================
// 格式化函数
// =====================================================

// Gate 1 格式化：只需完成的 Upgrade 记录
export function formatForGate1(timeline, demoDescription, currentPrompt) {
  const completed = timeline
    .filter(e => e.event_type === 'gate1_complete')
    .map(e => e.content)
    .join('\n')
  return `Demo: ${demoDescription}
Current prompt: ${currentPrompt || 'not yet generated'}
${completed ? `\nCompleted upgrades:\n${completed}` : ''}`.trim()
}

// Gate 2 格式化：Gate 1 记录 + 时间模式
export function formatForGate2(timeline, gate2Mode, currentPrompt) {
  const gate1 = timeline
    .filter(e => e.event_type === 'gate1_complete')
    .map(e => e.content)
    .join('\n')
  return `Current prompt: ${currentPrompt || 'N/A'}
Time mode: ${gate2Mode}
Gate 1 records:
${gate1 || 'none'}`.trim()
}

// Debug 格式化：完整时间线自然语言叙事
export function formatForDebug(timeline, currentPrompt) {
  const lines = timeline.map(e => {
    if (e.is_system_marker) return e.content
    if (e.role === 'student') return `Student: ${e.content}`
    if (e.role === 'agent') return `Agent: ${e.content}`
    return null
  }).filter(Boolean)
  return `Current prompt: ${currentPrompt || 'N/A'}
Session history:
${lines.join('\n') || 'No history yet'}`.trim()
}

// Report 格式化：完整结构化数据
export function formatForReport(timeline) {
  return timeline
    .filter(e => e.is_system_marker)
    .map(e => e.content)
    .join('\n')
}
```

---

### Step 6: conversationHistory.js — 对话历史管理（1天）

**新建文件**: `student-app/src/lib/conversationHistory.js`

**触发时机**:
- `addRouteMarker()` → `handleRoute()` 里，`setCurrentMode()` 之前
- `trimConversationHistory()` → `callAgent()` 里，messages 构建时
- `compressTool()` → `handleToolComplete()` 里，学生点 Go Generate 时
- `compressChat()` → `handleResolvedConfirm()` 里，学生说修好了时

```javascript
// =====================================================
// 工具调用结果写入（作为 system turn）
// =====================================================

// 1. Orchestrator 路由完成 — 在 handleRoute() 里调用
export const addRouteMarker = (conversationHistory, route, bugSummary) => [
  ...conversationHistory,
  {
    role: 'system',
    content: `[ROUTED-TO-${route.toUpperCase()}] Bug confirmed: "${bugSummary}". Now help student find root cause.`,
    isToolResult: true,
  }
]

// 2. Gate 2 失败切换 Debug
export const addGate2DebugSwitch = (conversationHistory, failedUpgrade, studentSaid) => [
  ...conversationHistory,
  {
    role: 'system',
    content: `[SWITCH-TO-DEBUG] ${failedUpgrade} did not appear. Student said: "${studentSaid}". Starting debug classification.`,
    isToolResult: true,
  }
]

// 3. Gate 1 Medium 推荐值生成
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

// =====================================================
// 对话历史裁剪 — 在 callAgent() 里调用
// =====================================================

export const trimConversationHistory = (history) => {
  // 找到最后一个路由标记的位置
  const lastRouteIdx = history.reduce((acc, turn, i) =>
    turn.content?.includes('[ROUTED-TO-') ? i : acc, -1)

  if (lastRouteIdx === -1) return history // 还在 Orchestrator 阶段，全部保留

  const beforeRoute = history.slice(0, lastRouteIdx)
  const currentTool = history.slice(lastRouteIdx)

  // 之前的 Tool 对话：只保留标记
  const compressed = beforeRoute.filter(t =>
    t.isToolResult ||
    t.content?.includes('[CHAT-INSIGHT]') ||
    t.content?.includes('[ORCHESTRATOR-SUMMARY]')
  )

  return [...compressed, ...currentTool]
}

// =====================================================
// Tool/Chat 完成时压缩
// =====================================================

// Tool 完成时压缩 — 在 handleToolComplete() 里调用（学生点 Go Generate）
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

// Chat resolved 时压缩 — 在 handleResolvedConfirm() 里调用（学生说修好了）
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

### Step 7: 修改 DebugChat.jsx（2天）

**改动**:

```javascript
// 修改前
const response = await callDebugAgent(currentMode, messages, context)

// 修改后
import { callAgent } from '../lib/agentCaller'
import { RoundCounter } from '../lib/agentGuards'
import { addRouteMarker, compressTool, compressChat } from '../lib/conversationHistory'
import { writeDebugToolSwitch, writeDebugComplete } from '../lib/timeline'

const roundCounter = useRef(new RoundCounter())

// handleSend()
const response = await callAgent({
  mode: currentMode,
  userInput: inputText,
  currentRound: roundCounter.current.get(),
  systemPrompt: buildSystemPrompt(currentMode, contextString),
  conversationHistory: messages,
})

if (response.continue) {
  roundCounter.current.increment()
} else {
  roundCounter.current.reset()
}

// handleRoute() — 路由切换时
const handleRoute = async (route, bugSummary) => {
  // 1. 写入时间线
  await writeDebugToolSwitch(studentId, sessionId, route, bugSummary, lessonType)
  // 2. 添加路由标记到对话历史
  setMessages(prev => addRouteMarker(prev, route, bugSummary))
  // 3. 重置 round
  roundCounter.current.reset()
  // 4. 切换模式
  setCurrentMode(route)
}

// handleToolComplete() — 学生点 Go Generate 时
const handleToolComplete = (toolType, studentFix) => {
  setMessages(prev => compressTool(prev, toolType, studentFix))
}

// handleResolvedConfirm() — 学生确认修好时
const handleResolvedConfirm = async (bugType, fixText) => {
  await writeDebugComplete(studentId, sessionId, bugType, fixText, true, lessonType)
  setMessages(prev => compressChat(prev, bugType, fixText))
}
```

---

### Step 8: 修改 AgentPanel.jsx — Gate 1（2天）

**改动**:

```javascript
import { callAgent } from '../lib/agentCaller'
import { RoundCounter } from '../lib/agentGuards'
import { buildGate1Prompt } from '../lib/prompts/gate1Prompt'
import { writeGate1Round, writeGate1Complete } from '../lib/timeline'

const gateRoundCounter = useRef(new RoundCounter())

// handleGate1Send()
const handleGate1Send = async (studentInput) => {
  const currentRound = gateRoundCounter.current.get()
  const maxRounds = MAX_ROUNDS[`gate1_${upgrade.level}`]

  const response = await callAgent({
    mode: `gate1_${upgrade.level}`,
    userInput: studentInput,
    currentRound,
    systemPrompt: buildGate1Prompt(contextString, upgrade, currentRound, maxRounds),
    conversationHistory: currentConversation,
  })

  // 写入时间线
  await writeGate1Round(studentId, sessionId, upgrade.id, currentRound, studentInput, response.scores, lessonType)

  // 更新 round（代码负责）
  if (response.continue) {
    gateRoundCounter.current.increment()
  }

  // 放行判断：模型说不继续，或代码强制放行
  if (!response.continue || response.forceReleased) {
    await handleGate1Complete(response)
  }
}

// handleGate1Complete()
const handleGate1Complete = async (response) => {
  await writeGate1Complete(studentId, sessionId, upgrade.id, {
    upgradeLabel: upgrade.title,
    bestQuote: response.best_quote,
    actualRounds: gateRoundCounter.current.get(),
    earlyRelease: response.early_release || false,
    draftPrompt: response.draft_prompt,
  }, lessonType)

  gateRoundCounter.current.reset()
  // ... 关闭 overlay 等
}
```

---

### Step 9: 替换 AgentBridge.js（1天）

**改动**:

```javascript
import { getTimeline, invalidateCache, formatForGate1, formatForGate2, formatForDebug } from './timeline'

// handleUpgradeStarted() 修改后
async function handleUpgradeStarted(upgradeId, difficulty) {
  invalidateCache()
  const timeline = await getTimeline(_studentId, _sessionId)
  const contextString = formatForGate1(
    timeline,
    _lesson.agent?.demo_description,
    getCurrentPrompt()
  )
  _onOpenPanel({
    mode: 'gate1',
    contextString,  // ← 新增：传给 AgentPanel
    upgrade,
    sessionRecordId: record.id,
  })
}

// handlePromptTabRevisited() 修改后
async function handlePromptTabRevisited() {
  const timeline = await getTimeline(_studentId, _sessionId)
  const gate2Mode = computeGate2Mode(timeline)
  const contextString = formatForGate2(timeline, gate2Mode, getCurrentPrompt())
  _onOpenPanel({
    mode: 'gate2',
    contextString,  // ← 新增
    agenda,
    gate2Mode,
  })
}

// triggerDebug() 修改后
export async function triggerDebug() {
  if (!_studentId || !_onOpenPanel) return
  const timeline = await getTimeline(_studentId, _sessionId)
  const contextString = formatForDebug(timeline, getCurrentPrompt())
  _onOpenPanel({
    mode: 'debug_orchestrator',
    contextString,  // ← 新增
  })
}

// 删除以下旧代码
// - buildStudentContext()
// - formatContext 对象
// - _contextCache / _contextCacheTime / _contextCacheStudentId
```

---

### Step 10: 清理旧代码（1天）

**删除**:

```javascript
// AgentPanel.jsx — 删除（代码做语义判断，不对）
const hasQuantifier = /every \d+|\d+ second|\d+ time/i.test(text)

// AgentPanel.jsx — 删除（用 continue 不用 fix_quality）
if (apiResponse.fix_quality === 'precise') handleRelease()
// 替换为：if (!apiResponse.continue) handleRelease()

// App.jsx — 删除（时间线里有）
const [upgradeQuotes, setUpgradeQuotes]
const [upgradeRecs, setUpgradeRecs]
const [dynamicUpgradeConfig, setDynamicUpgradeConfig]

// AgentBridge.js — 删除（被 timeline.js 替换）
buildStudentContext()
formatContext.forGate1/Gate2/Debug/Report
_contextCache / _contextCacheTime / _contextCacheStudentId

// DebugChat.jsx — 删除（迁移到 RoundCounter）
const [toolRound, setToolRound] = useState(1)
```

---

### Step 11: 记忆层（2天）

#### 11A: 温记忆 — 课程结束时压缩

**触发**: ta-dashboard 的 End Class 按钮 → 调用 Supabase Edge Function

**新建文件**: `supabase/functions/compress-session/index.ts`

```typescript
import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) => {
  const { studentId, sessionId } = await req.json()
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 1. 读取时间线
  const { data: timeline } = await supabase
    .from('session_timeline')
    .select('*')
    .eq('student_id', studentId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (!timeline?.length) return new Response('No timeline', { status: 400 })

  // 2. 构建摘要
  const upgrades = timeline.filter(e => e.event_type === 'gate1_complete')
  const debugs = timeline.filter(e => e.event_type === 'debug_complete')
  const earlyReleases = upgrades.filter(e => e.metadata?.early_release).length

  const summaryData = {
    lesson_type: timeline[0]?.lesson_type,
    upgrade_summaries: upgrades.map(e => ({
      upgrade: e.upgrade_id,
      best_quote: e.metadata?.best_quote,
      rounds: e.metadata?.actual_rounds,
    })),
    debug_insights: debugs.map(e => e.content),
    metrics: {
      early_releases: earlyReleases,
      total_upgrades: upgrades.length,
      debug_sessions: debugs.length,
    },
  }

  const summaryText = `
[Lesson ${summaryData.lesson_type} - ${new Date().toLocaleDateString()}]
Upgrades: ${summaryData.upgrade_summaries.map(u => `${u.upgrade}(${u.rounds}轮): "${u.best_quote}"`).join(' | ')}
Debug: ${summaryData.debug_insights.join(' | ') || 'none'}
Metrics: ${summaryData.metrics.early_releases}次1轮放行, ${summaryData.metrics.debug_sessions}次debug
  `.trim()

  // 3. 写入 session_summaries
  await supabase.from('session_summaries').insert({
    student_id: studentId,
    session_id: sessionId,
    summary_text: summaryText,
    summary_data: summaryData,
  })

  // 4. 检查是否需要生成 profile
  const { count } = await supabase
    .from('session_summaries')
    .select('id', { count: 'exact', head: true })
    .eq('student_id', studentId)

  if (count >= 3) {
    // 触发 buildStudentProfile
    await buildStudentProfile(supabase, studentId)
  }

  return new Response('OK')
})

async function buildStudentProfile(supabase, studentId) {
  const { data: summaries } = await supabase
    .from('session_summaries')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(5)

  if (!summaries?.length) return

  const totalSessions = summaries.length
  const avgEarlyRelease = summaries.reduce((a, s) =>
    a + (s.summary_data?.metrics?.early_releases || 0), 0) / totalSessions
  const totalDebug = summaries.reduce((a, s) =>
    a + (s.summary_data?.metrics?.debug_sessions || 0), 0)

  const profileText = `Student language profile (${totalSessions} lessons):
- Early release rate: ${Math.round(avgEarlyRelease * 10) / 10} per lesson (higher = stronger)
- Debug frequency: ${Math.round(totalDebug / totalSessions * 10) / 10} per lesson
- Lesson history: ${summaries.map(s => s.summary_data?.lesson_type).join(' → ')}`

  await supabase.from('student_profiles').upsert({
    student_id: studentId,
    profile_text: profileText,
    updated_at: new Date().toISOString(),
  })
}
```

**ta-dashboard 调用**:

```javascript
// ta-dashboard/src/components/EndClassButton.jsx
const handleEndClass = async () => {
  // 对每个学生调用压缩
  for (const student of students) {
    await supabase.functions.invoke('compress-session', {
      body: { studentId: student.id, sessionId: currentSessionId }
    })
  }
}
```

---

## 关键文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| SQL (Supabase) | 新建 | 三张表 |
| `agentGuards.js` | **新建** | 代码层 |
| `agentCaller.js` | **新建** | 调用层 |
| `prompts/gate1Prompt.js` | **新建** | ~150 tokens |
| `prompts/debugOrchestratorPrompt.js` | **新建** | ~200 tokens |
| `prompts/debugPromptToolPrompt.js` | **新建** | ~200 tokens |
| `prompts/debugCodeToolPrompt.js` | **新建** | ~150 tokens |
| `timeline.js` | **新建** | 写入/读取/格式化 |
| `conversationHistory.js` | **新建** | system turn 管理 |
| `compress-session/index.ts` | **新建** | Edge Function |
| `AgentBridge.js` | 大改 | 删除 buildStudentContext |
| `AgentPanel.jsx` | 大改 | 用 callAgent + RoundCounter |
| `DebugChat.jsx` | 大改 | 用 callAgent + RoundCounter |
| `App.jsx` | 小改 | 删除状态变量 |
| `EndClassButton.jsx` | 小改 | 调用压缩 |

---

## System Prompt Token 数对比

| Agent | 修改前 | 修改后 | 减少 |
|-------|--------|--------|------|
| Gate 1 | ~400 | ~150 | -63% |
| Orchestrator | ~800 | ~200 | -75% |
| Prompt Tool | ~600 | ~200 | -67% |
| Code Tool | ~400 | ~150 | -63% |
| **总计** | 2200 | 700 | **-68%** |

---

## 验证检查点

### 代码层
- [ ] 「ok/yes/sure」→ 直接追问，不调用 API
- [ ] 少于 3 个词 → 直接追问，不调用 API
- [ ] round 计数由代码递增，不受模型返回值影响
- [ ] 路由切换时 round 重置为 1
- [ ] 超过最大轮次 → 强制 continue:false

### 模型层
- [ ] 学生一轮说清楚 → 模型 all_covered:true → 立刻放行
- [ ] 「very fast」被模型识别为 speed 维度覆盖
- [ ] fix_quality「move around」→ vague
- [ ] fix_quality「patrol left and right every 2 seconds」→ precise
- [ ] System Prompt < 250 tokens

### 边界验证
- [ ] 学生第一轮完整描述 → 代码不拦截 → 模型一轮放行
- [ ] 学生说「ok」→ 代码拦截 → 不调用 API
- [ ] 5 轮没解决 → 代码强制放行

### 架构验证
- [ ] Debug Agent 能引用 Gate 1 best_quote（无需特殊设计）
- [ ] JSON 失败率 < 1/10
- [ ] 对话历史 trim 后 < 600 tokens
- [ ] 温记忆：End Class 后 session_summaries 有记录
- [ ] 冷记忆：3 节课后 student_profiles 有记录

---

## 工期估算

| 步骤 | 天数 |
|------|------|
| Step 1: 数据库表 | 1 |
| Step 2: agentGuards.js | 1 |
| Step 3: agentCaller.js | 1 |
| Step 4: prompts/*.js | 2 |
| Step 5: timeline.js | 2 |
| Step 6: conversationHistory.js | 1 |
| Step 7: DebugChat.jsx 改造 | 2 |
| Step 8: AgentPanel.jsx 改造 | 2 |
| Step 9: AgentBridge.js 替换 | 1 |
| Step 10: 清理旧代码 | 1 |
| Step 11: 记忆层 | 2 |
| **总计** | **16天** |

---

## 确认事项

- [x] **Phase A 完成状态**：全部正常 ✓
- [x] **记忆层**：包含在 MVP 范围内 ✓
- [x] **代码/模型边界**：按本文档定义 ✓
