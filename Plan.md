# Phase 2: Trial Class Data Collection System - 实施方案

## 项目配置

| 项目 | 值 |
|------|-----|
| 位置 | `/Users/renmu/AI Creative Class/Class Companion开发/Trial_Class_System/` |
| Student App | `student-app/` (port 5173) |
| TA Dashboard | `ta-dashboard/` (port 5174) |
| 后端 | Supabase (用户手动创建项目) |
| 更新方式 | 轮询 5秒 |
| 多TA评分 | 取平均值 |
| Session状态 | 简化：创建即 running (MVP去掉preparing) |
| Session加入 | URL传参 `?session=xxx` (不需手动选) |
| 重复学生 | 允许，但显示UUID前4位区分 |
| 评分UI | +/- 按钮 (紧凑) |
| 评分默认值 | null (不是5，区分"未评分") |
| 删除学生 | 软删除 (deleted_at字段) |
| Event上报 | localStorage队列 + 定期flush

---

## 1. Supabase Schema

用户需要在 Supabase Dashboard → SQL Editor 执行：

```sql
-- sessions: trial class场次
create table sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date timestamp with time zone default now(),
  status text default 'running' check (status in ('running','ended')),  -- MVP简化：创建即running
  created_at timestamp with time zone default now()
);

-- students: 学生（每场课）
create table students (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  name text not null,
  device_id text,
  game_name text,
  current_step text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone  -- 软删除字段
);

-- scores: 5维度评分（每个TA每个学生一条）
-- 注意：默认值为NULL，不是5，区分"未评分"和"评5分"
create table scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  ta_name text not null,
  ownership int check (ownership between 1 and 10),     -- NULL = 未评分
  persistence int check (persistence between 1 and 10),
  curiosity int check (curiosity between 1 and 10),
  expression int check (expression between 1 and 10),
  parent_signal int check (parent_signal between 1 and 10),
  notes text,
  updated_at timestamp with time zone default now(),
  unique(student_id, ta_name)
);

-- student_events: 行为事件
create table student_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  event_type text not null,
  dimension text check (dimension in ('ownership','persistence','curiosity','expression','parent_signal')),
  data jsonb,
  created_at timestamp with time zone default now()
);

-- indexes
create index idx_students_session on students(session_id);
create index idx_scores_student on scores(student_id);
create index idx_events_student on student_events(student_id);
create index idx_events_student_time on student_events(student_id, created_at desc);  -- 优化30秒events查询

-- RLS (MVP: anon全开放)
alter table sessions enable row level security;
alter table students enable row level security;
alter table scores enable row level security;
alter table student_events enable row level security;

create policy "anon_sessions" on sessions for all using (true) with check (true);
create policy "anon_students" on students for all using (true) with check (true);
create policy "anon_scores" on scores for all using (true) with check (true);
create policy "anon_events" on student_events for all using (true) with check (true);
```

---

## 2. 文件结构

```
Trial_Class_System/
├── student-app/
│   ├── src/
│   │   ├── App.jsx                    # 主入口（改造 Phase 1）
│   │   ├── lib/
│   │   │   ├── supabase.js           # Supabase client
│   │   │   ├── events.js             # Event reporting
│   │   │   └── lesson.js             # LESSON 配置（从 Phase 1 提取）
│   │   ├── components/
│   │   │   ├── NameInput.jsx         # 启动时输入名字+选session
│   │   │   ├── DesignCard.jsx
│   │   │   ├── PromptGenerator.jsx
│   │   │   ├── Recovery.jsx
│   │   │   ├── Upgrade.jsx
│   │   │   └── GameNameBadge.jsx
│   │   ├── main.jsx
│   │   └── index.css                 # Tailwind
│   ├── .env.local                    # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
│
├── ta-dashboard/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── lib/
│   │   │   ├── supabase.js
│   │   │   └── conversionScore.js    # 分数计算
│   │   ├── components/
│   │   │   ├── Setup.jsx             # Session选择+TA身份+二维码
│   │   │   ├── Dashboard.jsx         # 主界面
│   │   │   ├── StudentCard.jsx       # 学生卡片（含评分按钮）
│   │   │   ├── WeightsPanel.jsx      # 权重调整
│   │   │   ├── ExportButton.jsx      # CSV导出
│   │   │   └── SessionQRCode.jsx     # 二维码组件
│   │   ├── main.jsx
│   │   └── index.css
│   ├── .env.local
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
│
└── README.md                          # 部署说明
```

---

## 3. Student App 改造要点

