# V17 Agent 嵌入 Student App - 执行计划

## 项目概述

将 V17 认知对抗 Agent 嵌入现有 Trial Class System 的 Student App，实现：
- **Gate 1**：学生展开 Upgrade 时，Agent 自动出现进行认知追问（1-3 轮动态对话）
- **Gate 2**：学生返回 Prompt Tab 时，验证 Upgrade 是否出现并追问归因
- **合并对话模式**：Gate 2 触发时执行两次查询，把 pendingVerify（完整 Gate 1 待验证）和 incomplete（未完成 Gate 1）合并成一个统一 agenda，Agent 用一句话同时提到两件事
- **三个扩展端口**：为未来 20 节课预留接入能力

## 两层架构

| 层级 | 内容 | 改动范围 |
|------|------|----------|
| **Production Layer** | 现有 Student App | 仅 3 处小改动 |
| **V17 Agent Layer** | 新建 AgentBridge.js + AgentPanel.jsx | 完全独立 |

## 关键决定

| 决定项 | 选择 |
|--------|------|
| Agent UI 位置 | student-app 内，overlay 在生产层上方 |
| DeepSeek API 调用 | 前端直接调用（需 VITE_DEEPSEEK_API_KEY） |
| 课程配置 | lesson.js 新增 agent 块 + DIMENSION_LIBRARY |
| 跨课时项目 | students.project_id 预留，暂不实现 |

---

## Phase 1 (P1) - 基础层

### P1-A: sessions 表新增 scheduled_end_at

**数据库变更**:
```sql
ALTER TABLE sessions ADD COLUMN scheduled_end_at timestamptz;
```

**TA Dashboard 改动** (`ta-dashboard/src/components/Setup.jsx`):
- 新增结束时间选择器
- 默认值：创建时间 + 90 分钟
- 未设置时显示警告提示

### P1-B: 新建 agent_sessions 表 + students 预留字段

**文件**: `Trial_Class_System/v17-agent-schema.sql`

```sql
-- agent_sessions 表（完整 schema）
CREATE TABLE agent_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),

  -- 扩展端口2：课程类型
  lesson_type text,

  -- Upgrade 信息
  upgrade_sequence int NOT NULL,
  target_upgrade_id text NOT NULL,
  target_upgrade_label text,
  upgrade_difficulty text,
  language_dimensions_total int,
  language_dimensions_covered int DEFAULT 0,

  -- Gate 1 状态
  gate1_completed boolean DEFAULT false,
  actual_rounds int,
  early_release boolean DEFAULT false,

  -- Round 1
  round_1_input text,
  round_1_mode text,
  round_1_score_specificity int,
  round_1_score_causality int,
  round_1_score_autonomy int,
  round_1_total int,

  -- Round 2
  round_2_input text,
  round_2_mode text,
  round_2_score_specificity int,
  round_2_score_causality int,
  round_2_score_autonomy int,
  round_2_total int,

  -- Round 3
  round_3_input text,
  round_3_mode text,
  round_3_score_specificity int,
  round_3_score_causality int,
  round_3_score_autonomy int,
  round_3_total int,

  -- Gate 2 字段
  upgrade_appeared boolean,
  student_attributed boolean,
  gate2_failure_type text,    -- 'no_prompt'(A类) | 'prompt_ignored'(B类)
  gate2_mode text,            -- 'retry' | 'diagnose'
  gate2_input text,
  student_diagnosed boolean,
  retry_count int DEFAULT 0,
  retry_appeared boolean,

  -- 报告素材
  best_student_quote text,
  language_growth_note text,
  final_prompt_quality text
);

-- 索引
CREATE INDEX idx_agent_sessions_student ON agent_sessions(student_id);
CREATE INDEX idx_agent_sessions_pending ON agent_sessions(student_id, gate1_completed, upgrade_appeared);

-- RLS
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_agent_sessions" ON agent_sessions FOR ALL USING (true) WITH CHECK (true);

-- 扩展端口3：students 预留跨课时字段
ALTER TABLE students ADD COLUMN project_id uuid DEFAULT NULL;
```

