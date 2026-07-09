# P7 - 认知行为系统设计

## 理论基础

基于《AI时代人才形成理论》的行为循环模型：

```
Experience → Competence → Self-Efficacy → Motivation → Identity
→ Problem Framing → Problem Breakdown → Validation → Iteration
→ Value Creation → Identity Reinforcement
```

现有系统覆盖：
- **Problem Framing** → Gate 1（设计意图表达）
- **Problem Breakdown** → Debug（问题分解）

本方案补全：
- **Validation** → Pre-Send Prediction（主动验证）
- **Iteration** → Post-Debug Iteration（主动迭代）
- **Recovery Training** → Reset Phase 2 强化（从失败中提取教训）
- **Identity Reinforcement** → End-of-Class Reflection（身份锚定）

---

## 现有架构兼容性

### 已实施的基础设施

| 组件 | 状态 | 位置 |
|------|------|------|
| session_timeline 表 | ✅ 已创建 | v17-phase-b-schema.sql |
| timeline.js 模块 | ✅ 已实施 | src/lib/timeline.js |
| debug_sessions 表 | ✅ 已创建 | debug-chat-schema.sql |
| ShareGame.jsx | ✅ 存在 | src/components/ |
| PromptGenerator.jsx | ✅ 存在 | src/components/ |

### 写入规范

所有事件写入必须使用 `timeline.js` 的函数：

```javascript
import { writeEvent } from '../lib/timeline'

await writeEvent(studentId, sessionId, {
  type: 'prediction_made',      // event_type
  upgradeId: upgradeId,         // 可选
  role: 'student',              // 'student' | 'agent' | 'system'
  content: prediction,          // 内容
  metadata: { ... },            // 结构化数据
  visibleToAgent: true,         // 是否对 Agent 可见
  isSystemMarker: false,        // 是否系统标记
  displayInUI: true,            // 是否在 UI 显示
})
```

---

## 修改1：Pre-Send Prediction（Validation 训练）

### 认知目标

训练「主动验证」行为：学生发 prompt 前写出预测，生成后对比。
建立因果链：「语言精确度 → 可预测的结果」

### 触发流程

```
Copy 按钮点击
    ↓
PredictionPrompt 弹窗
    ↓
学生写预测（可跳过）
    ↓
写入 session_timeline (type: prediction_made)
    ↓
复制到剪贴板 + 打开 Claude
    ↓
学生返回 Prompt Tab
    ↓
ValidationCheck 弹窗（如有预测）
    ↓
Yes/No + 反思
    ↓
写入 session_timeline (type: prediction_validated)
```

### 文件变更

#### 新建：`src/components/PredictionPrompt.jsx`

```jsx
import { useState } from 'react'
import { writeEvent } from '../lib/timeline'
import { useT } from '../i18n'

export default function PredictionPrompt({
  studentId,
  sessionId,
  upgradeId,
  upgradeLabel,
  onConfirm,
  onSkip
}) {
  const t = useT()
  const [prediction, setPrediction] = useState('')
  const [saving, setSaving] = useState(false)

  const handleConfirm = async () => {
    if (!prediction.trim()) {
      onConfirm(null)
      return
    }

    setSaving(true)

    await writeEvent(studentId, sessionId, {
      type: 'prediction_made',
      upgradeId,
      role: 'student',
      content: prediction.trim(),
      metadata: {
        upgrade_label: upgradeLabel,
        predicted_at: new Date().toISOString(),
      },
    })

    setSaving(false)
    onConfirm(prediction.trim())
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="text-center mb-5">
          <div className="text-3xl mb-2">🔮</div>
          <h2 className="text-lg font-bold text-slate-800">
            {t('prediction.title')}
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {t('prediction.subtitle')}
          </p>
        </div>

        {upgradeLabel && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 mb-4 text-center">
            <span className="text-xs text-orange-500 font-bold uppercase">
              {t('prediction.upgrade')}
            </span>
            <p className="text-sm font-semibold text-orange-700 mt-0.5">
              {upgradeLabel}
            </p>
          </div>
        )}

        <textarea
          value={prediction}
          onChange={(e) => setPrediction(e.target.value)}
          placeholder={t('prediction.placeholder')}
          rows={3}
          className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400 resize-none mb-4"
          autoFocus
        />

        <button
          onClick={handleConfirm}
          disabled={saving}
          className="w-full bg-orange-500 text-white rounded-xl py-3 font-bold hover:bg-orange-600 disabled:opacity-50 mb-2"
        >
          {saving ? t('common.saving') : t('prediction.sendToClaude')}
        </button>

        <button
          onClick={onSkip}
          className="w-full text-slate-400 text-sm hover:text-slate-600"
        >
          {t('prediction.skip')}
        </button>
      </div>
    </div>
  )
}
```

#### 新建：`src/components/ValidationCheck.jsx`

