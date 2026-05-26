# V17 Phase B 架构集成指南

## 集成状态

| 组件 | 状态 | 说明 |
|------|------|------|
| **DebugChat.jsx** | ✅ 已完成 | RoundCounter + preCheckInput + 路由标记 |
| **AgentPanel.jsx (Gate 1)** | ✅ 已完成 | RoundCounter + preCheckInput |
| **AgentPanel.jsx (Gate 2)** | ✅ 已完成 | 空输入验证 |
| **AgentBridge.js** | ✅ 已完成 | invalidateTimelineCache 同步刷新 |
| **数据库 Schema** | ✅ 已执行 | session_timeline, session_summaries, student_profiles |
| **Edge Function** | ✅ 已部署 | compress-session (2026-05-26) |
| **TA Dashboard** | ✅ 已完成 | End Class 调用 compress-session |

## 新模块概览

### 核心原则

```
需要读懂意思 → 模型
不需要读懂意思 → 代码
```

### 文件清单

| 文件 | 职责 | 状态 |
|------|------|------|
| `agentGuards.js` | 代码层判断（round 计数、输入验证、最大轮次） | ✅ 已创建 |
| `agentCaller.js` | 调用层（整合预检、API 调用、后处理） | ✅ 已创建 |
| `prompts/*.js` | 模型层 System Prompt | ✅ 已创建 |
| `timeline.js` | 时间线读写和格式化 | ✅ 已创建 |
| `conversationHistory.js` | 对话历史管理 | ✅ 已创建 |

---

## 集成步骤

### Step 1: 在 DebugChat.jsx 中使用新架构

```javascript
// 导入新模块
import { RoundCounter } from '../lib/agentGuards';
import { callAgent } from '../lib/agentCaller';
import { buildOrchestratorPrompt, buildPromptToolPrompt, buildCodeToolPrompt } from '../lib/prompts';
import { addRouteMarker, compressTool, compressChat } from '../lib/conversationHistory';
import { writeDebugToolSwitch, writeDebugComplete, formatForDebug, getTimeline } from '../lib/timeline';

// 在组件内使用 RoundCounter
const roundCounter = useRef(new RoundCounter());

// 替换 callDebugAgent
const handleSend = async () => {
  // ... 省略输入验证 ...

  // 获取时间线上下文
  const timeline = await getTimeline(studentId, sessionId);
  const contextString = formatForDebug(timeline, currentPrompt);

  // 构建 System Prompt
  let systemPrompt;
  if (currentMode === 'debug_orchestrator') {
    systemPrompt = buildOrchestratorPrompt(contextString, roundCounter.current.get(), qState);
  } else if (currentMode === 'debug_prompt') {
    systemPrompt = buildPromptToolPrompt(contextString, bugSummary, roundCounter.current.get(), 5);
  } else if (currentMode === 'debug_code') {
    systemPrompt = buildCodeToolPrompt(contextString, bugSummary, roundCounter.current.get(), 4);
  }

  // 调用 Agent
  const response = await callAgent({
    mode: currentMode,
    userInput: inputText,
    currentRound: roundCounter.current.get(),
    systemPrompt,
    conversationHistory: messages,
  });

  // 更新 round
  if (response.continue) {
    roundCounter.current.increment();
  } else {
    roundCounter.current.reset();
  }

  // ... 处理响应 ...
};

// 路由切换时
const handleRoute = async (route, bugSummary) => {
  // 写入时间线
  await writeDebugToolSwitch(studentId, sessionId, route, bugSummary, lessonType);
  // 添加路由标记
  setMessages(prev => addRouteMarker(prev, route, bugSummary));
  // 重置 round
  roundCounter.current.reset();
  // 切换模式
  setCurrentMode(route);
};
```

### Step 2: 在 AgentPanel.jsx 中使用新架构