### P1-C: lesson.js 扩展（Lesson 2 迷宫课）

**文件**: `student-app/src/lib/lesson.js`

需要新增：

1. **DIMENSION_LIBRARY 常量**（扩展端口3）:
```javascript
export const DIMENSION_LIBRARY = {
  trigger:   "触发条件（什么情况下发生）",
  result:    "结果描述（发生了会怎样）",
  quantity:  "数量或大小（多少个/多大）",
  position:  "位置（在哪里出现）",
  speed:     "速度（快/慢/变速）",
  direction: "方向（哪个方向移动）",
  duration:  "持续时间（持续多久）",
  condition: "触发条件（满足什么才激活）",
};
```

2. **agent 块**（扩展端口1）:
```javascript
export const LESSON = {
  // ... 现有字段
  agent: {
    demo_description: "一个有10条通道的迷宫，玩家从左上角走到右下角，没有任何障碍物",
  },
  // ...
};
```

3. **每个 Upgrade 新增 agent 字段**:
```javascript
{
  id: "moving-trap",
  // ... 现有字段
  agent_context: "会自动移动的障碍物",
  language_dimensions: [
    DIMENSION_LIBRARY.direction,
    DIMENSION_LIBRARY.speed,
    DIMENSION_LIBRARY.result
  ],
}
```

### P1-D: System Prompt 手动测试

**必须验证的两个具体测试用例**:

#### 测试用例 1：Easy Upgrade 1 轮放行路径
- **Upgrade**: 计时器（Timer）
- **学生回答**: "30秒倒计时，时间到了游戏结束"
- **预期评分**: 具体性 2 + 因果性 2 + 自主性 2 = 6/9
- **预期输出**: `{ "continue": false, "early_release": true }`
- **验证点**: Round 1 直接放行，不进入 Round 2

#### 测试用例 2：Hard Upgrade 3 轮降级路径
- **Upgrade**: 移动陷阱（Moving Trap）
- **Round 1 学生回答**: "我要移动的"
- **预期评分**: 具体性 0 + 因果性 1 + 自主性 1 = 2/9
- **预期输出**: `{ "continue": true, "mode": "choice" }`
- **验证点**: 进入 Round 2，使用选择题模式

- **Round 2 学生选择**: 选项 A（左右移动）
- **Agent 必须追问**: 把选择变成描述，如"你选了左右移动——它多快？碰到会怎样？"
- **验证点**: 选择题后必须有追问

- **Round 3**: 无条件 `continue: false`，结束对话

**P1-D 通过标准**: 两个测试用例都能得到预期的 JSON 输出和 continue 字段值。

### P1 检查点
- [ ] Supabase 执行 v17-agent-schema.sql 成功
- [ ] Setup.jsx 时间选择器可用
- [ ] lesson.js DIMENSION_LIBRARY 和 agent 块已添加
- [ ] System Prompt 测试用例 1（1轮放行）通过
- [ ] System Prompt 测试用例 2（3轮降级）通过

---

## Phase 2 (P2) - 核心功能层

### P2-A: AgentBridge.js

**文件**: `student-app/src/lib/AgentBridge.js`

#### 核心接口

```javascript
export const agentBridge = {
  // 初始化
  init(sessionId, studentId, lesson, onOpenPanel),

  // 触发 Gate（由 Upgrade.jsx 调用）
  trigger(eventType, upgradeId),

  // Gate 1 完成回调（由 AgentPanel 调用）
  onGate1Complete(sessionRecordId, data),

  // Gate 2 完成回调（由 AgentPanel 调用）
  onGate2Complete(updates),
};
```

#### Gate 1 触发逻辑

