# Debug Multi-Agent 系统 — Claude Code 执行指令

## 背景

student-app 现有 Debug Tab 是静态的 fix prompt 列表，无法处理学生真实遇到的 bug。
需要替换为三个 Agent 组成的 Debug 系统，通过认知对抗引导学生自己描述 bug、理解原因、写修复指令。

**核心原则：学生写，Agent检查。Agent永远不替学生写修复指令。**

---

## 整体架构

```
学生打开 Debug Tab
        ↓
Debug Orchestrator（分类，最多4轮）
        ↓
   ┌────┼─────┐
   ↓    ↓     ↓
Prompt Code Reset
Tool  Tool  Tool
   ↓    ↓     ↓
执行层（学生自己写修复指令）
        ↓
验证层（返回后确认结果）
        ↓
debug_sessions 写入
TA Dashboard 更新
```

---

## 需要修改的文件

| 文件 | 操作 |
|---|---|
| `student-app/src/components/AgentPanel.jsx` | 新增三种 debug mode |
| `student-app/src/lib/AgentBridge.js` | 新增 triggerDebug / routeDebug / triggerDebugVerification |
| `student-app/src/App.jsx` | 新增 pendingVerification 状态 |
| `supabase` | 新建 debug_sessions 表 |

---

## Part 1：数据库

### 新建 debug_sessions 表

```sql
CREATE TABLE debug_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),

  -- 分类（Orchestrator写入）
  bug_type text NOT NULL,           -- 'prompt' | 'code' | 'reset'
  severity text,                    -- 'light' | 'heavy'
  related_upgrade_id text,          -- A类专用：相关Upgrade

  -- 症状描述（追问层写入）
  bug_description text,             -- 精确症状描述
  trigger_condition text,           -- B类专用：触发条件

  -- A类（Prompt Tool）专用
  root_cause text,                  -- 学生说出的原因
  student_understood boolean,
  fix_quality text,                 -- 'vague' | 'specific' | 'precise'

  -- B类（Code Tool）专用
  -- （无额外字段，行为描述在执行层）

  -- C类（Reset Tool）专用
  kept_upgrades jsonb,              -- 学生选择保留的Upgrade列表
  reset_insight text,               -- Phase 2学生说出的反思

  -- 执行层（学生自己写的）
  final_fix_prompt text,            -- Prompt Tool：学生写的修复描述
  final_fix_request text,           -- Code Tool：学生写的功能级修复指令
  final_new_prompt text,            -- Reset Tool：学生写的新prompt
  execution_attempts int DEFAULT 0, -- 执行了几次

  -- 验证层
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  needs_ta_help boolean DEFAULT false,

  -- 报告素材
  best_debug_quote text,
  insight_note text
);

CREATE INDEX idx_debug_student ON debug_sessions(student_id);
CREATE INDEX idx_debug_unresolved
  ON debug_sessions(student_id, resolved)
  WHERE resolved = false;

ALTER TABLE debug_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_debug_sessions" ON debug_sessions
  FOR ALL USING (true) WITH CHECK (true);
```

---

## Part 2：AgentBridge.js 新增函数

在现有 AgentBridge.js 末尾添加以下函数：

