# P3 Agentic AI - 执行计划

## 项目概述

在现有 Trial Class System monorepo 基础上新增：
- **conversion_signals 表** - 转化信号追踪（独立于 student_signals）
- **reports 表 + view** - AI 生成报告 + 折扣时间窗口（view 实时计算）
- **sales-app** - 销售端手机 App (port 5175, 简化为单页 MVP)
- **report-app** - 独立报告网页 (port 5176, 不改动已上线 student-app)

## 关键决定

| 决定项 | 选择 |
|--------|------|
| conversion_signals vs student_signals | 保持独立表 |
| DeepSeek API 调用 | Phase A 前端直接调用 |
| Sales App 登录 | MVP 跳过，hardcode 测试 |
| Sales App 复杂度 | 简化为单页 |
| 报告网页位置 | **独立 report-app**（student-app 无 Router，改动风险高） |
| 课程大纲 | 用户提供文档 |

---

## Day 1 (今天) - 数据库 + Prompt

### D1-1: 建 conversion_signals 表

**文件**: `Trial_Class_System/p3-schema.sql`

```sql
-- conversion_signals 表（独立于 student_signals）
-- 修正：unique(student_id, session_id) 而非 student_id unique，允许同一学生参加多期试课
create table conversion_signals (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,

  -- TA 写入（同步销售端）
  pa_stayed bool default false,
  pa_photo bool default false,
  pa_asked_price bool default false,      -- 触发销售提醒
  pa_leaned_in bool default false,
  pa_surprised bool default false,
  ch_showed_parent bool default false,    -- 触发销售提醒
  ch_wants_continue bool default false,   -- 触发销售提醒
  ch_explained_parent bool default false,

  -- 销售写入
  sale_qr_shown bool default false,
  sale_deposit_taken bool default false,
  sale_intent_tier text check (sale_intent_tier in ('Hot','Warm','Cold')),
  sale_notes text,

  -- 系统自动（网页埋点）- 移到 reports 表，因为埋点是针对报告的

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- 复合唯一约束：同一学生同一场次只有一条记录
  unique(student_id, session_id)
);

-- 索引
create index idx_conversion_signals_student on conversion_signals(student_id);
create index idx_conversion_signals_session on conversion_signals(session_id);

-- RLS（MVP: anon 全开放，后续加 role 限制）
alter table conversion_signals enable row level security;
create policy "anon_conversion" on conversion_signals for all using (true) with check (true);

-- 开启 Realtime
alter publication supabase_realtime add table conversion_signals;
```

### D1-2: 建 reports 表 + view

```sql
-- reports 表（不用 generated column，因为 now() 是 volatile 函数）
create table reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  student_id uuid references students(id) on delete cascade,

  content_zh text,
  content_en text,
  pathway_zh text,
  pathway_en text,
  cta_tier text check (cta_tier in ('enrolled','hot','warm','cold')),

  share_token uuid unique default gen_random_uuid(),

  -- 报告网页埋点（从 conversion_signals 移过来，因为埋点是针对报告的）
  rep_opened bool default false,
  rep_read_depth bool default false,
  rep_cta_clicked bool default false,
  rep_shared bool default false,

  sent_at timestamptz,
  created_at timestamptz default now()
);

-- 索引
create index idx_reports_student on reports(student_id);
create index idx_reports_token on reports(share_token);

-- RLS
alter table reports enable row level security;
create policy "anon_reports" on reports for all using (true) with check (true);

-- View: 实时计算 discount_tier（每次查询时计算，而非存储时）
create view reports_with_discount as
select *,
  case
    when created_at > now() - interval '1 day' then '200'
    when created_at > now() - interval '2 days' then '100'
    when created_at > now() - interval '3 days' then '50'
    else 'none'
  end as discount_tier
from reports;
```

**重要**：前端查询报告时使用 `reports_with_discount` view 而非 `reports` 表。

### D1-3: DeepSeek Prompt 设计 + JSON 解析防护

**文件**: `ta-dashboard/src/lib/reportPrompt.js`

```javascript
export function buildReportPrompt(studentData, signalData, conversionData, courseOutline) {
  return {
    model: 'deepseek-chat',
    temperature: 0.4,
    max_tokens: 1000,
    messages: [
      {
        role: 'system',
        content: `你是一位专业的教育顾问。根据学生今日试课表现，生成双语报告。