```javascript
// 导入新模块
import { RoundCounter } from '../lib/agentGuards';
import { callAgent } from '../lib/agentCaller';
import { buildGate1Prompt, buildGate1MediumPrompt, buildGate1HardPrompt } from '../lib/prompts';
import { writeGate1Round, writeGate1Complete, formatForGate1, getTimeline } from '../lib/timeline';

// 在组件内使用 RoundCounter
const gateRoundCounter = useRef(new RoundCounter());

// Gate 1 发送消息
const sendGate1Message = async (studentInput) => {
  const currentRound = gateRoundCounter.current.get();
  const maxRounds = getMaxRounds(`gate1_${upgrade.level}`);

  // 获取时间线上下文
  const timeline = await getTimeline(studentId, sessionId);
  const contextString = formatForGate1(timeline, lesson.agent?.demo_description, currentPrompt);

  // 选择合适的 prompt 构建函数
  let systemPrompt;
  if (upgrade.level === 'medium') {
    systemPrompt = buildGate1MediumPrompt(contextString, upgrade, currentRound, maxRounds);
  } else if (upgrade.level === 'hard') {
    systemPrompt = buildGate1HardPrompt(contextString, upgrade, currentRound, maxRounds);
  } else {
    systemPrompt = buildGate1Prompt(contextString, upgrade, currentRound, maxRounds);
  }

  // 调用 Agent
  const response = await callAgent({
    mode: `gate1_${upgrade.level}`,
    userInput: studentInput,
    currentRound,
    systemPrompt,
    conversationHistory: messages,
  });

  // 写入时间线
  await writeGate1Round(studentId, sessionId, upgrade.id, currentRound, studentInput, response.scores, lessonType);

  // 更新 round
  if (response.continue) {
    gateRoundCounter.current.increment();
  }

  // 放行判断
  if (!response.continue || response.forceReleased) {
    await handleGate1Complete(response);
  }
};
```

### Step 3: 修改 AgentBridge.js

```javascript
// 替换 buildStudentContext 的使用
import { getTimeline, formatForGate1, formatForGate2, formatForDebug, invalidateCache } from './timeline';

// 在 trigger 函数中
async function handleUpgradeStarted(upgradeId, difficulty) {
  invalidateCache();
  const timeline = await getTimeline(_studentId, _sessionId);
  const contextString = formatForGate1(
    timeline,
    _lesson.agent?.demo_description,
    getCurrentPrompt()
  );
  _onOpenPanel({
    mode: 'gate1',
    contextString,  // 新增
    upgrade,
    sessionRecordId: record.id,
  });
}
```

---

## 验证检查点

### 代码层验证
- [ ] 「ok/yes/sure」→ 直接追问，不调用 API
- [ ] 少于 3 个词 → 直接追问，不调用 API
- [ ] round 计数由代码递增，不受模型返回值影响
- [ ] 路由切换时 round 重置为 1
- [ ] 超过最大轮次 → 强制 continue:false

### 模型层验证
- [ ] 学生一轮说清楚 → 模型 all_covered:true → 立刻放行
- [ ] 「very fast」被模型识别为 speed 维度覆盖
- [ ] fix_quality「move around」→ vague
- [ ] fix_quality「patrol left and right every 2 seconds」→ precise

### 架构验证
- [ ] Debug Agent 能引用 Gate 1 best_quote
- [ ] JSON 失败率 < 1/10
- [ ] 对话历史 trim 后 < 600 tokens

---

## 数据库迁移

执行 `v17-phase-b-schema.sql` 创建三张新表：
- `session_timeline`
- `session_summaries`
- `student_profiles`

## Edge Function 部署

```bash
cd Trial_Class_System
supabase functions deploy compress-session
```

---

## 回滚方案

如果需要回滚，可以：
1. 注释掉新模块的导入
2. 恢复原有的 API 调用逻辑
3. 新模块是独立的，不影响现有功能

---

## 下一步

1. 在 DebugChat.jsx 中逐步替换 callDebugAgent
2. 在 AgentPanel.jsx 中逐步替换 sendGate1Message
3. 在 ta-dashboard 的 End Class 按钮中调用 compress-session
4. 监控 JSON 解析成功率和 round 计数准确性
