# 代码层 / 模型层 重新设计方案
## 边界原则：结构化数据→代码，自然语言→模型

---

## 边界原则（一句话）

```
需要读懂意思 → 模型
不需要读懂意思 → 代码
```

---

## 完整分工表

| 判断 | 输入 | 负责方 | 原因 |
|---|---|---|---|
| round计数 | 事件计数 | 代码 | 无语义，纯计数 |
| 「ok/yes」不是修复指令 | 单词匹配 | 代码 | 确定性规则 |
| 少于3个词不是有效回答 | 长度 | 代码 | 确定性规则 |
| 超过N轮强制放行 | 计数 | 代码 | 兜底规则 |
| fix_quality specific/precise | 自然语言 | 模型 | 需要语义理解 |
| all_covered true/false | 自然语言 | 模型 | 维度覆盖是语义判断 |
| bug分类 A/B/C | 自然语言 | 模型 | 需要理解症状 |
| 归因质量 完整/部分/无 | 自然语言 | 模型 | 需要理解因果描述 |
| 「very fast」算不算量化 | 自然语言 | 模型 | 语境依赖的语义判断 |

---

## Part 1：代码层

### 位置：`student-app/src/lib/agentGuards.js`（新建文件）

```javascript
/**
 * Agent Guards — 代码层判断
 * 所有判断：不需要读懂意思，只需要结构化规则
 */

// ─── 1. round计数 ───────────────────────────────────────────

/**
 * 每次用户发消息，round+1
 * 路由切换时重置为1
 * 和模型返回的round字段无关——代码是权威
 */
export class RoundCounter {
  constructor() { this.round = 1 }
  increment() { this.round += 1 }
  reset() { this.round = 1 }
  get() { return this.round }
}

// ─── 2. 明显无效输入检测 ──────────────────────────────────────

const CONFIRMATION_WORDS = /^(ok|okay|yes|no|sure|good|great|yeah|yep|got\s*it|fine|alright)\.?$/i
const MIN_WORD_COUNT = 3

/**
 * 检测输入是否明显无效（不需要调用API）
 * 返回 { invalid: true, reason } 或 { invalid: false }
 */
export const checkObviouslyInvalid = (text) => {
  const trimmed = text?.trim() || ''

  // 空输入
  if (!trimmed) return { invalid: true, reason: 'empty' }

  // 单词确认（ok/yes/sure等）
  if (CONFIRMATION_WORDS.test(trimmed)) {
    return { invalid: true, reason: 'confirmation' }
  }

  // 太短（少于3个词）
  const wordCount = trimmed.split(/\s+/).length
  if (wordCount < MIN_WORD_COUNT) {
    return { invalid: true, reason: 'too_short' }
  }

  return { invalid: false }
}

// 对应的追问模板（不调用API，直接显示）
export const INVALID_RESPONSE_TEMPLATES = {
  empty: 'Please describe what\'s happening in your game.',
  confirmation: 'Can you describe it in a full sentence? For example: "Fix the [feature]: it should [behavior]"',
  too_short: 'Can you say more? Describe what the feature should do.',
}

// ─── 3. 最大轮次兜底 ──────────────────────────────────────────

const MAX_ROUNDS = {
  gate1_easy: 1,      // Easy不触发
  gate1_medium: 3,    // Medium最多3轮
  gate1_hard: 4,      // Hard最多4轮
  debug_orchestrator: 5,  // Orchestrator含Step 0最多5轮
  debug_prompt: 5,    // Prompt Tool最多5轮（含执行层）
  debug_code: 4,      // Code Tool最多4轮
  debug_reset: 3,     // Reset最多3步
}

/**
 * 检查是否超过最大轮次
 * 超过时强制放行，防止学生卡死
 */
export const checkMaxRounds = (mode, currentRound) => {
  const max = MAX_ROUNDS[mode] || 5
  if (currentRound > max) {
    return { exceeded: true, message: 'Max rounds reached, proceeding.' }
  }
  return { exceeded: false }
}

// ─── 4. 完整性判断辅助（代码做初步过滤，模型做最终判断）──────

/**
 * 预检：这个输入是否值得发给模型评估
 * 只过滤明确不需要模型的情况
 * 不替代模型的语义判断
 */
export const preCheckInput = (text, mode, currentRound) => {
  // Step 1: 明显无效检测
  const invalidCheck = checkObviouslyInvalid(text)
  if (invalidCheck.invalid) {
    return {
      shouldCallModel: false,
      directResponse: INVALID_RESPONSE_TEMPLATES[invalidCheck.reason],
      reason: invalidCheck.reason,
    }
  }

  // Step 2: 最大轮次检测
  const roundCheck = checkMaxRounds(mode, currentRound)
  if (roundCheck.exceeded) {
    return {
      shouldCallModel: false,
      forceRelease: true,
      reason: 'max_rounds_exceeded',
    }
  }

  // Step 3: 其他情况交给模型
  return { shouldCallModel: true }
}
```