```javascript
/**
 * Debug Context构建
 * 读取学生所有相关数据，注入Debug Agent
 */
async function buildDebugContext(studentId) {
  const { data: agentSessions } = await supabase
    .from('agent_sessions')
    .select('target_upgrade_id, target_upgrade_label, best_student_quote, upgrade_appeared, gate2_failure_type')
    .eq('student_id', studentId)
    .eq('gate1_completed', true)

  const { data: recentDebug } = await supabase
    .from('debug_sessions')
    .select('bug_description, root_cause, resolved, bug_type')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
    .limit(3)

  const { data: successfulUpgrades } = await supabase
    .from('agent_sessions')
    .select('target_upgrade_id, target_upgrade_label')
    .eq('student_id', studentId)
    .eq('upgrade_appeared', true)

  return {
    upgradeSummaries: (agentSessions || []).map(s => ({
      upgradeId: s.target_upgrade_id,
      upgrade: s.target_upgrade_label,
      studentSaid: s.best_student_quote,
      appearedInGame: s.upgrade_appeared,
      failureType: s.gate2_failure_type,
    })),
    recentBugs: recentDebug || [],
    successfulUpgrades: successfulUpgrades || [],
    currentPrompt: getCurrentPrompt(),
  }
}

/**
 * Debug Tab打开时触发
 */
export async function triggerDebug() {
  if (!_studentId || !_onOpenPanel) return

  const context = await buildDebugContext(_studentId)

  _onOpenPanel({
    mode: 'debug_orchestrator',
    studentContext: context,
    currentPrompt: getCurrentPrompt(),
  })
}

/**
 * Orchestrator完成分类后路由
 */
export async function routeDebug(route, bugSummary, relatedUpgrade, orchestratorSessionId) {
  const context = await buildDebugContext(_studentId)

  if (route === 'prompt_tool') {
    _onOpenPanel({
      mode: 'debug_prompt',
      studentContext: context,
      bugSummary,
      relatedUpgrade,
      orchestratorSessionId,
    })
  } else if (route === 'code_tool') {
    _onOpenPanel({
      mode: 'debug_code',
      studentContext: context,
      bugSummary,
      orchestratorSessionId,
    })
  } else if (route === 'reset_tool') {
    _onOpenPanel({
      mode: 'debug_reset_phase1',
      studentContext: context,
      bugSummary,
      orchestratorSessionId,
    })
  }
}

/**
 * Debug执行后返回，触发验证
 */
export async function triggerDebugVerification(pendingVerification) {
  const { type, debugSessionId } = pendingVerification
  const context = await buildDebugContext(_studentId)

  if (type === 'reset') {
    // Reset直接触发Phase 2认知反思
    _onOpenPanel({
      mode: 'debug_reset_phase2',
      studentContext: context,
      debugSessionId,
    })
  } else {
    // Prompt Fix / Code Fix验证
    _onOpenPanel({
      mode: 'debug_verify',
      type,
      studentContext: context,
      debugSessionId,
    })
  }
}
```

---

## Part 3：App.jsx 新增状态

在 App.jsx 现有状态下方添加：

```javascript
// Debug 状态
const [pendingVerification, setPendingVerification] = useState(null)
// null = 正常，prompt_tab_revisited走Gate 2
// { type, debugSessionId } = Debug执行后等待验证

// Debug Tab打开时触发
const handleDebugTabOpen = () => {
  agentBridge.triggerDebug()
}

// Debug Tool执行层完成（学生点「去生成/去发送/去重新生成」）
const handleDebugToolComplete = (type, debugSessionId) => {
  setPendingVerification({ type, debugSessionId })
}

// 修改现有的 prompt_tab_revisited 处理
const handlePromptTabRevisited = async () => {
  if (pendingVerification) {
    agentBridge.triggerDebugVerification(pendingVerification)
    setPendingVerification(null)
  } else {
    agentBridge.trigger('prompt_tab_revisited')
  }
}
```

在 Debug Tab 的 tab 切换逻辑里，加入 `handleDebugTabOpen` 调用。

---

## Part 4：AgentPanel.jsx 新增六种 Debug Mode

在现有 gate1 / gate2 / gate1_resume 之外，新增以下六种 mode。

### Mode 1：debug_orchestrator

**System Prompt：**

```
你是一个Debug分诊员。用最少的问题判断bug类型，然后路由。
不做修复，只做分类。最多4轮对话。

【分类决策树 — 严格按顺序】
Q1：「游戏还能运行吗？还是直接崩溃/卡死了？」
  崩溃/卡死 → 立刻路由 reset_tool，不继续问

Q2：「这个问题是一个功能不对，还是好几个地方都坏了？」
  好几处 → 路由 reset_tool

Q3：「这个功能完全没出现，还是出现了但行为不对？」
  完全没出现 → 路由 prompt_tool

Q4：「它做的和你想要的，是方向完全相反，还是大概对但细节错？」
  方向完全相反 / 感觉Claude在猜 → 路由 prompt_tool
  大概对但细节错 → 路由 code_tool

【路由原则】
- 崩溃 → 立刻reset，不浪费时间
- 多处损坏 → reset
- 没出现 / 方向反 → prompt
- 细节错 → code
- 不确定 → 倾向prompt（描述问题更常见）

【返回格式 — 严格JSON】
{
  "next_question": "下一个问题",
  "route": "prompt_tool" | "code_tool" | "reset_tool" | "pending",
  "severity": "light" | "heavy",
  "bug_summary": "一句话总结bug（路由时填入）",
  "related_upgrade": "相关Upgrade名字或null"
}

【Student Context】
已完成Upgrade：{upgradeSummaries}
Gate 2记录：{gate2Results}
当前prompt：{currentPrompt}
对话历史：{conversationHistory}
```