```jsx
import { useState } from 'react'
import { writeEvent } from '../lib/timeline'
import { useT } from '../i18n'

export default function ValidationCheck({
  studentId,
  sessionId,
  upgradeId,
  prediction,
  onDone
}) {
  const t = useT()
  const [matched, setMatched] = useState(null)
  const [reflection, setReflection] = useState('')
  const [step, setStep] = useState('check')  // 'check' | 'reflect'

  const handleMatch = async (didMatch) => {
    setMatched(didMatch)

    await writeEvent(studentId, sessionId, {
      type: 'prediction_validated',
      upgradeId,
      role: 'student',
      content: didMatch ? 'prediction_matched' : 'prediction_mismatched',
      metadata: {
        original_prediction: prediction,
        matched: didMatch,
        validated_at: new Date().toISOString(),
      },
    })

    setStep('reflect')
  }

  const handleReflect = async () => {
    if (reflection.trim()) {
      await writeEvent(studentId, sessionId, {
        type: 'validation_reflection',
        upgradeId,
        role: 'student',
        content: reflection.trim(),
        metadata: { matched },
      })
    }
    onDone(matched)
  }

  if (step === 'check') {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
          <div className="text-center mb-5">
            <div className="text-3xl mb-2">🎯</div>
            <h2 className="text-lg font-bold text-slate-800">
              {t('validation.title')}
            </h2>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-5">
            <p className="text-xs text-slate-400 uppercase font-bold mb-1">
              {t('validation.yourPrediction')}
            </p>
            <p className="text-sm text-slate-700 italic">"{prediction}"</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleMatch(true)}
              className="flex-1 bg-green-500 text-white rounded-xl py-3 font-bold hover:bg-green-600"
            >
              {t('validation.yesMatched')}
            </button>
            <button
              onClick={() => handleMatch(false)}
              className="flex-1 bg-orange-500 text-white rounded-xl py-3 font-bold hover:bg-orange-600"
            >
              {t('validation.noDifferent')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="text-center mb-5">
          <div className="text-3xl mb-2">{matched ? '🌟' : '🤔'}</div>
          <h2 className="text-lg font-bold text-slate-800">
            {matched ? t('validation.whyMatched') : t('validation.whatDifferent')}
          </h2>
        </div>

        <textarea
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder={matched
            ? t('validation.matchedPlaceholder')
            : t('validation.differentPlaceholder')}
          rows={3}
          className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-orange-400 resize-none mb-4"
          autoFocus
        />

        <button
          onClick={handleReflect}
          className="w-full bg-orange-500 text-white rounded-xl py-3 font-bold hover:bg-orange-600 mb-2"
        >
          {t('common.continue')}
        </button>

        <button
          onClick={() => onDone(matched)}
          className="w-full text-slate-400 text-sm hover:text-slate-600"
        >
          {t('common.skip')}
        </button>
      </div>
    </div>
  )
}
```

#### 重要发现：Copy 按钮在 Upgrade 组件，不是 PromptGenerator

```
代码分析结果：
- PromptGenerator.jsx: 显示基础 prompt，没有 upgrade 相关逻辑
- Upgrade.jsx:546: copyText() 函数 + onUpgradeCopy 回调
- App.jsx:562: handleUpgradeCopy() 接收回调
```

**Prediction 应该在 Upgrade 组件触发，不是 PromptGenerator。**

#### 修改：`src/components/Upgrade.jsx`

```jsx
// Upgrade.jsx

// 新增 props
export default function Upgrade({
  // 现有 props...
  studentId,           // 用于写入 timeline
  sessionId,           // 用于写入 timeline
  onPredictionMade,    // 回调：预测完成
}) {
  // 新增状态
  const [showPrediction, setShowPrediction] = useState(false)
  const [pendingCopy, setPendingCopy] = useState(null)

  // 修改 copyText 函数
  const copyText = async (text, id, level, label) => {
    // 显示预测弹窗
    setPendingCopy({ text, id, level, label })
    setShowPrediction(true)
  }

  const handlePredictionConfirm = async (prediction) => {
    setShowPrediction(false)

    // 真正复制
    try {
      await navigator.clipboard.writeText(pendingCopy.text)
    } catch {
      // fallback...
    }

    setCopiedId(pendingCopy.id)
    onUpgradeCopy?.(pendingCopy.id, pendingCopy.level)

    // 通知 App.jsx 预测已完成
    onPredictionMade?.(prediction, pendingCopy.id, pendingCopy.label)
  }

  const handlePredictionSkip = async () => {
    setShowPrediction(false)

    // 直接复制
    try {
      await navigator.clipboard.writeText(pendingCopy.text)
    } catch {
      // fallback...
    }

    setCopiedId(pendingCopy.id)
    onUpgradeCopy?.(pendingCopy.id, pendingCopy.level)
  }

  // 渲染
  return (
    <>
      {/* 现有渲染... */}

      {showPrediction && pendingCopy && (
        <PredictionPrompt
          studentId={studentId}
          sessionId={sessionId}
          upgradeId={pendingCopy.id}
          upgradeLabel={pendingCopy.label}
          onConfirm={handlePredictionConfirm}
          onSkip={handlePredictionSkip}
        />
      )}
    </>
  )
}
```

#### 修改：`src/App.jsx`

```jsx
// App.jsx

// 新增状态
const [pendingValidation, setPendingValidation] = useState(null)
const [showValidation, setShowValidation] = useState(false)

// Prediction 回调（从 Upgrade 组件传上来）
const handlePredictionMade = (prediction, upgradeId, upgradeLabel) => {
  if (prediction) {
    setPendingValidation({ prediction, upgradeId, upgradeLabel })
  }
}

// Prompt Tab 重访时触发验证
useEffect(() => {
  if (tab === 'prompt' && pendingValidation && !showValidation) {
    setShowValidation(true)
  }
}, [tab])

const handleValidationDone = (matched) => {
  setShowValidation(false)
  setPendingValidation(null)
}

// 渲染 Upgrade 时传递 props
<Upgrade
  // 现有 props...
  studentId={studentId}
  sessionId={sessionId}
  onPredictionMade={handlePredictionMade}
/>

// 渲染 ValidationCheck
{showValidation && pendingValidation && (
  <ValidationCheck
    studentId={studentId}
    sessionId={sessionId}
    upgradeId={pendingValidation.upgradeId}
    prediction={pendingValidation.prediction}
    onDone={handleValidationDone}
  />
)}
```