```javascript
const handleUpgradeOpened = async (upgradeId, difficulty) => {
  const upgrade = LESSON.upgrades.find(u => u.id === upgradeId);

  // 防重复：同一 Upgrade 不重复触发
  const existing = await supabase.from('agent_sessions')
    .select('id').eq('student_id', studentId).eq('target_upgrade_id', upgradeId);
  if (existing.data?.length > 0) return;

  const seq = await getUpgradeSequence(studentId);
  const { data: record } = await supabase.from('agent_sessions').insert({
    student_id: studentId,
    session_id: sessionId,
    lesson_type: LESSON.id,
    upgrade_sequence: seq,
    target_upgrade_id: upgrade.id,
    target_upgrade_label: upgrade.label || upgrade.title,
    upgrade_difficulty: difficulty,
    language_dimensions_total: upgrade.language_dimensions?.length || 0,
    gate1_completed: false,  // R4修复：默认false
  }).select().single();

  // 通知 App.jsx 打开 AgentPanel
  onOpenPanel({
    mode: 'gate1',
    sessionRecordId: record.id,
    upgrade,
    currentPrompt: getCurrentPrompt(),
  });
};
```

#### Gate 2 触发逻辑（合并 Agenda 构建）

```javascript
const handlePromptTabRevisited = async () => {
  // 查询1：完整 Gate 1，等待验证
  const { data: pendingVerify } = await supabase.from('agent_sessions')
    .select('*').eq('student_id', studentId)
    .eq('gate1_completed', true).is('upgrade_appeared', null);

  // 查询2：未完成的 Gate 1（最近一条）
  const { data: incomplete } = await supabase.from('agent_sessions')
    .select('*').eq('student_id', studentId)
    .eq('gate1_completed', false)
    .order('created_at', { ascending: false }).limit(1);

  // 无待处理任务则不触发
  if (pendingVerify.length === 0 && incomplete.length === 0) return;

  // 计算时间模式
  const gate2Mode = getTimeRemaining(session) > 8 * 60 * 1000 ? 'retry' : 'diagnose';

  // 合并 Agenda：verify 在前，resume 在后
  const agenda = [
    ...pendingVerify.map(s => ({ type: 'verify', ...s })),
    ...incomplete.map(s => ({ type: 'resume', ...s })),
  ];

  // 通知 App.jsx 打开 AgentPanel
  onOpenPanel({
    mode: 'gate2',
    agenda,
    gate2Mode,
  });
};

// R5修复：三层时间 fallback
const getTimeRemaining = (session) => {
  if (session.scheduled_end_at)
    return new Date(session.scheduled_end_at) - Date.now();
  if (session.created_at)
    return new Date(session.created_at).getTime() + 90*60*1000 - Date.now();
  return 20 * 60 * 1000;  // fallback：假设20分钟，倾向retry
};
```

### P2-B: AgentPanel.jsx

**文件**: `student-app/src/components/AgentPanel.jsx`

#### 核心 Props

```jsx
<AgentPanel
  mode="gate1|gate2"
  sessionRecordId={...}      // Gate 1 用
  upgrade={...}              // Gate 1 用
  currentPrompt={...}        // Gate 1 用
  agenda={[...]}             // Gate 2 用
  gate2Mode="retry|diagnose" // Gate 2 用
  onClose={() => {...}}
/>
```

#### Gate 1 动态轮数逻辑

```
Round 1 评分后：
├─ ≥6/9 → continue:false, early_release=true → 放行
├─ 3-5/9 → continue:true, mode:"fill" → Round 2 填空题
└─ ≤2/9 → continue:true, mode:"choice" → Round 2 选择题

Round 2 评分后：
├─ 比 Round 1 提升≥2 → continue:false → 放行
└─ 未提升 → continue:true, mode:"choice" → Round 3

Round 3：无条件 continue:false → 结束
```

#### 三种问题模式渲染

| 模式 | 渲染方式 | 特殊处理 |
|------|----------|----------|
| `open` | 文本输入框 | 默认模式 |
| `fill` | 填空模板 + 输入框 | 显示 `fill_template` |
| `choice` | 3 个选项按钮 | **选择后必须追一句**，把选择变成描述 |

#### Gate 2 三种归因质量升降级逻辑