**完成回调：**
```javascript
onComplete: async (result) => {
  if (result.route !== 'pending') {
    // 创建debug_sessions记录
    const { data: record } = await supabase
      .from('debug_sessions')
      .insert({
        student_id: studentId,
        session_id: sessionId,
        bug_type: result.route === 'reset_tool' ? 'reset'
                : result.route === 'code_tool' ? 'code' : 'prompt',
        severity: result.severity,
        related_upgrade_id: result.related_upgrade,
        bug_description: result.bug_summary,
      })
      .select().single()

    agentBridge.routeDebug(
      result.route,
      result.bug_summary,
      result.related_upgrade,
      record.id
    )
  }
}
```

---

### Mode 2：debug_prompt（A类 — 描述不精确）

**完整轮次结构：Round 1 → Round 2 → Round 3 → Round 4（执行层）**

**System Prompt：**

```
你是一个Prompt修复教练。学生的prompt描述不够精确，导致Claude猜错了意图。
帮学生发现gap，让他自己写出精确描述。不替他写。

【四轮结构】

Round 1：精确描述bug
- 不接受：「游戏坏了」「不对劲」「有问题」
- 必须追问到：[什么东西] + [发生了什么] + [应该发生什么]
- bug_specificity ≥ 2 才进入Round 2

Round 2：理解原因
- 必须引用Gate 1 Context
  如果有相关best_student_quote：
    「你在设计时说过『{quote}』——你的prompt里有这句话吗？」
  如果没有相关Context：
    「你的prompt里有没有告诉Claude [功能] 要怎么 [行为]？」
- 不直接说原因，只问问题
- student_understood = true 才进入Round 3

Round 3：说出缺少什么
- 「你知道缺了什么——是哪部分描述没有告诉Claude？」
- 学生能说出具体缺少的描述 → 进入Round 4
- 学生说不出 → 继续追问（最多2次）

Round 4：写修复指令（执行层）
- 「试着写一句话告诉Claude要修什么，要怎么修」
- 检查两件事：
  1. prompt_executable：Claude看了能执行吗？
     ❌ 「Fix the trap」
     ✅ 「Fix the moving trap: it should patrol left and right every 2 seconds」
  2. context_complete：Claude知道是哪个功能吗？
     ❌ 「Make it faster」
     ✅ 「Make the moving trap patrol faster: every 1 second instead of 3」
- 两个都true → 放行
- 追问最多2次，还是不行 → 给句式框架：
  「试着用这个格式：Fix [功能名]: [期望行为]」
  （框架是脚手架，学生还是要填内容）

【返回格式 — 严格JSON】
{
  "next_question": "下一个问题",
  "round": 1 | 2 | 3 | 4,
  "continue": true | false,
  "scores": {
    "bug_specificity": 0-3,
    "understanding_depth": 0-3,
    "prompt_executable": true | false,
    "context_complete": true | false
  },
  "best_debug_quote": "这轮最精确的一句学生原话",
  "insight_note": "学生学到了什么",
  "final_fix_prompt": "Round 4放行时学生写的完整修复指令"
}

【Student Context】
Upgrade Gate 1记录：{upgradeSummaries}
当前prompt：{currentPrompt}
bug摘要：{bugSummary}
对话历史：{conversationHistory}
当前轮次：Round {roundNumber}
```

**Round 4放行后UI：**
```jsx
// 显示学生自己写的修复指令
<div className="bg-green-50 border border-green-200 rounded-xl p-4">
  <p className="text-sm font-bold text-green-800 mb-2">✅ 把这句话加进你的prompt，然后重新生成：</p>
  <div className="bg-white border rounded-lg p-3 text-sm font-mono">
    {finalFixPrompt}  {/* 学生自己写的 */}
  </div>
  <div className="flex gap-2 mt-3">
    <Button onClick={handleCopy}>Copy</Button>
    <Button onClick={() => handleToolComplete('prompt_fix', debugSessionId)}>
      去生成 →
    </Button>
  </div>
</div>
```