---

## 修改2：Post-Debug Iteration（迭代训练）

### 认知目标

训练「主动迭代」行为：Debug 修好后不是终点，而是改进的起点。

### 重要发现：当前 resolved 逻辑缺失

经过代码分析，当前系统的 Debug 流程：

```
现有流程：
1. Orchestrator 分类 bug → 路由到 prompt_tool/code_tool/reset_tool
2. Tool 帮助学生 → 生成 fix → 学生点 "Go Generate"
3. 学生去 Claude 生成
4. 学生返回 Debug Tab → handleVerificationReturn() → 显示 "Welcome back"
5. 学生回复 → 当普通消息处理（继续对话）
   ⚠️ 没有设置 resolved=true 的逻辑！
```

`route === 'no_bug'` 是 Orchestrator 判断"根本没 bug"时的处理，**不是**学生确认"修好了"的位置。

### 需要新增的功能

**Step 2a：用 AI 判断学生是否确认修好（替代正则匹配）**

正则匹配难以覆盖所有自然语言变体（「it works now」「sort of fixed」），改用 AI 一次调用同时完成：
1. 判断 resolved 状态（true/false/null）
2. 生成对应的下一句话

#### 新建：`src/lib/prompts/resolutionJudgePrompt.js`

```javascript
/**
 * Resolution Judge Prompt
 * 判断学生是否确认 bug 已修好，同时生成下一句回复
 *
 * resolved: true  → 修好了，追加 Iteration 或 Recovery 问题
 * resolved: false → 没修好，继续调试
 * resolved: null  → 不确定，再问一次
 */

export function buildResolutionJudgePrompt(isResetScenario, keptCount, previousCount, language = 'en') {

  const iterationQuestion = language === 'zh'
    ? '修好啦！🎉 现在它能用了——如果你能让这个功能更好或更有趣，你会怎么改？'
    : "Nice work fixing it! 🎉 Now that it works — if you could make this feature even better or more interesting, what would you change?"

  const recoveryQuestion = language === 'zh'
    ? '重建成功了！你从这次经历中学到了什么？下次做东西时会怎么用？'
    : "You restarted and it worked — what's one thing you learned from this that you'll use next time you build something?"

  const recoveryHint = language === 'zh'
    ? `这次你保留了 ${keptCount} 个功能，之前有 ${previousCount} 个——这说明 Claude 是怎么工作的？`
    : `You kept ${keptCount} features this time instead of ${previousCount} — what does that tell you about how Claude works?`

  const notFixedResponse = language === 'zh'
    ? "好的，我们继续找问题。你看到了什么？"
    : "Okay, let's keep looking. What do you see?"

  const unclearResponse = language === 'zh'
    ? "游戏现在运行正常了吗？"
    : "Is the game working properly now?"

  const resolvedFollowUp = isResetScenario ? recoveryQuestion : iterationQuestion

  return `IMPORTANT: Return JSON only. { } No markdown. ONE response only.

You are judging whether a student confirmed their game bug is fixed.
They were asked "Did the fix work?" or "Is your new game running?"