```
学生回答后评估归因质量：

完整归因（说出出现/未出现的原因）
├─ 直接写入 upgrade_appeared、student_attributed
└─ 进入下一条 agenda 或结束

部分归因（只说结果，没说原因）
├─ 逐一追问每个 Upgrade："[X]出现了——prompt里写了哪句话？"
└─ 每条追问单独评估后写入

无归因（只说感受，如"挺好的"）
├─ 降级选择题："这几个里，哪个你最确定是你告诉AI的？"
├─ 学生选择后追问："你选了[X]——你prompt里怎么写的？"
└─ 记录后进入下一条 agenda
```

#### Gate 2 失败处理：A类/B类区分

当 `upgrade_appeared = false` 时：

```
Agent 先问："你的prompt里有没有写[X]？"

A类回答（没写）：
├─ 写入 gate2_failure_type = 'no_prompt'
├─ 引用 best_student_quote："你刚才说过『[quote]』，把这句话加进prompt"
└─ 如果 gate2Mode='retry' → 给修改方向，学生重试
   如果 gate2Mode='diagnose' → 问"你知道为什么没出现了吗？"，记录 student_diagnosed

B类回答（写了但AI没做）：
├─ 写入 gate2_failure_type = 'prompt_ignored'
├─ 追问未覆盖的 language_dimensions："你描述了[X]，但有没有说[Y（未覆盖维度）]？"
└─ 同样按 gate2Mode 决定 retry 或 diagnose
```

#### Gate 2 完成批量写回

```javascript
const handleGate2Complete = async (updates) => {
  for (const update of updates) {
    if (update.type === 'verify') {
      await supabase.from('agent_sessions')
        .update({
          upgrade_appeared: update.upgrade_appeared,
          student_attributed: update.attributed,
          gate2_failure_type: update.failure_type,
          gate2_mode: gate2Mode,
          gate2_input: update.input,
          student_diagnosed: update.diagnosed,
        })
        .eq('id', update.sessionId);
    } else if (update.type === 'resume_complete') {
      await supabase.from('agent_sessions')
        .update({
          gate1_completed: true,
          [`round_${update.roundNum}_input`]: update.input,
          [`round_${update.roundNum}_score_specificity`]: update.scores.specificity,
          [`round_${update.roundNum}_score_causality`]: update.scores.causality,
          [`round_${update.roundNum}_score_autonomy`]: update.scores.autonomy,
          [`round_${update.roundNum}_total`]: update.scores.total,
          actual_rounds: update.roundNum,
          best_student_quote: update.best_quote,
          language_growth_note: update.language_growth,
        })
        .eq('id', update.sessionId);
    }
  }
  onClose();
};
```

### P2-C: App.jsx 集成

**文件**: `student-app/src/App.jsx`

#### 状态管理

```jsx
// Agent 状态
const [agentGateActive, setAgentGateActive] = useState(false);
const [agentPanelProps, setAgentPanelProps] = useState(null);

// AgentBridge 回调：打开 Panel
const handleOpenAgentPanel = (props) => {
  setAgentPanelProps(props);
  setAgentGateActive(true);
};

// AgentBridge 初始化
useEffect(() => {
  if (sessionId && studentId) {
    agentBridge.init(sessionId, studentId, LESSON, handleOpenAgentPanel);
  }
}, [sessionId, studentId]);
```

#### 渲染结构

```jsx
return (
  <>
    {/* 生产层 */}
    <div style={{
      opacity: agentGateActive ? 0.3 : 1,
      pointerEvents: agentGateActive ? 'none' : 'auto',
      transition: 'opacity 0.3s',
    }}>
      {/* 现有内容：NameInput、Tabs、DesignCard、PromptGenerator 等 */}
    </div>

    {/* Agent 层（z-index 高层） */}
    {agentGateActive && agentPanelProps && (
      <AgentPanel
        {...agentPanelProps}
        onClose={() => {
          setAgentGateActive(false);
          setAgentPanelProps(null);
        }}
      />
    )}
  </>
);
```

### P2-D: Upgrade.jsx UI 改动（分组展开+Start按钮确认）

**文件**: `student-app/src/components/Upgrade.jsx`

#### 现有交互结构