### 3.1 新增状态
```javascript
const [sessionId, setSessionId] = useState(localStorage.getItem('session_id'));
const [studentId, setStudentId] = useState(localStorage.getItem('student_id'));
const [studentName, setStudentName] = useState('');
const [initialized, setInitialized] = useState(false);
const [upgradeCounts, setUpgradeCounts] = useState({});  // 追踪 upgrade 复制次数
```

### 3.2 启动流程（URL 传参模式）
```
App 加载
  ↓
从 URL 读取 ?session=xxx
  ↓ 没有 session 参数
显示错误: "Please use the link from your teacher"
  ↓ 有 session 参数
验证 session 存在且 status='running'
  ↓ session 不存在或已 ended
显示错误: "Class not found" 或 "Class ended, thank you!"
  ↓ session 有效
检查 localStorage (student_id 且 session_id 匹配)
  ↓ 没有或 session 不匹配
显示 NameInput 组件（只输入名字，不选 session）
  ↓
创建 students 记录 → 存 localStorage
  ↓
进入主界面
```

### 3.3 Event 触发点（7个）

| Event | 触发位置 | 代码修改 |
|-------|---------|---------|
| `game_named` | `GameNameBadge.save()` | 调用后 `reportEvent('game_named', 'ownership', {old, new})` |
| `own_idea_typed` | `submitOwnIdea()` in DesignCard | 调用后 `reportEvent('own_idea_typed', 'ownership', {step, text})` |
| `upgrade_selected` | `copyText()` in Upgrade | 每次复制时 `reportEvent('upgrade_selected', 'ownership', {id, level, count})` |
| `upgrade_retried` | `copyText()` in Upgrade | 第2次及以后每次都触发，带 `{id, count}` |
| `help_requested` | `setOpenId()` in Recovery | 当展开某个 help 项时触发 |
| `hard_challenge_opened` | `setOpenLevels()` in Upgrade | 当 `hard` 从 false 变 true 时触发 |
| `medium_challenge_opened` | `setOpenLevels()` in Upgrade | 当 `medium` 从 false 变 true 时触发 |

### 3.3.1 upgrade_retried 逻辑明确
```javascript
const handleUpgradeCopy = (upgradeId, level) => {
  const count = (upgradeCounts[upgradeId] || 0) + 1;
  setUpgradeCounts({ ...upgradeCounts, [upgradeId]: count });

  // 每次都触发 upgrade_selected
  reportEvent('upgrade_selected', 'ownership', { upgrade_id: upgradeId, level, count });

  // 第2次开始额外触发 upgrade_retried
  if (count >= 2) {
    reportEvent('upgrade_retried', 'persistence', { upgrade_id: upgradeId, count });
  }
};
```

### 3.4 Event 上报（带离线队列）
```javascript
// lib/events.js
const QUEUE_KEY = 'event_queue';

export const reportEvent = async (supabase, studentId, eventType, dimension, data = {}) => {
  const event = {
    student_id: studentId,
    event_type: eventType,
    dimension,
    data,
    client_timestamp: new Date().toISOString()
  };

  // 1. 先存 localStorage 队列
  const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  queue.push(event);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));

  // 2. 尝试上报
  try {
    await supabase.from('student_events').insert(event);
    // 成功 → 从队列移除
    const remaining = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]').slice(1);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  } catch (err) {
    console.warn('Event queued for retry:', event);
  }
};

// 定期 flush 队列（10秒）
export const startEventFlush = (supabase) => {
  return setInterval(async () => {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    if (queue.length === 0) return;
    try {
      await supabase.from('student_events').insert(queue);
      localStorage.setItem(QUEUE_KEY, '[]');
    } catch {}
  }, 10000);
};
```

### 3.5 定期状态更新
```javascript
useEffect(() => {
  if (!studentId) return;
  const interval = setInterval(async () => {
    await supabase.from('students')
      .update({ current_step: tab, game_name: displayGameName, updated_at: new Date().toISOString() })
      .eq('id', studentId);
  }, 30000);
  return () => clearInterval(interval);
}, [studentId, tab, displayGameName]);
```

---

## 4. TA Dashboard 要点

### 4.1 Setup 页面
- Session 下拉列表（running 状态）+ "New Session" 按钮
- 新 Session 直接 `running`（MVP简化，无 preparing 状态）
- TA 身份选择：TA1 / TA2 单选
- 选完后存 localStorage，进入 Dashboard
- **创建后自动复制带 session ID 的 URL 给 TA 分享给学生**