JUDGE their reply:
- resolved: true  → student clearly confirms it works
  (yes, worked, fixed, it's good, 好了, 修好了, 可以了, 正常了, works now, it works, etc.)
- resolved: false → student says it's not fixed
  (no, still broken, didn't work, not fixed, 没好, 还是不行, 不行, still, etc.)
- resolved: null  → unclear or ambiguous (ask again)

RESPONSE rules:
- If resolved=true: respond with the follow-up question below
- If resolved=false: respond with encouragement + ask what's still wrong
- If resolved=null: ask once more clearly

Follow-up question when resolved=true:
"${resolvedFollowUp}"

Recovery hint (only if isResetScenario=true AND student says they don't know):
"${recoveryHint}"

Not fixed response:
"${notFixedResponse}"

Unclear response:
"${unclearResponse}"

Return:
{
  "resolved": true | false | null,
  "response": "the next thing to say to the student",
  "isIterationPrompt": true | false,
  "isRecoveryPrompt": true | false
}

Rules for flags:
- isIterationPrompt: true only when resolved=true AND NOT isResetScenario
- isRecoveryPrompt: true only when resolved=true AND isResetScenario
- Both false in all other cases`
}
```

#### 修改：`src/components/DebugChat.jsx`

**新增 import：**

```javascript
import { buildResolutionJudgePrompt } from '../lib/prompts/resolutionJudgePrompt'
import { callAgentDirect } from '../lib/agentCaller'
```

**新增状态：**

```javascript
const [awaitingResolution, setAwaitingResolution] = useState(false)
```

**修改 handleVerificationReturn：**

```javascript
const handleVerificationReturn = async () => {
  const welcomeMessage = {
    role: 'assistant',
    content: executionPayload?.type === 'reset'
      ? t('debug.welcomeBackReset')
      : t('debug.welcomeBack'),
    timestamp: new Date().toISOString(),
    isVerificationAsk: true,
  }

  const finalMessages = [...messages, welcomeMessage]
  setMessages(finalMessages)
  await updateChatHistory(activeChatId, finalMessages)

  setAwaitingResolution(true)
  setPendingVerification(null)
}
```

**修改 handleSend — 用 AI 判断替代正则：**

```javascript
// 在 handleSend 里，awaitingResolution 处理部分

if (awaitingResolution) {
  setIsLoading(true)

  // 先显示学生的消息
  const userMessage = {
    role: 'user',
    content: textContent,
    timestamp: new Date().toISOString(),
  }
  const messagesWithUser = [...messages, userMessage]
  setMessages(messagesWithUser)
  setInputText('')

  try {
    const isResetScenario = currentMode === 'debug_reset_phase1' ||
                            executionPayload?.type === 'reset'
    const keptCount = selectedUpgrades?.length || 0
    const previousCount = successfulUpgrades?.length || 0

    // 构建判断 prompt
    const systemPrompt = buildResolutionJudgePrompt(
      isResetScenario, keptCount, previousCount, language
    )

    // 使用 callAgentDirect，跳过预检（简单判断不需要预检）
    const response = await callAgentDirect({
      systemPrompt,
      messages: [{ role: 'user', content: textContent }],
      maxTokens: 150,
    })

    // 构建 Agent 回复消息
    const agentMessage = {
      role: 'assistant',
      content: response.response,
      timestamp: new Date().toISOString(),
      isIterationPrompt: response.isIterationPrompt || false,
      isRecoveryPrompt: response.isRecoveryPrompt || false,
      recoveryHint: isResetScenario ? buildResolutionJudgePrompt(
        true, keptCount, previousCount, language
      ).match(/Recovery hint.*?"([^"]+)"/)?.[1] : null,
    }

    const finalMessages = [...messagesWithUser, agentMessage]
    setMessages(finalMessages)
    await updateChatHistory(activeChatId, finalMessages)

    // 根据 resolved 状态处理
    if (response.resolved === true) {
      // 修好了：写入 resolved=true
      await supabase.from('debug_sessions').update({
        resolved: true,
        resolved_at: new Date().toISOString(),
      }).eq('id', activeChatId)

      setAwaitingResolution(false)
      await loadChatList()

    } else if (response.resolved === false) {
      // 没修好：继续调试
      setAwaitingResolution(false)

    } else {
      // null：不确定，保持 awaitingResolution=true
      // Agent 已经再问一次，等学生下次回复
    }

  } catch (error) {
    console.error('[DebugChat] Resolution judge error:', error)
    setAwaitingResolution(false)  // 出错时 fallback
  } finally {
    setIsLoading(false)
  }

  return
}
```

**Step 2b：处理 Iteration/Recovery 回复**

```javascript
// handleSend 里，检测上一条消息的标记
const lastMessage = messages[messages.length - 1]

if (lastMessage?.isIterationPrompt) {
  await handleIterationResponse(textContent)
  return
}

if (lastMessage?.isRecoveryPrompt) {
  await handleRecoveryResponse(textContent, lastMessage.recoveryHint)
  return
}
```

```javascript
const handleIterationResponse = async (idea) => {
  // 保存迭代想法
  await writeEvent(studentId, sessionId, {
    type: 'iteration_idea',
    role: 'student',
    content: idea,
    metadata: {
      debug_session_id: activeChatId,
      triggered_by: 'post_debug_iteration',
    },
  })

  // 显示收尾消息
  const userMsg = {
    role: 'user',
    content: idea,
    timestamp: new Date().toISOString(),
  }
  const closeMsg = {
    role: 'assistant',
    content: t('debug.iterationResponse', { idea }),
    timestamp: new Date().toISOString(),
  }

  const finalMessages = [...messages, userMsg, closeMsg]
  setMessages(finalMessages)
  await updateChatHistory(activeChatId, finalMessages)
  setInputText('')
}

const handleRecoveryResponse = async (insight, recoveryHint) => {
  // 检测"不知道"
  const isDontKnow = /don't know|不知道|no idea|idk|没想法/i.test(insight)

  if (isDontKnow && recoveryHint) {
    // 给提示，再问一次
    const userMsg = {
      role: 'user',
      content: insight,
      timestamp: new Date().toISOString(),
    }
    const hintMsg = {
      role: 'assistant',
      content: recoveryHint,
      timestamp: new Date().toISOString(),
      isRecoveryPrompt: true,  // 保持标记，但不再给 hint
    }

    const finalMessages = [...messages, userMsg, hintMsg]
    setMessages(finalMessages)
    await updateChatHistory(activeChatId, finalMessages)
    setInputText('')
    return
  }

  // 保存 Recovery 反思
  await writeEvent(studentId, sessionId, {
    type: 'recovery_insight',
    role: 'student',
    content: insight,
    metadata: {
      debug_session_id: activeChatId,
      kept_count: selectedUpgrades?.length || 0,
      total_count: successfulUpgrades?.length || 0,
    },
  })

  // 显示收尾消息
  const userMsg = {
    role: 'user',
    content: insight,
    timestamp: new Date().toISOString(),
  }
  const closeMsg = {
    role: 'assistant',
    content: t('debug.recoveryResponse'),
    timestamp: new Date().toISOString(),
  }

  const finalMessages = [...messages, userMsg, closeMsg]
  setMessages(finalMessages)
  await updateChatHistory(activeChatId, finalMessages)
  setInputText('')
}
```

### 触发流程（修正后）

```
学生点 "Go Generate" → 去 Claude
    ↓
学生返回 Debug Tab
    ↓
handleVerificationReturn() → 显示 "Welcome back! Did the fix work?"
    ↓
awaitingResolution = true
    ↓
学生回复 "yes/worked/修好了"
    ↓
handleResolutionConfirmed()
    ↓
resolved=true + 追加 Iteration 问题
    ↓
学生回复迭代想法（可跳过）
    ↓
handleIterationResponse() → 写入 session_timeline
```

---

## 修改3：Reset Phase 2 强化（Recovery Training）

### 认知目标

把「知道为什么失败」升级为「带走了什么」。
从解释失败 → 提取教训 → Identity Seed

### 代码分析结果

**Reset prompt 位置已确认：**

```
src/lib/prompts/debugCodeToolPrompt.js
├── buildCodeToolPrompt()      — Code Tool 问答
└── buildResetToolPrompt()     — Reset Tool Phase 1 问答
```

**当前 Reset 流程 (Phase 1 only):**

```javascript
// buildResetToolPrompt() 的三步流程：
Step 1: "Sometimes starting fresh is faster. Which features to keep?"
Step 2: UI 显示功能选择器（show_upgrade_selector: true）
Step 3: 学生写新 prompt → 去 Claude

// ⚠️ 没有 Phase 2！
// 学生从 Claude 回来后，直接进入 handleVerificationReturn()
// 显示 "Welcome back! Is your new game running?"
// 但没有后续的 "你学到了什么" 问答
```

### 需要新建 Reset Phase 2

Reset Phase 2 不是修改现有 prompt，而是**新增逻辑**：

**触发时机：** 学生从 Claude 回来，确认新游戏运行正常后

**与修改2的关系：**
- 修改2 (Iteration) 针对普通 Fix 场景
- 修改3 (Recovery) 针对 Reset 场景
- 两者都在 `handleResolutionConfirmed()` 里触发，但问的问题不同

### 文件变更

#### 新增：`src/lib/prompts/debugResetPhase2Prompt.js`

```javascript
/**
 * Reset Phase 2 - Recovery Training
 *
 * 学生重建游戏成功后，提取教训
 * 认知目标：从失败中学习 → Identity Seed
 */

export function buildResetPhase2Questions(keptCount, previousCount, language = 'en') {
  const questions = {
    en: {
      confirm: "Is your new game running well?",
      extract: `You restarted and it worked — what's one thing you learned
from this that you'll use next time you build something?`,
      hint: `You kept ${keptCount} features this time instead of ${previousCount} —
what does that tell you about how Claude works?`,
      dontKnow: [
        "That's okay! Here's a hint:",
        "Think about: what was different this time?",
        "No worries — building is learning!",
      ],
    },
    zh: {
      confirm: "你的新游戏运行正常吗？",
      extract: `重建成功了！你从这次经历中学到了什么，
下次做东西时会用到？`,
      hint: `这次你保留了 ${keptCount} 个功能，之前有 ${previousCount} 个 —
这说明 Claude 是怎么工作的？`,
      dontKnow: [
        "没关系！给你一个提示：",
        "想想看：这次有什么不同？",
        "没事 — 做就是在学习！",
      ],
    },
  };

  return questions[language] || questions.en;
}
```

#### 修改：`src/components/DebugChat.jsx`

在 `handleResolutionConfirmed()` 里区分 Reset 和普通 Fix：

```jsx
const handleResolutionConfirmed = async () => {
  // 写入用户确认消息
  const userMessage = {
    role: 'user',
    content: inputText.trim(),
    timestamp: new Date().toISOString(),
  };

  // 设置 resolved=true
  await supabase.from('debug_sessions').update({
    resolved: true,
    resolved_at: new Date().toISOString(),
  }).eq('id', activeChatId);

  // 根据场景选择不同的后续问题
  const isResetScenario = currentMode === 'debug_reset_phase1' ||
                          executionPayload?.type === 'reset';

  let followUpMessage;

  if (isResetScenario) {
    // Reset 场景：问 "你学到了什么"
    const questions = buildResetPhase2Questions(
      selectedUpgrades.length,
      successfulUpgrades.length,
      language
    );
    followUpMessage = {
      role: 'assistant',
      content: questions.extract,
      timestamp: new Date().toISOString(),
      isRecoveryPrompt: true,  // 标记为 Recovery 问题
      recoveryHint: questions.hint,
    };
  } else {
    // 普通 Fix 场景：问 "你想怎么改进"
    followUpMessage = {
      role: 'assistant',
      content: t('debug.iterationQuestion'),
      timestamp: new Date().toISOString(),
      isIterationPrompt: true,
    };
  }

  const updatedMessages = [...messages, userMessage, followUpMessage];
  setMessages(updatedMessages);
  await updateChatHistory(activeChatId, updatedMessages);

  setAwaitingResolution(false);
  await loadChatList();
};
```

处理 Recovery 回复（学生说"不知道"时给提示）：

```jsx
// 在 handleSend 里添加
const lastMessage = messages[messages.length - 1];