只返回纯 JSON，不要任何其他文字：
{
  "narrative_zh": "中文报告（≤200字）",
  "narrative_en": "英文报告（≤200字）",
  "pathway_zh": "中文学习路径",
  "pathway_en": "英文学习路径",
  "cta_tier": "enrolled|hot|warm|cold"
}

语气要求：温暖、专业、不夸大。`
      },
      {
        role: 'user',
        content: `学生信息：${JSON.stringify(studentData)}
信号数据：${JSON.stringify(signalData)}
转化信号：${JSON.stringify(conversionData)}
20节课大纲：${courseOutline}`
      }
    ]
  };
}

// JSON 解析防护：DeepSeek 偶尔会在 JSON 前后加说明文字
export function parseDeepSeekResponse(responseText) {
  // 先尝试直接解析
  try {
    return JSON.parse(responseText);
  } catch (e) {
    // 用正则提取 {...} 部分
    const match = responseText.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e2) {
        throw new Error('Failed to parse DeepSeek response: ' + responseText.slice(0, 100));
      }
    }
    throw new Error('No JSON found in DeepSeek response');
  }
}
```

### Day 1 检查点
- [ ] Supabase 执行 p3-schema.sql 成功
- [ ] 手动测试 DeepSeek API 调用返回正确 JSON

---

## Day 2 - 报告生成 + 报告网页

### D2-1: ReportGenerator 组件

**文件**: `ta-dashboard/src/components/ReportGenerator.jsx`

- StudentCard 底部加「生成报告」按钮
- 点击后拉取 student_signals + conversion_signals
- 调用 DeepSeek API
- 结果存入 reports 表
- 状态：idle → loading → done/error

### D2-2: ReportReviewPanel 组件

**文件**: `ta-dashboard/src/components/ReportReviewPanel.jsx`

- 左栏中文，右栏英文
- contentEditable 实现 inline 编辑
- 发送渠道选择（mailto: / sms: 协议）
- 生成 share_token URL

### D2-3: 独立报告网页 (report-app)

**原因**: student-app 没有 React Router，加路由会改动多个文件，影响已上线功能。新建独立项目更安全。

**文件结构**: `Trial_Class_System/report-app/`

```
report-app/
├── src/
│   ├── App.jsx           # 报告页面（根据 URL hash 获取 token）
│   ├── lib/supabase.js   # 复用配置
│   └── main.jsx
├── .env.local            # 复制自 ta-dashboard
└── package.json          # port 5176
```

**URL 格式**: `https://report-app.vercel.app/#/{share_token}`（用 hash 路由，无需服务端配置）

**核心逻辑**:

```javascript
// App.jsx
useEffect(() => {
  const token = window.location.hash.slice(2); // 去掉 #/
  if (!token) return;

  const loadReport = async () => {
    // 使用 view 获取实时计算的 discount_tier
    const { data, error } = await supabase
      .from('reports_with_discount')
      .select('*')
      .eq('share_token', token)
      .single();

    if (data) {
      setReport(data);

      // rep_shared 检测：如果 rep_opened 已经是 true，说明是二次打开
      if (data.rep_opened) {
        await supabase.from('reports').update({ rep_shared: true }).eq('share_token', token);
      } else {
        // 首次打开
        await supabase.from('reports').update({ rep_opened: true }).eq('share_token', token);
      }
    }
  };

  loadReport();
}, []);

// IntersectionObserver 监听滚动深度
useEffect(() => {
  if (!report) return;
  const observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        supabase.from('reports').update({ rep_read_depth: true }).eq('id', report.id);
        observer.disconnect();
      }
    },
    { threshold: 0.7 }
  );
  const target = document.getElementById('report-bottom');
  if (target) observer.observe(target);
  return () => observer.disconnect();
}, [report]);

// CTA 点击
const handleCtaClick = async () => {
  await supabase.from('reports').update({ rep_cta_clicked: true }).eq('id', report.id);
  // 跳转到报名页面...
};
```

**CTA 文案逻辑**:
| discount_tier | cta_tier | 文案 |
|---------------|----------|------|
| '200' | enrolled | 欢迎加入！查看课程安排 |
| '200' | hot | 今日报名优惠 -$200 |
| '100' | * | 24小时内 -$100 |
| '50' | * | 48小时内 -$50 |
| 'none' | * | 了解完整课程 |