### 4.1.1 Session URL 分享流程（含二维码）
```
TA 创建 Session "Saturday Class"
    ↓
系统生成 URL: student-app.vercel.app/?session=abc123
    ↓
同时生成大二维码（300x300）+ 自动复制 URL
    ↓
TA 投影二维码 → 学生用手机扫码 → 自动跳转
    ↓（或）
TA 发二维码到家长群 → 学生在 Chromebook 上手动输入短 URL
    ↓
学生打开 URL → 自动识别 session → 只需输入名字
```

**为什么需要二维码**：
- UUID 是 36 字符，8 岁孩子输错率 >80%
- 投影二维码让学生扫码，比输 URL 快 10 倍

**技术实现**：
```javascript
// 用 qrcode.react 库
import { QRCodeSVG } from 'qrcode.react';

<QRCodeSVG value={studentUrl} size={300} />
```

**依赖**：`npm install qrcode.react`

### 4.1.2 Session 状态（简化）
```
创建时:
┌─────────────────────────────────────────┐
│  Session: "Saturday Class"  [running]   │
│  URL: ...?session=abc123  [📋 Copy]     │
│  Students: 0        [⏹ End Session]     │
└─────────────────────────────────────────┘

结束后:
┌─────────────────────────────────────────┐
│  Session: "Saturday Class"  [ended]     │
│  Students: 8        [Export CSV]        │
└─────────────────────────────────────────┘
```

学生端逻辑:
- URL 带 `?session=xxx` → 直接进入该 session，不需选择
- 如果 URL 无 session 参数 → 显示错误 "Please use the link from your teacher"
- **Session ended 优雅降级**：
  ```javascript
  // session ended 后，学生端仍允许只读模式
  if (sessionStatus === 'ended') {
    // 不再上报 events
    // 不再上报 status update
    // 但保留所有 Phase 1 功能（可以继续 Build/Generate Prompt/Upgrade）
    // 顶部显示提示 banner："Class ended. You can still play, but progress won't be saved."
  }
  ```
  **原因**：学生回家后想给家长看自己做的游戏，不应该被锁死

### 4.2 Dashboard 主界面
```
┌─────────────────────────────────────────────────────┐
│  Session: "Saturday Morning Class"  [running]       │
│  TA: TA1    Students: 8    [🔄 Refresh] [⏹ End]    │
├─────────────────────────────────────────────────────┤
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐│
│ │ Alex    0.72 │  │ Brian   0.65 │  │ Carol   0.58 ││
│ │ upgrade [🗑] │  │ prompt  [🗑] │  │ design  [🗑] ││
│ └──────────────┘  └──────────────┘  └──────────────┘│
├─────────────────────────────────────────────────────┤
│  Weights:  O[1.0] P[1.0] C[1.0] E[1.0] PS[1.0]     │
│                                        [Export CSV] │
└─────────────────────────────────────────────────────┘
```

功能按钮:
- 🔄 Refresh: 手动刷新（不用等 5 秒）
- ⏹ End: 结束 session
- 🗑: 删除误加入的学生（需确认）

### 4.3 StudentCard UI (紧凑 +/- 按钮)
```
默认收起视图:
┌────────────────────────────────────────┐
│ Alex Chen #a3f2   0.72  Step: upgrade │  ← #a3f2 = UUID前4位
│ "My Stars Catcher"         [🗑] [展开] │
└────────────────────────────────────────┘

点击展开后:
┌────────────────────────────────────────┐
│ Alex Chen #a3f2   0.72  Step: upgrade │
│ "My Stars Catcher"         [🗑] [收起] │
├────────────────────────────────────────┤
│  O: [−] 8 [+]   P: [−] 6 [+]          │  ← Ownership, Persistence
│  C: [−] 7 [+]   E: [−] - [+]          │  ← Curiosity, Expression（- = 未评分）
│  PS: [−] - [+]                         │  ← Parent Signal（- = 未评分）
├────────────────────────────────────────┤
│  Events: game_named (2m ago)          │
│  [Notes...]                           │
└────────────────────────────────────────┘
```
- `#a3f2` = student.id.slice(0,4)，区分同名学生
- `-` = null（未评分），区别于数字 5
- O/P/C = 自动追踪的维度（event 可辅助判断）
- E/PS = 完全手动评分

### 4.3.1 评分按钮 null 状态行为
```javascript
const handleIncrement = (dimension) => {
  const current = scores[dimension];
  // null 状态点 + → 起步为 5（中间值，表示"开始评分"）
  const newValue = current === null ? 5 : Math.min(10, current + 1);
  updateScore(dimension, newValue);
};

const handleDecrement = (dimension) => {
  const current = scores[dimension];
  // null 状态点 - → 起步为 5
  const newValue = current === null ? 5 : Math.max(1, current - 1);
  updateScore(dimension, newValue);
};
```