if (lastMessage?.isRecoveryPrompt) {
  const isDontKnow = /don't know|不知道|no idea|idk|没想法/i.test(textContent);

  if (isDontKnow && lastMessage.recoveryHint) {
    // 给提示，再问一次
    const hintMessage = {
      role: 'assistant',
      content: lastMessage.recoveryHint,
      timestamp: new Date().toISOString(),
      isRecoveryPrompt: true,  // 保持标记，但移除 hint
    };
    // ... 添加消息
    return;
  }

  // 保存学生的反思
  await writeEvent(studentId, sessionId, {
    type: 'recovery_insight',
    role: 'student',
    content: textContent,
    metadata: {
      debug_session_id: activeChatId,
      kept_count: selectedUpgrades.length,
      total_count: successfulUpgrades.length,
    },
  });

  // 收尾
  const closeMessage = {
    role: 'assistant',
    content: t('debug.recoveryResponse'),
    timestamp: new Date().toISOString(),
  };
  // ... 添加消息
  return;
}
```

---

## 修改4：End-of-Class Reflection（Identity Reinforcement）

### 认知目标

建立「我能用 AI 创造东西」的身份认同。
学生的反思出现在家长报告里，成为 Identity 的外部锚点。

### 数据库变更

```sql
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS session_reflection text;
```

### 文件变更

#### 修改：`src/components/ShareGame.jsx`

在保存成功后添加反思步骤：

```jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { writeEvent } from '../lib/timeline'
import { useT } from '../i18n'