### Day 2 检查点
- [ ] report-app 项目创建成功，port 5176 可访问
- [ ] 完整跑通：生成报告 → 预览 → 发送链接 → 打开 report-app → CTA 点击
- [ ] rep_opened/rep_shared/rep_read_depth/rep_cta_clicked 埋点正确写入

---

## Day 3 - TA UI + Sales App (简化)

### D3-1: TA Dashboard conversion_signals 区块

**文件**: `ta-dashboard/src/components/StudentCard.jsx`

- 在 Parent Signal 下方加折叠区块「转化观察」
- 8 个 checkbox：pa_stayed, pa_photo, pa_asked_price, pa_leaned_in, pa_surprised, ch_showed_parent, ch_wants_continue, ch_explained_parent
- 勾选时 upsert 到 conversion_signals
- 触发提醒的三个字段橙色高亮

### D3-2: Sales App MVP (简化单页)

**文件结构**: `Trial_Class_System/sales-app/`

```
sales-app/
├── src/
│   ├── App.jsx           # 单页：学生列表 + 详情
│   ├── lib/supabase.js   # 复用配置
│   └── main.jsx
├── .env.local            # 复制自 ta-dashboard
└── package.json          # port 5175
```

功能：
- 直接显示最新 session 的学生列表
- Supabase Realtime 订阅 conversion_signals
- 高亮显示触发提醒的学生（pa_asked_price/ch_showed_parent/ch_wants_continue）
- 点击学生展开详情，三个大按钮（已展示QR / 已付定金 / Hot·Warm·Cold）

### Day 3 检查点
- [ ] TA 勾选 ch_showed_parent → 销售端实时更新
- [ ] 销售点击按钮 → Supabase 有数据

---

## Day 4 - 测试 + 缓冲

### D4-1: 端到端测试

完整流程：
1. 建 session
2. 学生进入 student-app
3. TA 填写 student_signals + conversion_signals
4. 销售端看到实时更新
5. 销售填写 sale_* 字段
6. TA 生成报告
7. TA 预览编辑发送
8. 打开报告页验证 CTA
9. 点击 CTA 验证埋点

### D4-2: 折扣窗口测试

手动修改 reports.created_at 验证：
- 当天 → -$200
- 25h 前 → -$100
- 49h 前 → -$50
- 4天前 → 无折扣

---

## 20 节课大纲 (用于 Prompt)

**文件**: `ta-dashboard/src/lib/courseOutline.js`

```javascript
export const COURSE_OUTLINE = {
  phases: [
    {
      id: 1,
      name: "AI Game Creation",
      lessons: "1-5",
      goal: "Build the feeling 'I can create things' · Learn to express ideas precisely to AI",
      contents: [
        { lesson: 1, title: "AI Fruit-Catching Game", desc: "First time using AI to make a game" },
        { lesson: 2, title: "AI Maze Challenge", desc: "AI generates maze · Add obstacles" },
        { lesson: 3, title: "AI Platformer Game", desc: "AI generates platformer · First debug" },
        { lesson: 4, title: "AI Shooter Game", desc: "AI generates shooter · Add scoring" },
        { lesson: 5, title: "AI Story Adventure", desc: "Interactive story · Multiple endings" }
      ]
    },
    {
      id: 2,
      name: "Roblox World",
      lessons: "6-8",
      goal: "Move from browser games into 3D worlds · Experience collaborative creation",
      contents: [
        { lesson: 6, title: "Roblox World Building", desc: "Roblox Studio basics · Create maps" },
        { lesson: 7, title: "Roblox Interactive Challenge", desc: "Multiplayer mini-game" },
        { lesson: 8, title: "Creative Game Challenge", desc: "Student-designed game · Showcase" }
      ]
    },
    {
      id: 3,
      name: "AI Robotics",
      lessons: "9-17",
      goal: "Move from screen to physical world · Control a real robot with AI",
      contents: [
        { lesson: 9, title: "Meet the AI Robot", desc: "Motors, LEDs, ultrasonic sensors" },
        { lesson: 10, title: "AI Controls Robot", desc: "AI generates Arduino code" },
        { lesson: 11, title: "Robot Assembly Part 1", desc: "Chassis · Motor · Battery" },
        { lesson: 12, title: "Robot Assembly Part 2", desc: "Sensors · Wiring" },
        { lesson: 13, title: "Robot Motion Control", desc: "Forward, reverse, turning" },
        { lesson: 14, title: "AI Obstacle-Avoiding", desc: "Ultrasonic · Avoidance code" },
        { lesson: 15, title: "AI Light-Interactive", desc: "LED · Button control" },
        { lesson: 16, title: "Sound & Remote Control", desc: "Buzzer · Infrared" },
        { lesson: 17, title: "Creative Robot Modification", desc: "Custom functions" }
      ]
    },
    {
      id: 4,
      name: "Final Showcase",
      lessons: "18-20",
      goal: "Establish creator identity · Parent showcase event",
      contents: [
        { lesson: 18, title: "Final Project Development", desc: "Custom robot gameplay" },
        { lesson: 19, title: "Final Polish & Showcase Prep", desc: "Bug fixes · Practice presenting" },
        { lesson: 20, title: "AI Creator Tech Showcase", desc: "Students present · Parents interact" }
      ]
    }
  ],
  takeHome: ["5 AI Mini-Games", "1 Roblox Project", "1 AI Robot"]
};

// 格式化为 Prompt 字符串
export function formatCourseOutlineForPrompt() {
  return COURSE_OUTLINE.phases.map(p =>
    `Phase ${p.id}: ${p.name} (Lessons ${p.lessons})\n` +
    `Goal: ${p.goal}\n` +
    p.contents.map(c => `  - Lesson ${c.lesson}: ${c.title}`).join('\n')
  ).join('\n\n');
}
```