### 4.4 Conversion Score 计算
```javascript
// lib/conversionScore.js
export function calculateConversionScore(scores, weights = {
  ownership: 1.0, persistence: 1.0, curiosity: 1.0, expression: 1.0, parent_signal: 1.0
}) {
  const dims = ['ownership', 'persistence', 'curiosity', 'expression', 'parent_signal'];

  // 统计有效评分数量
  const validDims = dims.filter(d => scores[d] !== null && scores[d] !== undefined);
  if (validDims.length === 0) return null; // 全部未评分

  const totalWeight = validDims.reduce((sum, d) => sum + weights[d], 0);
  const weightedSum = validDims.reduce((sum, d) => sum + scores[d] * weights[d], 0);

  return (weightedSum / totalWeight / 10).toFixed(2);
}

// 平均两个 TA 评分（区分未评分和评5分）
export function averageScores(ta1Scores, ta2Scores) {
  const dims = ['ownership', 'persistence', 'curiosity', 'expression', 'parent_signal'];
  const result = {};

  dims.forEach(d => {
    const v1 = ta1Scores?.[d];  // 可能是 null/undefined
    const v2 = ta2Scores?.[d];

    const validScores = [v1, v2].filter(v => v !== null && v !== undefined);
    if (validScores.length === 0) {
      result[d] = null; // 都未评分
    } else {
      result[d] = Math.round(validScores.reduce((a,b) => a+b, 0) / validScores.length);
    }
  });

  return result;
}
```

### 4.5 轮询更新（优化：拆分 query 减少流量）
```javascript
useEffect(() => {
  // 轻量 query（5秒）- 学生列表 + 评分
  const fetchStudents = async () => {
    const { data } = await supabase
      .from('students')
      .select('id, name, game_name, current_step, updated_at, scores(ta_name, ownership, persistence, curiosity, expression, parent_signal)')
      .eq('session_id', sessionId)
      .is('deleted_at', null)  // 排除软删除的
      .order('created_at');
    setStudents(data);
  };

  // 重量 query（30秒）- events（用于显示 "Recent events"）
  const fetchEvents = async () => {
    const { data } = await supabase
      .from('student_events')
      .select('student_id, event_type, created_at')
      .in('student_id', students.map(s => s.id))
      .order('created_at', { ascending: false })
      .limit(50);  // 只取最近50条
    setEvents(data);
  };

  fetchStudents();
  const interval1 = setInterval(fetchStudents, 5000);
  const interval2 = setInterval(fetchEvents, 30000);
  fetchEvents(); // 初始加载

  return () => {
    clearInterval(interval1);
    clearInterval(interval2);
  };
}, [sessionId]);
```

### 4.6 CSV 导出
```javascript
const exportCSV = () => {
  const headers = ['name', 'game_name', 'current_step',
    'ownership', 'persistence', 'curiosity', 'expression', 'parent_signal',
    'conversion_score'];
  const rows = students.map(s => {
    const avgScore = averageScores(
      s.scores?.find(sc => sc.ta_name === 'TA1'),
      s.scores?.find(sc => sc.ta_name === 'TA2')
    );
    return [
      s.name, s.game_name, s.current_step,
      avgScore.ownership, avgScore.persistence, avgScore.curiosity,
      avgScore.expression, avgScore.parent_signal,
      calculateConversionScore(avgScore, weights)
    ].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  // 触发下载...
};
```

---

## 5. 实施顺序

### Step 1: 项目初始化 (10 files)
1. 创建 `Trial_Class_System/` 目录结构
2. 初始化 `student-app/` Vite 项目
3. 初始化 `ta-dashboard/` Vite 项目
4. 配置 Tailwind CSS
5. 创建 `.env.local` 模板

### Step 2: Supabase 配置
- 提供 SQL schema 供用户执行
- 用户手动创建项目并配置 `.env.local`

### Step 2.5: Phase 1 代码迁移（🔴 关键步骤）

**源文件**：用户提供的 Phase 1 冻结代码（本对话开头已粘贴）

**迁移规则（必须严格遵守）**：
1. **不要重新设计** 任何 Phase 1 已稳定的内容
2. `LESSON` object → `student-app/src/lib/lesson.js`，保持完全相同的结构
3. `buildPrompt` 函数 → 必须保持原版简短版本，**不要修改 prompt 内容**
4. `RECOVERY` items → `student-app/src/lib/recovery.js`，保持 6 条原样
5. Upgrade items → 保持 3 级结构（easy/medium/hard），不要增删
6. 组件拆分：
   - `DesignCard.jsx` - 4步设计流程
   - `PromptGenerator.jsx` - prompt 生成和复制
   - `Recovery.jsx` - 帮助页面
   - `Upgrade.jsx` - 升级选项（含 MediumCard, UpgradeCard）
   - `GameNameBadge.jsx` - 游戏名称显示编辑
   - `OwnIdeaInput.jsx` - 自定义输入框
   - `Button.jsx` + `OptionCard.jsx` - 通用 UI 组件