---

## Part 2：模型层

模型负责所有需要语义理解的判断。
System Prompt极简，不包含状态管理逻辑。

### 2A：Gate 1 System Prompt

```javascript
// student-app/src/lib/prompts/gate1Prompt.js

export const buildGate1Prompt = (contextString, upgrade, currentRound, maxRounds) => `
IMPORTANT: Return JSON only. Start { end }. No markdown. ONE QUESTION ONLY.

You are a design coach. Help student articulate their game idea precisely.
Never write the prompt for them.

Upgrade: ${upgrade.title}
Context: ${upgrade.agent_context}
Dimensions to explore: ${upgrade.language_dimensions?.join(' | ') || 'none'}
Round: ${currentRound} of ${maxRounds}
${currentRound >= maxRounds ? 'FINAL ROUND: set continue:false regardless of coverage.' : ''}

YOUR JUDGMENT:
- all_covered: true when student has expressed enough intent for ALL dimensions
  (does not need to be word-perfect, just clearly expressed)
- If student expressed the core idea well in one response → all_covered:true, continue:false
- Do not force extra rounds if student already answered clearly

Return:
{"response":"...","continue":true,"all_covered":false,
 "dimension_covered":"which dimension this round covered or null",
 "best_quote":"student's most precise phrase this round",
 "draft_prompt":"3-5 sentence Claude-executable prompt (Hard only, else null)"}

[Context]
${contextString}
`
```

**关键：** `all_covered`由模型判断，代码不干预。学生一轮说清楚了，模型可以直接放行。

---

### 2B：Debug Orchestrator System Prompt

```javascript
export const buildOrchestratorPrompt = (contextString, currentRound) => `
IMPORTANT: Return JSON only. Start { end }. No markdown. ONE QUESTION ONLY.

You are a debug classifier. Classify the bug using Q1→Q2→Q3→Q4.
Step 0 first: confirm this is actually a bug (not normal game behavior).

Q1: still running? → crashed/frozen = reset_tool immediately
Q2: one or multiple broken? → multiple = reset_tool
Q3: missing or wrong behavior? → missing = prompt_tool
Q4: opposite direction or small detail? → opposite = prompt_tool, detail = code_tool
Not a bug → route: no_bug

Round ${currentRound} of 5.
${currentRound >= 5 ? 'FINAL ROUND: must route now, no more pending.' : ''}

Return:
{"response":"...","route":"pending|prompt_tool|code_tool|reset_tool|no_bug",
 "q_asked":"Q1|Q2|Q3|Q4|S0|done","severity":"light|medium|heavy|none",
 "bug_summary":"","related_upgrade":null}

[Session Context]
${contextString}
`
```

---

### 2C：Debug Prompt Tool System Prompt

```javascript
export const buildPromptToolPrompt = (contextString, bugSummary, currentRound, maxRounds) => `
IMPORTANT: Return JSON only. Start { end }. No markdown. ONE QUESTION ONLY.

You are a prompt fix coach.
Bug: "${bugSummary}"
Round: ${currentRound} of ${maxRounds}
${currentRound >= maxRounds ? 'FINAL ROUND: accept student answer, set continue:false.' : ''}

Round guide:
Round 2: Ask if they described this in their prompt
Round 3: Ask what specific description was missing
Round 4: Ask student to write one fix sentence
Round 4+: Evaluate student's fix sentence

YOUR JUDGMENT on student_fix:
- fix_quality "precise": student wrote feature name + specific behavior + at least one detail
  Example: "Fix the moving trap: patrol left and right every 2 seconds"