```
Upgrade Tab 页面结构（现有）：
├─ Easy 分组（可折叠）
│   ├─ Lives Counter Card → [Copy] 按钮
│   ├─ High Score Card → [Copy] 按钮
│   └─ ...
├─ Medium 分组（可折叠）
│   ├─ Boss Battle Card → 填参数 → [Copy] 按钮
│   └─ ...
└─ Hard 分组（可折叠）
    ├─ Balance Designer Card → 写描述 → [Copy] 按钮
    └─ ...
```

#### 新交互流程

```
Upgrade Tab 页面结构（改后）：
├─ Easy 分组（可折叠）
│   ├─ Lives Counter Card
│   │   ├─ [Start] 按钮 ← 点击触发 Agent Gate 1
│   │   ├─ Agent 对话完成后 → 显示 [Copy] 按钮
│   │   └─ 未 Start 前 → [Copy] 按钮禁用或隐藏
│   └─ ...
└─ ...
```

#### UpgradeCard 状态流

```
初始状态：
├─ 显示 Upgrade 标题 + 简介
├─ [Start] 按钮可见
└─ [Copy] 按钮隐藏或禁用

点击 [Start]：
├─ 调用 onStartUpgrade(upgradeId)
├─ App.jsx 触发 AgentBridge Gate 1
└─ AgentPanel 出现，生产层变暗

Gate 1 完成：
├─ AgentPanel 消失
├─ 该 UpgradeCard 状态变为 "completed"
├─ [Start] 按钮消失
└─ [Copy] 按钮可见

点击 [Copy]：
├─ 复制 prompt（现有逻辑）
└─ 上报 upgrade_selected 事件
```

#### Upgrade.jsx 改动

```jsx
// 新增 prop
export default function Upgrade({
  onUpgradeCopy,
  onLevelOpen,
  onOwnIdeaSubmit,
  onStartUpgrade,        // 新增：Start 按钮回调
  completedUpgrades = [], // 新增：已完成 Gate 1 的 Upgrade ID 列表
}) {
  // ...
}

// UpgradeCard 改动
function UpgradeCard({ up, copiedId, onCopy, onOwnIdeaSubmit, onStart, isCompleted }) {
  // ...

  // Easy Upgrade 渲染
  if (up.level === 'easy' && !up.isOwn) {
    return (
      <div className="bg-white border-2 border-slate-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="text-2xl">{up.emoji}</div>
          <div className="font-bold text-slate-800">{up.title}</div>
        </div>
        <div className="text-xs text-slate-500 mb-3 leading-relaxed">{up.prompt}</div>

        {/* 状态切换 */}
        {!isCompleted ? (
          <Button onClick={() => onStart(up.id, up.level)} variant="secondary" size="sm" className="w-full">
            <Play className="w-4 h-4" /> Start
          </Button>
        ) : (
          <Button onClick={() => onCopy(up.prompt, up.id, up.level)} variant={copiedId === up.id ? "success" : "primary"} size="sm" className="w-full">
            {copiedId === up.id ? (<><Check className="w-4 h-4" /> Copied!</>) : (<><Copy className="w-4 h-4" /> Copy</>)}
          </Button>
        )}
      </div>
    );
  }

  // Medium Upgrade 渲染（参数输入区在 Gate 1 完成后才显示）
  if (up.level === 'medium') {
    return (
      <div className="bg-white border-2 border-blue-300 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="text-2xl">{up.emoji}</div>
          <div className="font-bold text-slate-800">{up.title}</div>
        </div>
        <div className="text-xs text-blue-700 bg-blue-50 rounded-lg p-2.5 mb-3">
          🤔 <strong>Think first:</strong> {up.think}
        </div>

        {!isCompleted ? (
          // Gate 1 未完成：只显示 Start 按钮
          <Button onClick={() => onStart(up.id, up.level)} variant="secondary" size="sm" className="w-full">
            <Play className="w-4 h-4" /> Start
          </Button>
        ) : (
          // Gate 1 完成：显示参数输入区 + Copy 按钮
          <>
            <div className="space-y-2 mb-3">
              {up.params.map((p) => (
                <div key={p.key} className="flex items-center gap-2">
                  <label className="text-xs text-slate-600 flex-1">{p.label}</label>
                  <input type="number" ... />
                </div>
              ))}
            </div>
            <Button onClick={() => onCopy(...)} ...>Copy</Button>
          </>
        )}
      </div>
    );
  }

  // Hard Upgrade 渲染（描述输入区在 Gate 1 完成后才显示）
  if (up.level === 'hard' && up.prompt === null) {
    return (
      <div className="bg-white border-2 border-purple-300 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="text-2xl">{up.emoji}</div>
          <div className="font-bold text-slate-800">{up.title}</div>
        </div>
        <div className="text-xs text-purple-700 bg-purple-50 rounded-lg p-2.5 mb-3">
          💭 <strong>Think first:</strong> {up.hint}
        </div>

        {!isCompleted ? (
          // Gate 1 未完成：只显示 Start 按钮
          <Button onClick={() => onStart(up.id, up.level)} variant="secondary" size="sm" className="w-full">
            <Play className="w-4 h-4" /> Start
          </Button>
        ) : (
          // Gate 1 完成：显示描述输入区 + Copy 按钮
          <>
            <textarea placeholder="Describe your idea here..." ... />
            <Button onClick={() => onCopy(...)} ...>Copy My Prompt</Button>
          </>
        )}
      </div>
    );
  }
}
```