## 环境准备清单 (今天完成)

- [ ] 申请 DeepSeek API key → `ta-dashboard/.env.local` 的 `VITE_DEEPSEEK_API_KEY`
- [x] ~~用户提供 20 节课大纲文档~~ ✓ 已收到
- [ ] 执行 p3-schema.sql 到 Supabase
- [ ] 确认 Supabase Realtime 已开启 conversion_signals

## 关键文件列表

| 文件 | 操作 | Day |
|------|------|-----|
| `p3-schema.sql` | 新建 | 1 |
| `ta-dashboard/src/lib/reportPrompt.js` | 新建 | 1 |
| `ta-dashboard/src/lib/courseOutline.js` | 新建 | 1 |
| `ta-dashboard/src/components/ReportGenerator.jsx` | 新建 | 2 |
| `ta-dashboard/src/components/ReportReviewPanel.jsx` | 新建 | 2 |
| `report-app/*` | **新建整个项目** | 2 |
| `ta-dashboard/src/components/StudentCard.jsx` | 修改 | 3 |
| `sales-app/*` | 新建整个项目 | 3 |

## 风险提示

1. **DeepSeek API key 暴露** - Phase A 可接受，正式上线前迁移到 Edge Function
2. **Sales App 简化** - 已决定单页 MVP，不做 SessionPicker 和登录
3. **报告网页移动端** - 如超时，Day 4 继续优化

## 修正记录 (v2)

| 原问题 | 修正方案 |
|--------|----------|
| D1-1 `student_id unique` 过强 | 改为 `unique(student_id, session_id)` |
| D1-2 `generated column` 用 `now()` | 改为 view 实时计算 `discount_tier` |
| D1-3 DeepSeek 可能返回非纯 JSON | 加 `parseDeepSeekResponse()` 正则提取 |
| D2-3 student-app 无 Router | 新建独立 `report-app` |
| D2-3 缺少 `rep_shared` 逻辑 | 首次打开写 `rep_opened`，二次打开写 `rep_shared` |
| `rep_*` 埋点字段位置 | 从 `conversion_signals` 移到 `reports` 表 |

## 验证方式

每天结束时运行端到端测试，确保数据流完整：
- Day 1: SQL 执行成功 + DeepSeek API 手动测试（验证 JSON 解析防护）
- Day 2: 报告生成 → report-app 打开 → rep_opened=true → 再次打开 → rep_shared=true → CTA 点击
- Day 3: TA checkbox → Realtime → Sales App 显示
- Day 4: 完整流程无报错 + 折扣窗口测试（修改 created_at 验证 view 实时计算）

---

# P3.1 双次发送跟进系统 (Follow-up System)

## 功能概述

在原有单次报告发送基础上，新增 **第二次跟进消息**，AI 根据家长行为数据智能生成跟进文案。