- fix_quality "specific": has feature and behavior but missing details
  Example: "Make the trap move left and right"
- fix_quality "vague": unclear what should happen
  (Note: you already know "ok/yes/too short" were filtered by code before reaching you)

Read Session Context to find Gate 1 records — use student's exact words from Gate 1
when asking why the feature didn't appear.

Return:
{"response":"...","round":${currentRound},"continue":true,
 "student_fix":"student's exact words or empty","fix_quality":"vague|specific|precise"}

[Session Context]
${contextString}
`
```

---

### 2D：Debug Code Tool System Prompt

```javascript
export const buildCodeToolPrompt = (contextString, bugSummary, currentRound, maxRounds) => `
IMPORTANT: Return JSON only. Start { end }. No markdown. ONE QUESTION ONLY.

You are a code bug coach.
Bug: "${bugSummary}"
Round: ${currentRound} of ${maxRounds}
${currentRound >= maxRounds ? 'FINAL ROUND: accept student answer, set continue:false.' : ''}

Round guide:
Round 1: What exactly happens? (what + when + how)
Round 2: How do you trigger it? Every time?
Round 3: Student writes: "Fix [feature]: it should [expected behavior] instead of [current behavior]"

Do NOT reference Gate 1 context — code bugs unrelated to design intent.

Return:
{"response":"...","round":${currentRound},"continue":true,
 "student_fix":"student's exact words or empty","fix_quality":"vague|specific|precise"}

[Context]
Current prompt: ${contextString}
`
```

---

## Part 3：调用层 — 代码和模型的连接点

### 位置：`student-app/src/lib/agentCaller.js`（新建文件）

```javascript
import { preCheckInput, INVALID_RESPONSE_TEMPLATES } from './agentGuards'
import { callDeepSeek } from './deepseek'
import { parseAgentResponse } from './parseAgentResponse'

/**
 * 统一的Agent调用入口
 * 代码层先过滤，通过后才调用模型
 */
export const callAgent = async ({
  mode,           // 'gate1' | 'debug_orchestrator' | 'debug_prompt' | 'debug_code' | 'debug_reset'
  userInput,      // 学生输入的原文
  currentRound,   // 代码计数的当前轮次（不是模型返回的）
  systemPrompt,   // 已经构建好的System Prompt
  conversationHistory,  // 已裁剪的对话历史
}) => {

  // ── Step 1：代码层预检 ──────────────────────────────────────
  const preCheck = preCheckInput(userInput, mode, currentRound)

  if (!preCheck.shouldCallModel) {
    // 代码直接返回，不调用API
    if (preCheck.forceRelease) {
      return {
        response: 'Let\'s move on.',
        continue: false,
        forceReleased: true,
      }
    }
    return {
      response: preCheck.directResponse,
      continue: true,
      skippedModel: true,  // 标记：这条回复不是模型生成的
    }
  }

  // ── Step 2：调用模型 ────────────────────────────────────────
  const rawResponse = await callDeepSeek({
    systemPrompt,
    messages: [
      ...conversationHistory,
      { role: 'user', content: userInput },
      // JSON强制约束放在最后
      { role: 'user', content: '__FORMAT__: Return JSON only. { } No other text.' }
    ],
    maxTokens: 500,
  })

  // ── Step 3：解析响应 ────────────────────────────────────────
  const parsed = parseAgentResponse(rawResponse, currentRound)

  // ── Step 4：代码层后处理 ──────────────────────────────────────
  // 最大轮次兜底：即使模型说continue:true，超过上限也强制结束
  const { exceeded } = checkMaxRounds(mode, currentRound)
  if (exceeded && parsed.continue) {
    parsed.continue = false
    parsed.forceReleased = true
  }

  return parsed
}
```

---

## Part 4：调用流程图

```
学生输入
    ↓
preCheckInput()（代码层）
    ↓
┌───────────────┬──────────────────────┐
│ 明显无效       │ 通过                  │
│ （ok/yes/空）  │                      │
↓               ↓                     │
直接追问         callDeepSeek()         │
不消耗API        模型判断语义            │
                ↓                     │
           parseAgentResponse()        │
                ↓                     │
           checkMaxRounds()（代码层）   │
                ↓                     │
           如果超限：强制continue:false  │
                ↓                     ↓
           返回给UI渲染 ←─────────────┘
```