**迁移完成验证**：
- [ ] 学生体验和 Phase 1 完全一致（除新增的 session/event 逻辑）
- [ ] `buildPrompt` 输出和 Phase 1 一字不差
- [ ] 所有 upgrade 的 prompt 和 Phase 1 一致

### Step 3: Student App 改造 (8 files)
1. 拆分 Phase 1 代码到组件文件
2. 添加 `lib/supabase.js`
3. 添加 `lib/events.js`
4. 添加 `NameInput.jsx`
5. 改造 `App.jsx` 加入 session/student 管理
6. 在 7 个触发点插入 event reporting
7. 添加 30 秒状态更新

### Step 4: TA Dashboard 开发 (7 files)
1. `lib/supabase.js` + `lib/conversionScore.js`
2. `Setup.jsx` - Session 创建/选择 + TA 身份
3. `Dashboard.jsx` - 主界面布局 + 轮询逻辑
4. `StudentCard.jsx` - 学生卡片 + +/- 评分按钮
5. `WeightsPanel.jsx` - 权重调整
6. `ExportButton.jsx` - CSV 导出
7. `App.jsx` - 路由 Setup ↔ Dashboard

### Step 5: 本地测试
1. 启动两个 dev server
2. 创建 test session
3. 模拟学生操作 → 验证 events 写入
4. TA 评分 → 验证 scores 写入
5. CSV 导出验证

### Step 5.5: 负载测试与 Dry Run（🔴 Trial Class 前 48 小时必做）

**1. 并发模拟**
- 打开 20 个浏览器 tab（或 2 台电脑各 10 个 tab）
- 每个 tab 独立 NameInput → 20 个学生记录
- 模拟同时点击 Build/Upgrade 流程
- 验证：TA Dashboard 能否正常显示 20 个卡片
- 验证：5 秒轮询不卡

**2. 错误注入测试**
- 中途断网 5 秒 → 验证 event 队列 recovery
- 关闭一个学生 tab → 验证学生状态保留
- 刷新学生页面 → 验证 localStorage 继续 session

**3. Supabase Free Tier 压测**
- 跑完整 60 分钟模拟
- 监控 Supabase Dashboard 的 egress
- 如果接近 500MB → 必须升级 Pro 或优化 query

**4. TA Dry Run**
- 找 1 个朋友/家人扮演 TA
- 全程使用 TA Dashboard 评分
- 验证：评分是否流畅、CSV 导出是否正确

**5. 跨浏览器测试**
- Chrome（学生主用）
- Safari（部分学生）
- 必须两个都 work

---

## 6. 验证清单

### Backend
- [ ] Supabase schema 创建成功
- [ ] anon key 可以 insert/select 所有表

### Student App
- [ ] 无 session 参数时显示错误提示
- [ ] 有效 session URL 显示 NameInput（只输入名字）
- [ ] session 已 ended 时显示 "Class ended"
- [ ] 创建学生记录成功
- [ ] 7 种 events 正确上报（含离线队列）
- [ ] Event 队列离线后重试成功
- [ ] 30 秒状态更新工作

### TA Dashboard
- [ ] 可创建新 Session（自动复制学生 URL）
- [ ] 创建后显示二维码（可扫码加入）
- [ ] 可选择 TA 身份
- [ ] 学生列表 5 秒自动刷新
- [ ] 评分按钮正确写入 scores
- [ ] 未评分显示 `-`，点 +/- 后变成 5
- [ ] 两个 TA 评分取平均值显示
- [ ] Conversion Score 随权重变化
- [ ] 软删除学生正确（不显示但数据保留）
- [ ] End Session 后学生端进入只读模式（可继续用，但不上报）
- [ ] CSV 导出包含完整数据
- [ ] 同名学生显示 UUID 前 4 位区分

### End-to-End
- [ ] 学生改名 → TA 看到 event
- [ ] 学生 Copy upgrade → TA 看到 event
- [ ] 10+ 学生并发不卡

---

## 7. 待用户操作

实施前用户需要：
1. 创建 Supabase 项目 (https://supabase.com/dashboard)
2. 执行 SQL schema
3. 复制 URL 和 anon key