#### App.jsx 状态管理

```jsx
// 已完成 Gate 1 的 Upgrade 列表
const [completedUpgrades, setCompletedUpgrades] = useState([]);

// Start 按钮回调（传入 difficulty）
const handleStartUpgrade = (upgradeId, difficulty) => {
  agentBridge.trigger('upgrade_started', upgradeId, difficulty);
};

// AgentBridge 回调：Gate 1 完成时更新列表
const handleGate1Complete = (upgradeId) => {
  setCompletedUpgrades(prev => [...prev, upgradeId]);
};

// Upgrade 组件
<Upgrade
  onUpgradeCopy={handleUpgradeCopy}
  onLevelOpen={handleLevelOpen}
  onOwnIdeaSubmit={handleOwnIdeaSubmit}
  onStartUpgrade={handleStartUpgrade}
  completedUpgrades={completedUpgrades}
/>
```

#### UpgradeCard 调用 onStart

```jsx
// 传入 difficulty（即 up.level）
<Button onClick={() => onStart(up.id, up.level)}>
  <Play className="w-4 h-4" /> Start
</Button>
```

#### Medium/Hard Upgrade 特殊处理

**正确顺序**（符合 Gate 1 教学目的）：
```
Start → Agent 追问 → 学生产出精确语言 → 填参数/写描述 → Copy
```

**教学逻辑**：
- Gate 1 的核心目的是「在学生写 prompt 之前，先把想法变成精确语言」
- Agent 追问出的精确语言，学生立刻用来填参数
- Agent 对话和参数填写直接连接，精确语言有出口

**Medium Upgrade 状态流**：
```
初始状态：
├─ 显示 Upgrade 标题 + Think first 提示
├─ [Start] 按钮可见
└─ 参数输入区隐藏

点击 [Start]：
├─ AgentPanel 出现，进行 Gate 1 对话
└─ 参数输入区仍然隐藏

Gate 1 完成：
├─ AgentPanel 消失
├─ 参数输入区显示（此时学生带着精确语言来填）
└─ 填完后 [Copy] 按钮可用

点击 [Copy]：
└─ 复制 prompt（现有逻辑）
```

**Hard Upgrade 状态流**：
```
初始状态：
├─ 显示 Upgrade 标题 + Think first 提示
├─ [Start] 按钮可见
└─ 描述输入区隐藏

Gate 1 完成后：
├─ 描述输入区显示
├─ 学生用 Agent 对话里说出的精确语言来写描述
└─ 填完后 [Copy] 按钮可用
```