**完成回调：**
```javascript
onComplete: async (result) => {
  await supabase.from('debug_sessions').update({
    root_cause: result.root_cause,
    student_understood: result.student_understood,
    fix_quality: result.fix_quality,
    final_fix_prompt: result.final_fix_prompt,
    best_debug_quote: result.best_debug_quote,
    insight_note: result.insight_note,
  }).eq('id', debugSessionId)
}
```

---

### Mode 3：debug_code（B类 — 代码有bug）

**完整轮次结构：Round 1 → Round 2 → Round 3（执行层）**

**System Prompt：**

```
你是一个代码Bug症状提取器。
学生遇到的是Claude生成的代码里的bug，不是prompt描述问题。
帮学生精确描述症状和触发条件，然后让学生写功能级修复指令。

【三轮结构】

Round 1：症状描述
- 目标：[什么东西] + [发生了什么] + [什么情况下发生]
- 不接受模糊描述
- symptom_specificity ≥ 2 才进入Round 2

Round 2：复现条件
- 「你怎么触发这个bug的？每次都这样吗？」
- reproducible = true → 进入Round 3
- reproducible = false → 「什么情况下会发生？」

Round 3：写功能级修复指令（执行层）
- 「试着写一句话告诉Claude期望的正确行为」
- 目标：描述「它应该怎样」，不是「代码哪里错了」
  ❌ 技术指令：「Fix the collision detection on line 47」
  ✅ 功能级指令：「Fix the moving trap: it should stop at the wall and reverse direction instead of passing through」
- 检查两件事：
  1. behavior_described：说清楚期望行为了吗？
  2. feature_identified：Claude知道是哪个功能要修吗？
- 两个都true → 放行
- 追问最多2次，还是不行 → 给句式框架：
  「试着用这个格式：Fix [功能名]: it should [期望行为] instead of [现在的错误行为]」

【重要：不引用Gate 1 Context】
B类bug和设计意图无关，不要引用best_student_quote。

【返回格式 — 严格JSON】
{
  "next_question": "下一个问题",
  "round": 1 | 2 | 3,
  "continue": true | false,
  "scores": {
    "symptom_specificity": 0-3,
    "reproducible": true | false,
    "behavior_described": true | false,
    "feature_identified": true | false
  },
  "best_debug_quote": "最精确的症状描述",
  "insight_note": "学生学到了什么",
  "final_fix_request": "Round 3放行时学生写的功能级修复指令"
}

【Student Context】
当前prompt：{currentPrompt}
bug摘要：{bugSummary}
对话历史：{conversationHistory}
当前轮次：Round {roundNumber}
```

**Round 3放行后UI（和Prompt Tool一致的设计语言）：**
```jsx
<div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
  <p className="text-sm font-bold text-blue-800 mb-2">✅ 把这句话发给Claude让它修复：</p>
  <div className="bg-white border rounded-lg p-3 text-sm font-mono">
    {finalFixRequest}  {/* 学生自己写的功能级修复指令 */}
  </div>
  <div className="flex gap-2 mt-3">
    <Button onClick={handleCopy}>Copy</Button>
    <Button onClick={() => handleToolComplete('code_fix', debugSessionId)}>
      去发送 →
    </Button>
  </div>
</div>
```

---

### Mode 4：debug_reset_phase1（C类 — 推倒重来，恢复阶段）

**完整步骤：Step 1（确认）→ Step 2（选择保留功能）→ Step 3（学生写新prompt）**

**System Prompt：**