### 发送时间线

```
课后 0-2h          异步追踪              24-48h
    │                 │                    │
    ▼                 ▼                    ▼
┌─────────┐    ┌─────────────┐    ┌─────────────┐
│ 第一次  │───▶│ 家长行为    │───▶│ 第二次      │
│ 发送报告│    │ 监测        │    │ 跟进消息    │
└─────────┘    └─────────────┘    └─────────────┘
  TA 触发        自动埋点           TA 触发
  -$200 CTA      rep_opened         AI 重新生成
                 rep_read_depth     基于行为数据
                 rep_shared
```

## 数据库改动

### reports 表新增字段

**文件**: `p3-followup-schema.sql`

```sql
-- 第二次跟进消息字段
ALTER TABLE reports ADD COLUMN followup_content_zh text;
ALTER TABLE reports ADD COLUMN followup_content_en text;
ALTER TABLE reports ADD COLUMN followup_sent_at timestamptz;
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `followup_content_zh` | text | 第二次跟进消息（中文） |
| `followup_content_en` | text | 第二次跟进消息（英文） |
| `followup_sent_at` | timestamptz | 第二次发送时间戳（null=未发送） |

## AI Prompt 设计

### 跟进消息输入数据

| 数据 | 用途 |
|------|------|
| content_zh/en | 第一次报告内容（AI 不重复，做递进） |
| pathway_zh/en | 学习路径（可再次强调） |
| rep_opened | 家长是否打开报告 |
| rep_read_depth | 家长是否读完 |
| rep_shared | 家长是否转发给另一半 |
| discount_tier | 当前折扣窗口（实时计算） |
| sale_intent_tier | 销售判断的意向等级 |

### AI 策略矩阵

| 家长行为 | AI 跟进策略 |
|----------|------------|
| 未打开报告 | 主动语气「不知道您是否看到了孩子的试课表现」 |
| 已打开未读完 | 重提孩子亮点，勾起兴趣 |
| 已读完 | 聚焦下一步行动「什么时候方便确认报名」 |
| 已转发 | 提及家庭优惠「两个孩子一起参加更划算」 |
| Intent=Hot | 直接问时间 |
| Intent=Cold | 软化语气，重提亮点 |

### 新增函数

**文件**: `ta-dashboard/src/lib/reportPrompt.js`

```javascript
export function buildFollowUpPrompt(reportData, behaviorData, conversionData) {
  const { content_zh, content_en, pathway_zh, pathway_en } = reportData;
  const { rep_opened, rep_read_depth, rep_shared, discount_tier } = behaviorData;
  const { sale_intent_tier } = conversionData;

  return {
    model: 'deepseek-chat',
    temperature: 0.5,
    max_tokens: 800,
    messages: [
      {
        role: 'system',
        content: `你是一位专业的教育顾问。现在需要为家长发送第二次跟进消息。

已知信息：
- 第一次报告已发送
- 家长是否打开：${rep_opened ? '是' : '否'}
- 家长是否读完：${rep_read_depth ? '是' : '否'}
- 家长是否转发：${rep_shared ? '是' : '否'}
- 当前折扣：${discount_tier === '200' ? '-$200（今日）' : discount_tier === '100' ? '-$100（24h内）' : discount_tier === '50' ? '-$50（48h内）' : '无'}
- 意向等级：${sale_intent_tier || '未知'}

只返回纯 JSON：
{
  "followup_zh": "中文跟进消息（≤150字，温暖但不啰嗦）",
  "followup_en": "英文跟进消息（≤150字）"
}

策略：
- 未打开报告 → 主动提醒
- 已打开未读完 → 重提孩子亮点
- 已读完 → 聚焦下一步行动
- 已转发 → 提及家庭优惠
- Hot → 直接问时间
- Cold → 软化语气`
      },
      {
        role: 'user',
        content: `第一次报告内容：
中文：${content_zh}
英文：${content_en}

学习路径：
中文：${pathway_zh}
英文：${pathway_en}

请生成跟进消息。`
      }
    ]
  };
}
```

## UI 改动

### ReportReviewPanel 新增「跟进消息」Tab

**文件**: `ta-dashboard/src/components/ReportReviewPanel.jsx`

```
┌─────────────────────────────────────────────────┐
│  [报告]  [跟进消息]                              │
├─────────────────────────────────────────────────┤
│                                                 │
│  家长行为：                                      │
│  ☑ 已打开  ☑ 已读完  ☐ 已转发                   │
│                                                 │
│  折扣窗口：-$100 (剩余 18h)                      │
│                                                 │
│  [生成跟进消息]                                  │
│                                                 │
│  ┌─────────────────┐  ┌─────────────────┐       │
│  │ 中文跟进消息    │  │ English Follow  │       │
│  │ (可编辑)        │  │ (editable)      │       │
│  └─────────────────┘  └─────────────────┘       │
│                                                 │
│                    [发送跟进] [Email] [SMS]      │
└─────────────────────────────────────────────────┘
```

### Sales App 新增三种 Banner

**文件**: `sales-app/src/App.jsx`

| Banner | 触发条件 | 样式 |
|--------|----------|------|
| 📤 报告已发送 | `sent_at` 有值 | 黄色背景 |
| 🔗 家长已转发 | `rep_shared = true` (Realtime) | 蓝色背景 |
| 📞 跟进已发送 | `followup_sent_at` 有值 | 粉色背景 |

**Banner 样式预览**:

```
┌────────────────────────────────────────────────┐
│ 📤 Antony 的报告已发送                          │
│    等待家长打开 · 如24h内未打开请电话跟进        │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│ 🔗 Antony 的家长转发了报告链接                  │
│    家庭正在讨论 · 是跟进的好时机                 │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│ 📞 Antony 的跟进消息已发送 · 请电话/短信跟进    │
│    家长意向：Hot · 折扣窗口：-$100 剩余约6小时   │
└────────────────────────────────────────────────┘
```

**Realtime 订阅**:

```javascript
// 订阅 reports 表的 rep_shared 变化
supabase
  .channel('reports_shared')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'reports',
    filter: `session_id=eq.${session.id}`
  }, (payload) => {
    if (payload.new.rep_shared && !payload.old.rep_shared) {
      // 显示「家长已转发」banner
      showBanner('shared', payload.new.student_id);
    }
    if (payload.new.followup_sent_at && !payload.old.followup_sent_at) {
      // 显示「跟进已发送」banner
      showBanner('followup', payload.new.student_id);
    }
  })
  .subscribe();