export default function ShareGame({ studentId, sessionId, onDone, inline = false }) {
  const t = useT()
  const [link, setLink] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  // 新增反思状态
  const [reflectionText, setReflectionText] = useState('')
  const [reflection, setReflection] = useState('')
  const [savingReflection, setSavingReflection] = useState(false)

  const handleSave = async () => {
    // 现有保存逻辑...
  }

  const handleSaveReflection = async () => {
    if (!reflectionText.trim()) return

    setSavingReflection(true)

    // 保存到 students 表
    await supabase.from('students').update({
      session_reflection: reflectionText.trim(),
    }).eq('id', studentId)

    // 写入 session_timeline
    await writeEvent(studentId, sessionId, {
      type: 'identity_reflection',
      role: 'student',
      content: reflectionText.trim(),
      metadata: {
        triggered_by: 'end_of_class',
        has_publish_link: !!link,
      },
    })

    setReflection(reflectionText.trim())
    setSavingReflection(false)
  }

  // 全屏模式 saved 状态
  if (saved && !inline) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-lg mx-auto text-center py-8 px-4 bg-white rounded-3xl shadow-xl">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            {t('share.gameShared')}
          </h2>

          {/* 现有链接显示... */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-6 text-left">
            <p className="text-xs text-slate-400 mb-1">{t('share.yourLink')}</p>
            <a href={link} target="_blank" rel="noopener noreferrer"
               className="text-blue-500 text-sm break-all hover:underline">
              {link}
            </a>
          </div>

          {/* 新增：Identity Reflection */}
          {!reflection ? (
            <div className="mt-6 text-left">
              <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
                <p className="text-sm font-bold text-purple-700 mb-3">
                  🌟 {t('reflection.oneLastQuestion')}
                </p>
                <p className="text-sm text-purple-800 mb-3">
                  {t('reflection.prompt')}
                </p>
                <textarea
                  value={reflectionText}
                  onChange={(e) => setReflectionText(e.target.value)}
                  placeholder={t('reflection.placeholder')}
                  rows={2}
                  className="w-full border-2 border-purple-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-400 resize-none mb-3"
                />
                <button
                  onClick={handleSaveReflection}
                  disabled={!reflectionText.trim() || savingReflection}
                  className="w-full bg-purple-500 text-white rounded-xl py-2 text-sm font-bold hover:bg-purple-600 disabled:opacity-40"
                >
                  {savingReflection ? t('common.saving') : t('reflection.save')}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 bg-purple-50 border border-purple-200 rounded-xl p-4 text-left">
              <p className="text-xs text-purple-400 mb-1">{t('reflection.yourDiscovery')}</p>
              <p className="text-sm text-purple-700 italic">"{reflection}"</p>
              <p className="text-xs text-slate-400 mt-2">
                {t('reflection.willShare')}
              </p>
            </div>
          )}

          <button
            onClick={onDone}
            className="w-full bg-orange-500 text-white rounded-xl py-3 font-bold hover:bg-orange-600 transition-colors mt-4"
          >
            {t('common.done')} ✓
          </button>
        </div>
      </div>
    )
  }

  // 其他模式保持现有代码...
}
```

---

## 修改5：家长报告数据增强

### 数据读取

在 TA Dashboard 的报告生成逻辑中添加：

```javascript
// ta-dashboard/src/lib/reportData.js (新建或修改现有文件)