### P2 检查点
- [ ] Upgrade.jsx：Start 按钮正常显示
- [ ] Upgrade.jsx：点击 Start → 触发 onStartUpgrade 回调
- [ ] Upgrade.jsx：Gate 1 完成后 → Copy 按钮激活
- [ ] AgentBridge Gate 1 触发：点击 Start → 创建 agent_sessions 记录
- [ ] AgentBridge Gate 2 触发：返回 Prompt Tab → 查询并合并 agenda
- [ ] AgentPanel Gate 1：1轮放行路径正常
- [ ] AgentPanel Gate 1：3轮降级路径正常
- [ ] AgentPanel Gate 1：选择题后有追问
- [ ] AgentPanel Gate 2：完整归因直接结束
- [ ] AgentPanel Gate 2：部分归因逐一追问
- [ ] AgentPanel Gate 2：无归因降级选择题
- [ ] AgentPanel Gate 2：失败 A类引用 best_quote
- [ ] AgentPanel Gate 2：失败 B类追问未覆盖维度
- [ ] App.jsx 状态传递正常
- [ ] 生产层 overlay 效果正常

---

## Phase 3 (P3) - 报告和监控层

### P3-A: reportPrompt.js 新增 agentSection

**文件**: `ta-dashboard/src/lib/reportPrompt.js`