---

## Part 5：现有代码需要修改的地方

### DebugChat.jsx — handleSend()

```javascript
// 修改前：直接调用callDebugAgent()
const response = await callDebugAgent(currentMode, messages, context)

// 修改后：通过统一入口
const response = await callAgent({
  mode: currentMode,
  userInput: inputText,
  currentRound: toolRound,  // 代码计数
  systemPrompt: buildSystemPrompt(currentMode, context),
  conversationHistory: trimConversationHistory(messages),
})

// round计数：代码负责，不用模型返回的round
if (response.continue) {
  setToolRound(prev => prev + 1)
} else {
  setToolRound(1)  // 完成，重置
}
```

### AgentPanel.jsx（Gate 1）— handleGate1Response()

```javascript
// 修改前：信任模型的all_covered和continue字段
if (!apiResponse.continue) handleRelease()

// 修改后：
// 1. all_covered由模型判断（信任）
// 2. continue由模型判断（信任），但有兜底
// 3. round由代码计数

const response = await callAgent({
  mode: `gate1_${upgrade.level}`,
  userInput: studentInput,
  currentRound: gateRound,
  systemPrompt: buildGate1Prompt(contextString, upgrade, gateRound, maxRounds),
  conversationHistory: currentConversation,
})

// 更新round
if (response.continue) {
  setGateRound(prev => prev + 1)
}

// 放行判断：模型说不继续，或代码强制放行
if (!response.continue || response.forceReleased) {
  handleGate1Complete(response)
}
```

---

## Part 6：删除的代码

**以下现有代码在本方案实施后可以删除：**

```javascript
// AgentPanel.jsx — 删除
const hasQuantifier = /every \d+|\d+ second|\d+ time/i.test(text)
// 原因：这是在用代码做语义判断，现在交给模型

// AgentPanel.jsx — 删除
if (apiResponse.fix_quality === 'precise') handleRelease()
// 替换为：if (!apiResponse.continue) handleRelease()
// 原因：fix_quality是模型的判断，continue是最终结论，代码用continue不用fix_quality

// DebugChat.jsx — 删除
const [toolRound, setToolRound] = useState(1)  // 迁移到RoundCounter
// 替换为：const roundCounter = useRef(new RoundCounter())
```

---

## Part 7：System Prompt token数对比

| Agent | 修改前 | 修改后 | 减少原因 |
|---|---|---|---|
| Gate 1 | ~400 tokens | ~150 tokens | 删除round状态说明、维度覆盖规则 |
| Orchestrator | ~800 tokens | ~200 tokens | 删除Q状态注入、禁止问题列表 |
| Prompt Tool | ~600 tokens | ~200 tokens | 删除fix_quality规则列表 |
| Code Tool | ~400 tokens | ~150 tokens | 删除症状描述规则 |

**总计：从2200 tokens减少到700 tokens，减少68%。**

减少的部分不是信息丢失，而是「用代码兜底 + 模型自己判断」替代了「在System Prompt里用规则列表约束模型」。

---

## 验证检查点

### 代码层
- [ ] 「ok/yes/sure」→ 直接追问，不调用API
- [ ] 少于3个词 → 直接追问，不调用API
- [ ] round计数由代码递增，不受模型返回值影响
- [ ] 路由切换时round重置为1
- [ ] 超过最大轮次 → 强制continue:false，不继续调用

### 模型层
- [ ] 学生一轮说清楚 → 模型all_covered:true → 立刻放行（不强制多轮）
- [ ] 「very fast」被模型正确识别为speed维度覆盖
- [ ] fix_quality「move around」→ 模型判断vague，继续追问
- [ ] fix_quality「patrol left and right every 2 seconds」→ 模型判断precise，放行
- [ ] System Prompt < 250 tokens（每个Agent）

### 边界验证
- [ ] 学生第一轮说了完整描述 → 代码不拦截 → 模型一轮放行
- [ ] 学生说「ok」→ 代码拦截 → 不调用API → 直接追问
- [ ] 5轮还没解决 → 代码强制放行 → 对话结束