export async function getCognitiveBehaviorData(studentId, sessionId) {
  // 1. 预测准确率
  const { data: predictions } = await supabase
    .from('session_timeline')
    .select('metadata')
    .eq('student_id', studentId)
    .eq('session_id', sessionId)
    .eq('event_type', 'prediction_validated')

  const matchCount = predictions?.filter(p => p.metadata?.matched).length || 0
  const totalCount = predictions?.length || 0
  const accuracy = totalCount > 0 ? Math.round(matchCount / totalCount * 100) : null

  // 2. 迭代想法
  const { data: iterations } = await supabase
    .from('session_timeline')
    .select('content')
    .eq('student_id', studentId)
    .eq('session_id', sessionId)
    .eq('event_type', 'iteration_idea')
    .limit(3)

  // 3. 学生反思
  const { data: student } = await supabase
    .from('students')
    .select('session_reflection')
    .eq('id', studentId)
    .single()

  return {
    prediction: {
      accuracy,
      matchCount,
      totalCount,
    },
    iterations: iterations?.map(i => i.content) || [],
    reflection: student?.session_reflection || null,
  }
}
```

### Email 内容模板

```javascript
export function buildCognitiveBehaviorSection(data, studentName) {
  const { prediction, iterations, reflection } = data

  let html = ''

  // 预测准确率
  if (prediction.accuracy !== null) {
    html += `
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:12px;margin:8px 0;">
      <p style="margin:0 0 4px;font-size:12px;color:#16a34a;font-weight:bold;">🎯 Prediction Accuracy</p>
      <p style="margin:0;font-size:14px;color:#15803d;">
        ${studentName} correctly predicted ${prediction.matchCount} out of ${prediction.totalCount}
        game behaviors (${prediction.accuracy}%)
      </p>
    </div>`
  }

  // 迭代想法
  if (iterations.length > 0) {
    html += `
    <div style="background:#faf5ff;border:1px solid #d8b4fe;border-radius:8px;padding:12px;margin:8px 0;">
      <p style="margin:0 0 4px;font-size:12px;color:#9333ea;font-weight:bold;">💡 Improvement Ideas</p>
      <p style="margin:0;font-size:14px;color:#7e22ce;">"${iterations[0]}"</p>
    </div>`
  }

  // 学生反思
  if (reflection) {
    html += `
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px;margin:8px 0;">
      <p style="margin:0 0 4px;font-size:12px;color:#ea580c;font-weight:bold;">
        ✨ ${studentName}'s Discovery Today
      </p>
      <p style="margin:0;font-size:15px;color:#c2410c;font-style:italic;">"${reflection}"</p>
    </div>`
  }

  return html
}
```

---

## i18n 翻译键

### `src/i18n/en.json` 新增

```json
{
  "prediction": {
    "title": "Before you send to Claude...",
    "subtitle": "What do you think will appear in your game?",
    "upgrade": "Upgrade",
    "placeholder": "I think the game will show... / I predict that...",
    "sendToClaude": "Send to Claude →",
    "skip": "Skip prediction"
  },
  "validation": {
    "title": "Did your prediction come true?",
    "yourPrediction": "Your prediction was:",
    "yesMatched": "✅ Yes, it matched!",
    "noDifferent": "❌ No, it was different",
    "whyMatched": "Great prediction! Why do you think it matched?",
    "whatDifferent": "What was different from what you expected?",
    "matchedPlaceholder": "Because I described...",
    "differentPlaceholder": "I expected... but Claude made..."
  },
  "reflection": {
    "oneLastQuestion": "One last question:",
    "prompt": "Today you used language to control AI and create a real game. What's the most important thing you discovered?",
    "placeholder": "I discovered that...",
    "save": "Save my discovery",
    "yourDiscovery": "Your discovery:",
    "willShare": "Your teacher will share this with your parents. 💌"
  },
  "debug": {
    "iterationQuestion": "Nice work fixing it! 🎉 Now that it works — if you could make this feature even better or more interesting, what would you change?",
    "iterationResponse": "That's a great idea! Try telling Claude: \"{idea}\"",
    "recoveryResponse": "That's a valuable lesson! Remember this next time you build something. 🌟"
  }
}
```

### `src/i18n/zh.json` 新增

```json
{
  "prediction": {
    "title": "发送给 Claude 之前...",
    "subtitle": "你觉得游戏里会出现什么？",
    "upgrade": "升级",
    "placeholder": "我觉得游戏会出现... / 我预测...",
    "sendToClaude": "发送给 Claude →",
    "skip": "跳过预测"
  },
  "validation": {
    "title": "你的预测实现了吗？",
    "yourPrediction": "你的预测是：",
    "yesMatched": "✅ 是的，一样！",
    "noDifferent": "❌ 不是，不一样",
    "whyMatched": "预测得很准！你觉得为什么会准？",
    "whatDifferent": "和你想的有什么不一样？",
    "matchedPlaceholder": "因为我描述了...",
    "differentPlaceholder": "我以为会... 但 Claude 做成了..."
  },
  "reflection": {
    "oneLastQuestion": "最后一个问题：",
    "prompt": "今天你用语言控制 AI 创造了一个真正的游戏。你最重要的发现是什么？",
    "placeholder": "我发现...",
    "save": "保存我的发现",
    "yourDiscovery": "你的发现：",
    "willShare": "老师会把这个分享给你的父母。💌"
  },
  "debug": {
    "iterationQuestion": "修好啦！🎉 现在它能用了——如果你能让这个功能更好或更有趣，你会怎么改？",
    "iterationResponse": "好想法！试着告诉 Claude：「{idea}」",
    "recoveryResponse": "这是很有价值的经验！下次做东西时记住它。🌟"
  }
}
```

---

## 实施顺序

| 步骤 | 内容 | 工期 | 依赖 | 状态 |
|------|------|------|------|------|
| **Step 1** | ShareGame 反思 + students 表加字段 | 1.5h | 无 | ✅ 完成 |
| **Step 2** | i18n 翻译键 | 0.5h | 无 | ✅ 完成 |
| **Step 2a** | DebugChat resolved 逻辑 | 2h | 无 | ✅ 完成 |
| **Step 3** | Debug Iteration 问题 | 1h | Step 2, 2a | ✅ 合并到 Step 2a |
| **Step 4** | Reset Phase 2 Prompt 修改 | 1.5h | 无 | ✅ 合并到 Step 2a |
| **Step 5** | 家长报告数据增强 | 1.5h | Step 1, 3 | ✅ 完成 |
| **Step 6** | Prediction/Validation 组件 | 3.5h | Step 2 | ✅ 完成 |
| **总计** | | **11.5h** | | |

### 执行前的准备工作

**Step 4 执行前，需要先确认 Reset prompt 位置：**

```bash
# 在 student-app 目录执行
grep -rn "reset_phase\|phase1\|debug_reset" src/
grep -rn "buildSystemPrompt" src/components/DebugChat.jsx
```

**Step 6 执行前，需要确认 App.jsx 里的 upgrade 追踪逻辑：**

```bash
grep -rn "activeUpgrade\|currentUpgrade\|upgradeId" src/App.jsx
```

---

## 验证清单

### Step 1: ShareGame 反思
- [ ] 保存链接成功后显示反思问题
- [ ] 学生写反思 → 保存到 `students.session_reflection`
- [ ] 写入 `session_timeline` (type: identity_reflection)
- [ ] 显示「老师会分享给父母」提示
- [ ] Done 按钮正常工作
- [ ] Skip 按钮允许跳过

### Step 2a: DebugChat resolved 逻辑（新增）
- [ ] 学生从 Claude 返回后显示 "Welcome back"
- [ ] `awaitingResolution` 状态正确设置
- [ ] 学生回复 "yes/worked/修好了" → 识别为确认
- [ ] 调用 `handleResolutionConfirmed()`
- [ ] `debug_sessions.resolved=true` 正确写入
- [ ] 学生回复 "no/still broken" → 继续调试流程

### Step 3: Debug Iteration
- [ ] resolved 确认后自动追加 iteration 问题
- [ ] `isIterationPrompt: true` 标记正确设置
- [ ] 学生回复 iteration 问题 → 调用 `handleIterationResponse()`
- [ ] 写入 `session_timeline` (type: iteration_idea)
- [ ] 收尾消息显示学生的想法

### Step 4: Reset Phase 2（Recovery Training）
- [ ] 新建 `debugResetPhase2Prompt.js`
- [ ] `handleResolutionConfirmed()` 区分 Reset vs 普通 Fix 场景
- [ ] Reset 场景显示 "你学到了什么" 问题
- [ ] `isRecoveryPrompt: true` 标记正确设置
- [ ] 学生说「不知道」→ 给基于 keptCount 的提示（recoveryHint）
- [ ] 写入 `session_timeline` (type: recovery_insight)
- [ ] 收尾消息显示 recoveryResponse

### Step 5: 家长报告
- [x] getCognitiveBehaviorData() 从 session_timeline 读取
- [x] 预测准确率显示（有数据时）
- [x] 迭代想法显示
- [x] 学生反思大字体显示
- [x] 无数据时不显示空框（hasCognitiveBehaviorData 检查）
- [x] ReportGenerator 集成 cognitive behavior section

### Step 6: Prediction/Validation
- [ ] Upgrade.jsx 接收 studentId, sessionId, onPredictionMade props
- [ ] copyText() 函数修改为先显示 PredictionPrompt
- [ ] PredictionPrompt 组件正确渲染
- [ ] Skip 按钮允许跳过
- [ ] Confirm 后写入 timeline (type: prediction_made)
- [ ] onPredictionMade 回调正确传递到 App.jsx
- [ ] App.jsx 设置 pendingValidation 状态
- [ ] 学生返回 Prompt Tab → ValidationCheck 弹出
- [ ] Yes/No 按钮 → 写入 timeline (type: prediction_validated)
- [ ] 反思问题有 Skip

---

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/PredictionPrompt.jsx` | **新建** | 预测弹窗 |
| `src/components/ValidationCheck.jsx` | **新建** | 验证弹窗 |
| `src/components/ShareGame.jsx` | 修改 | 添加反思步骤 |
| `src/components/DebugChat.jsx` | 修改 | AI 判断 resolved + Iteration/Recovery 分支 |
| `src/lib/prompts/resolutionJudgePrompt.js` | **新建** | AI 判断学生是否确认修好 |
| `src/components/Upgrade.jsx` | 修改 | 接入 Prediction 流程（Copy 按钮在这里） |
| `src/App.jsx` | 修改 | 管理 Validation 状态 + 传递 props 给 Upgrade |
| `src/lib/prompts/debugResetPhase2Prompt.js` | **新建** | Reset Phase 2 问答（Recovery Training） |
| `src/i18n/en.json` | 修改 | 新增翻译键 |
| `src/i18n/zh.json` | 修改 | 新增翻译键 |
| `ta-dashboard/src/lib/reportData.js` | 新建/修改 | 认知行为数据读取 |
| **SQL** | ALTER TABLE | `students.session_reflection` |

### 已确认的文件位置

| 文件 | 内容 |
|------|------|
| `src/lib/prompts/debugCodeToolPrompt.js` | `buildResetToolPrompt()` - Reset Phase 1 |
| `src/lib/prompts/debugOrchestratorPrompt.js` | 路由到 `reset_tool` 的决策逻辑 |
| `src/components/DebugChat.jsx:641` | `buildSystemPrompt()` 调用 prompt builder |
| `src/components/DebugChat.jsx:661` | `debug_reset_phase1` 模式处理 |

---

*Created: 2025-06-04*
*Based on 认知对抗系统行为理论重设计*