```
你是一个Reset引导者。学生的游戏太难修了，需要重新生成。
快速帮学生保留成功的部分，引导他写新prompt。保持轻松语气，不评判。

【三步流程】

Step 1：确认
  「有时候重新开始比修复更快。你想保留哪些之前做好的功能？」
  不说「你的游戏坏了」——降低挫败感

Step 2：展示可保留功能
  展示 successfulUpgrades 列表（upgrade_appeared=true的）
  学生勾选想保留的功能
  → 进入Step 3

Step 3：学生写新prompt（执行层）
  「试着写一个完整的游戏描述，包含你选择的功能」
  展示学生选择的功能列表作为参考（不是模板）

  检查三件事：
  1. has_base_game：有没有描述基本游戏类型？
     ❌ 只写了功能，没有描述游戏本身
     ✅ 「Create a maze game where...」
  2. features_missing：选择保留的功能都写进去了吗？
     没写 → 「你选择保留了[X]，但你的描述里没有写它——要加上去吗？」
  3. executable：Claude看了能生成游戏吗？

  全部通过 → 放行

【语气原则】
- 「重新开始」不是失败，是工程师的正常选择
- 不说「你的游戏坏了」「你出了问题」

【返回格式 — 严格JSON】
{
  "message": "给学生看的话",
  "step": 1 | 2 | 3,
  "show_upgrade_selector": true | false,
  "continue": true | false,
  "scores": {
    "has_base_game": true | false,
    "features_covered": ["功能1"],
    "features_missing": ["功能2"],
    "executable": true | false
  },
  "final_new_prompt": "Step 3放行时学生写的完整新prompt"
}

【Student Context】
已验证成功的Upgrade（upgrade_appeared=true）：{successfulUpgrades}
原始基础prompt：{basePrompt}
对话历史：{conversationHistory}
```

**Step 3放行后UI：**
```jsx
<div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
  <p className="text-sm font-bold text-purple-800 mb-2">✅ 新prompt准备好了！</p>
  <div className="bg-white border rounded-lg p-3 text-sm font-mono">
    {finalNewPrompt}  {/* 学生自己写的 */}
  </div>
  <div className="flex gap-2 mt-3">
    <Button onClick={handleCopy}>Copy</Button>
    <Button onClick={() => handleToolComplete('reset', debugSessionId)}>
      去重新生成 →
    </Button>
  </div>
</div>
```

---

### Mode 5：debug_reset_phase2（C类 — 认知反思阶段）

学生重新生成游戏后返回触发。

**System Prompt：**

```
你是一个反思引导者。学生刚重新生成了游戏。
温和地帮学生理解为什么上次需要重来。不强制。

【流程】
Step 1：确认游戏好了
  「新游戏跑起来了吗？」

Step 2（游戏好了）：轻量反思
  「你知道为什么上次的游戏需要重新开始吗？」

  学生能说出原因 → 记录insight，放行
  学生说不知道 → 给一个提示（不是答案）：
    「你这次保留了[X]个功能，上次有[Y]个——你觉得功能太多会有什么问题？」
  学生不想反思 → 直接放行，不强制

【语气】好奇，不批评。「你知道吗」不是「你做错了」。

【返回格式 — 严格JSON】
{
  "message": "给学生看的话",
  "continue": true | false,
  "insight_note": "学生理解了什么",
  "skipped": false
}

【Student Context】
Reset保留的功能数：{keptUpgradesCount}
上次的功能总数：{previousUpgradesCount}
对话历史：{conversationHistory}
```

---

### Mode 6：debug_verify（验证层）

Debug执行后返回，验证是否修好了。

**处理逻辑（不需要完整System Prompt，用简单规则）：**

```javascript
// AgentPanel里的验证逻辑
const handleDebugVerify = async ({ type, debugSessionId, studentContext }) => {
  if (type === 'prompt_fix') {
    // 问：修复描述加进去重新生成了——功能现在对了吗？
    showVerifyQuestion('你加了修复描述，重新生成了——功能现在是你想要的样子吗？')
  } else if (type === 'code_fix') {
    // 问：发了修复请求——bug消失了吗？
    showVerifyQuestion('你发了修复请求——bug消失了吗？')
  }
}

const handleVerifyResponse = async (resolved, debugSessionId, type) => {
  if (resolved) {
    await supabase.from('debug_sessions').update({
      resolved: true,
      resolved_at: new Date().toISOString(),
    }).eq('id', debugSessionId)
    showSuccessMessage('✅ 修好了！')
  } else {
    // 失败处理
    const { data: session } = await supabase
      .from('debug_sessions')
      .select('execution_attempts')
      .eq('id', debugSessionId)
      .single()

    const attempts = (session?.execution_attempts || 0) + 1
    await supabase.from('debug_sessions')
      .update({ execution_attempts: attempts })
      .eq('id', debugSessionId)

    if (attempts >= 2) {
      // 修了2次还没解决 → 自动路由Reset
      agentBridge.routeDebug('reset_tool',
        '修了多次仍未解决，需要重新开始',
        null, debugSessionId)
    } else if (type === 'code_fix') {
      // Code Fix失败一次 → 直接路由Reset
      agentBridge.routeDebug('reset_tool',
        'code fix未能解决', null, debugSessionId)
    } else {
      // Prompt Fix失败 → 重新路由Orchestrator
      agentBridge.triggerDebug()
    }
  }
}
```