```javascript
// 在 buildReportPrompt 中新增
const agentSection = await buildAgentSection(studentId);

// 新函数
async function buildAgentSection(studentId) {
  const { data } = await supabase
    .from('agent_sessions')
    .select('*')
    .eq('student_id', studentId);

  if (!data || data.length === 0) return '';

  // 统计
  const earlyReleaseCount = data.filter(s => s.early_release).length;
  const round2Count = data.filter(s => s.actual_rounds === 2).length;
  const round3Count = data.filter(s => s.actual_rounds === 3).length;
  const diagnosedCount = data.filter(s => s.student_diagnosed).length;

  // 收集所有 best_student_quote
  const bestQuotes = data
    .filter(s => s.best_student_quote)
    .map(s => ({
      upgrade: s.target_upgrade_label,
      quote: s.best_student_quote,
    }));

  // 生成报告语言
  let section = `\n\n### 语言精确度训练\n`;

  if (earlyReleaseCount > 0) {
    section += `- ${earlyReleaseCount} 次一轮通过（语言表达清晰）\n`;
  }
  if (round2Count > 0) {
    section += `- ${round2Count} 次两轮完成（需要适度引导）\n`;
  }
  if (round3Count > 0) {
    section += `- ${round3Count} 次三轮完成（需要结构化辅助）\n`;
  }
  if (diagnosedCount > 0) {
    section += `- 孩子能够识别自己的 prompt 中缺失的内容（发现问题的能力）\n`;
  }

  // 引用学生原话（报告亮点）
  if (bestQuotes.length > 0) {
    section += `\n**孩子的精彩表达**:\n`;
    bestQuotes.forEach(q => {
      section += `- 关于「${q.upgrade}」：「${q.quote}」\n`;
    });
  }

  return section;
}
```

**best_student_quote 的价值**：
- 这是学生在 Gate 1 对话中说出的最精确的语言
- 直接引用在报告里，让家长看到孩子的真实进步
- 比统计数字更有说服力

### P3-B: StudentCard.jsx 新增信号

**文件**: `ta-dashboard/src/components/StudentCard.jsx`

新增显示：
- 🟢 X 次 1 轮放行（early_release）
- 🟡 Y 次 2 轮完成
- 🔴 Z 次 3 轮 / 跳过
- Gate 2 状态：已验证/未验证
- **高优先级信号**：`actual_rounds=3 && upgrade_appeared=false && gate2_mode='retry' && timeRemaining<8min` → 红色高亮，TA 需要立即介入

### P3 检查点
- [ ] 报告包含 Agent 对话数据
- [ ] TA Dashboard 显示语言精确度信号
- [ ] 高优先级介入信号正常触发

---

## 文件清单

| 文件 | 操作 | Phase |
|------|------|-------|
| `v17-agent-schema.sql` | 新建 | P1 |
| `ta-dashboard/src/components/Setup.jsx` | 修改（时间选择器） | P1 |
| `student-app/src/lib/lesson.js` | 修改（agent 块 + DIMENSION_LIBRARY） | P1 |
| `student-app/src/lib/AgentBridge.js` | 新建 | P2 |
| `student-app/src/components/AgentPanel.jsx` | 新建 | P2 |
| `student-app/src/App.jsx` | 修改（集成） | P2 |
| `student-app/src/components/Upgrade.jsx` | 修改（新增 Start 按钮 + onStartUpgrade prop + completedUpgrades 状态） | P2 |
| `student-app/.env.local` | 修改（加 VITE_DEEPSEEK_API_KEY） | P2 |
| `ta-dashboard/src/lib/reportPrompt.js` | 修改（agentSection） | P3 |
| `ta-dashboard/src/components/StudentCard.jsx` | 修改（信号显示） | P3 |

---

## 三个扩展端口

| 端口 | 位置 | 用途 |
|------|------|------|
| **端口1** | lesson.js `agent.demo_description` | 每节课的示范作品描述 |
| **端口2** | agent_sessions.lesson_type | 区分不同课程的数据 |
| **端口3** | DIMENSION_LIBRARY | 跨课程复用维度描述 |

未来 20 节课接入：只需填写 lesson.js 的 agent 块和 Upgrade 的 language_dimensions，AgentBridge 和 AgentPanel 零改动。

---

## 风险和修复

| 风险 | 修复 |
|------|------|
| R4: Gate 1 中断导致半完整记录 | `gate1_completed` 字段区分完整/半完整，Gate 2 分两次查询 |
| R5: scheduled_end_at 为 NULL | 三层 fallback：scheduled_end_at → created_at+90min → 20min |

---

## 环境准备

- [ ] student-app/.env.local 添加 `VITE_DEEPSEEK_API_KEY`
- [ ] Supabase 执行 v17-agent-schema.sql
- [ ] 确认 Supabase Realtime 已开启 agent_sessions

---

## 验证方式

### Easy Upgrade 端到端测试
1. 学生进入 Student App → Upgrade Tab
2. 展开 Easy 分组 → 看到 [Start] 按钮
3. 点击 [Start] → AgentPanel 出现，生产层变暗
4. 测试 1 轮放行路径（回答清晰，6/9分）→ AgentPanel 消失
5. [Copy] 按钮显示 → 点击复制
6. 复制 prompt 到 Claude → 生成游戏
7. 返回 Prompt Tab → Gate 2 验证出现
8. 完成验证 → 数据写入 Supabase

### Medium Upgrade 端到端测试
1. 展开 Medium 分组 → 看到标题、Think first 提示、[Start] 按钮
2. **参数输入区不可见**
3. 点击 [Start] → AgentPanel 出现
4. Agent 追问：「Boss 几秒出现？打几下？碰到会怎样？」
5. 学生回答（产出精确语言）→ Gate 1 完成
6. AgentPanel 消失 → **参数输入区现在可见**
7. 学生用刚才说的精确语言填参数（如：20分出现，打3下）
8. 点击 [Copy] → 复制 prompt

### Hard Upgrade 端到端测试
1. 展开 Hard 分组 → 看到标题、Think first 提示、[Start] 按钮
2. **描述输入区不可见**
3. 点击 [Start] → AgentPanel 出现
4. 测试 3 轮降级路径（回答模糊，2/9分 → 选择题 → 追问）
5. Agent 追问出精确语言 → Gate 1 完成
6. AgentPanel 消失 → **描述输入区现在可见**
7. 学生用精确语言写描述
8. 点击 [Copy] → 复制 prompt

### Gate 2 测试
1. 返回 Prompt Tab → Gate 2 验证出现
2. 测试完整归因（直接结束）
3. 测试部分归因（逐一追问）
4. 测试无归因（降级选择题）
5. 测试失败 A类（引用 best_quote）
6. 测试失败 B类（追问未覆盖维度）

### 报告测试
1. TA Dashboard 看到语言精确度信号
2. 生成报告 → 包含 Agent 对话数据
3. 报告包含 best_student_quote（孩子的精彩表达）