```

## 文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `p3-followup-schema.sql` | 新建 | ALTER TABLE reports 加三个字段 |
| `ta-dashboard/src/lib/reportPrompt.js` | 修改 | 新增 `buildFollowUpPrompt()` |
| `ta-dashboard/src/components/ReportReviewPanel.jsx` | 修改 | 新增「跟进消息」Tab |
| `sales-app/src/App.jsx` | 修改 | 新增三种 banner + Realtime 订阅 |

## 实施步骤

### Step 1: 数据库改动 (5 min)

```bash
# 在 Supabase SQL Editor 执行
ALTER TABLE reports ADD COLUMN followup_content_zh text;
ALTER TABLE reports ADD COLUMN followup_content_en text;
ALTER TABLE reports ADD COLUMN followup_sent_at timestamptz;
```

### Step 2: AI Prompt 升级 (15 min)

- 在 `reportPrompt.js` 新增 `buildFollowUpPrompt()` 函数
- 新增 `generateFollowUp()` API 调用封装

### Step 3: ReportReviewPanel 升级 (30 min)

- 新增 Tab 组件
- 新增家长行为显示
- 新增跟进消息生成/编辑/发送

### Step 4: Sales App Banners (20 min)

- 新增 Banner 组件
- 新增 reports 表 Realtime 订阅
- 新增 banner 状态管理

### Step 5: 测试 (15 min)

- 生成报告 → 发送 → 查看 Sales banner
- 打开报告页 → 转发 → 查看 Sales banner (实时)
- 生成跟进 → 发送 → 查看 Sales banner

## 验证清单

- [ ] `followup_content_zh/en` 字段添加成功
- [ ] `buildFollowUpPrompt()` 根据行为数据生成不同语气
- [ ] ReportReviewPanel 显示家长行为状态
- [ ] 跟进消息可生成/编辑/发送
- [ ] Sales App 显示「报告已发送」banner
- [ ] Sales App 实时显示「家长已转发」banner
- [ ] Sales App 显示「跟进已发送」banner

---

*最后更新: 2026-05-19*