---

## Part 5：TA Dashboard 新增信号

在 `ta-dashboard/src/components/StudentCard.jsx` 新增 Debug 信号显示：

```jsx
// 从 debug_sessions 查询该学生数据
const debugStats = {
  promptFixed: debugSessions.filter(d => d.bug_type === 'prompt' && d.resolved).length,
  codeFixed: debugSessions.filter(d => d.bug_type === 'code' && d.resolved).length,
  resets: debugSessions.filter(d => d.bug_type === 'reset').length,
  unresolved: debugSessions.filter(d => !d.resolved).length,
  needsHelp: debugSessions.some(d => d.needs_ta_help),
}

// 显示
{debugStats.needsHelp && (
  <div className="bg-red-100 border border-red-300 rounded px-2 py-1 text-xs text-red-700 font-bold">
    ⚠️ 需要TA介入
  </div>
)}
<div className="text-xs text-slate-500 mt-1">
  {debugStats.promptFixed > 0 && `🐛 prompt×${debugStats.promptFixed} `}
  {debugStats.codeFixed > 0 && `🔧 code×${debugStats.codeFixed} `}
  {debugStats.resets > 0 && `🔄 reset×${debugStats.resets} `}
  {debugStats.unresolved > 0 && `⚠️ 未解决×${debugStats.unresolved}`}
</div>
```

**needs_ta_help触发条件：**
```javascript
// 在验证层写入
if (attempts >= 2) {
  await supabase.from('debug_sessions').update({
    needs_ta_help: true
  }).eq('id', debugSessionId)
}
```

---

## 完整验证检查点

### Orchestrator
- [ ] Debug Tab打开 → 立刻出现，问「你遇到了什么问题？」
- [ ] 游戏崩溃 → 立刻路由Reset，不继续问
- [ ] 多处损坏 → 路由Reset
- [ ] 功能没出现 / 方向反 → 路由Prompt
- [ ] 功能细节错 → 路由Code
- [ ] 最多4轮完成分类
- [ ] 路由时创建 debug_sessions 记录

### Prompt Tool
- [ ] Round 1：模糊回答追问三要素
- [ ] Round 2：有Gate 1 Context时引用best_student_quote
- [ ] Round 4：学生自己写修复指令，「Fix the trap」→ 追问具体
- [ ] Round 4：2次后给句式框架「Fix [功能]: [期望行为]」
- [ ] 放行：显示学生自己写的文字（不是Agent写的）
- [ ] 学生点「去生成」→ pendingVerification记录

### Code Tool
- [ ] Round 1：追问症状三要素
- [ ] Round 2：追问触发条件
- [ ] Round 3：学生写功能级修复指令（不是技术指令）
- [ ] Round 3：「Fix the bug」→ 追问期望行为
- [ ] 放行：显示学生自己写的功能级修复指令
- [ ] 不引用Gate 1 Context

### Reset Tool
- [ ] Phase 1 Step 2：展示upgrade_appeared=true的Upgrade列表
- [ ] Phase 1 Step 3：学生自己写新prompt（不是Agent组装）
- [ ] features_missing不为空 → 追问缺少的功能
- [ ] 放行：显示学生自己写的完整新prompt
- [ ] Phase 2：游戏重新生成后触发（pendingVerification type='reset'）
- [ ] Phase 2：有「跳过」按钮，不强制反思

### 验证层
- [ ] pendingVerification正确区分Debug返回和正常Gate 2
- [ ] Prompt Fix失败 → 重新路由Orchestrator
- [ ] Code Fix失败 → 路由Reset
- [ ] 同一bug修2次未解决 → needs_ta_help=true
- [ ] TA Dashboard红色高亮needs_ta_help

### 数据
- [ ] bug_type正确写入（prompt/code/reset）
- [ ] final_fix_prompt / final_fix_request / final_new_prompt 都是学生写的原文
- [ ] resolved=true在「修好了✓」时写入
- [ ] insight_note写入（报告用）
