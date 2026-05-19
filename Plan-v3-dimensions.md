# V17 五维度重设计方案 (完整版)

## 一、背景

基于真实教学评估表（V17文档），原有的5维度1-10分评分系统存在问题：
- TA认知负担过重（5×10×学生数 = 大量决策）
- 维度定义与纸笔表不对齐
- 无法区分"系统可测"和"TA观察"

新方案核心改变：**从评分制改为信号采集制**

---

## 二、新五维度定义

| # | 维度 | 英文 | 核心问题 | 自动率 |
|---|------|------|----------|--------|
| 1 | 能力闭环 | Competence Loop | 学生能做出游戏吗？ | 100% |
| 2 | 归属感 | Ownership | 学生认为这是"我的"游戏吗？ | 33% |
| 3 | 坚持力 | Persistence | 学生卡住后能恢复吗？ | 60% |
| 4 | 挑战种子 | Challenge Seed | 学生想要更多吗？ | 60% |
| 5 | 家长信号 | Parent Signal | 家长有购买意向吗？ | 0% |

---

## 三、信号采集明细

### 3.1 Competence Loop（能力闭环）- 100% 自动

| 信号 | 代码字段 | Event 触发点 | 判定逻辑 |
|------|----------|--------------|----------|
| Made game | `cl_game_made` | `prompt_generated` | 复制 prompt 时触发 |
| Played game | `cl_game_played` | `prompt_tab_revisited` | 从其他tab切回prompt tab |
| Modified game | `cl_game_modified` | `upgrade_selected` | count ≥ 1 |

**TA操作：无（纯系统检测）**

---

### 3.2 Ownership（归属感）- 33% 自动

| 信号 | 代码字段 | 采集方式 | 判定逻辑 |
|------|----------|----------|----------|
| Named | `ow_named` | 系统自动 | `game_named` 且 name ≠ 默认值 |
| Custom name | `ow_custom_name` | 系统自动 | 存储自定义名称 |
| Showed to peer | `ow_showed` | TA checkbox | 学生主动展示给邻座 |
| Explained | `ow_explained` | TA checkbox | 学生能解释游戏规则 |

**TA操作：2个checkbox**
- [ ] Showed game to peer
- [ ] Explained game to TA

---

### 3.3 Persistence（坚持力）- 60% 自动

| 信号 | 代码字段 | 采集方式 | 判定逻辑 |
|------|----------|----------|----------|
| Got stuck | `ps_got_stuck` | 系统检测 | >3分钟无任何event |
| Recovered | `ps_recovered` | 系统检测 | stuck后继续有action |
| Asked for help | `ps_asked_help` | 系统自动 | `help_requested` event存在 |

**TA操作：无（纯系统检测）**

**Stuck检测逻辑：**
```javascript
// 在 TA Dashboard 的轮询中检测
const lastEventTime = student.events?.[0]?.created_at;
const minutesSinceLastEvent = (Date.now() - new Date(lastEventTime)) / 60000;
const isStuck = minutesSinceLastEvent > 3;

// 如果之前stuck现在有新event，则recovered
const wasStuck = signals.ps_got_stuck;
const hasNewEvent = minutesSinceLastEvent < 1;
const recovered = wasStuck && hasNewEvent;
```

---

### 3.4 Challenge Seed（挑战种子）- 60% 自动

| 信号 | 代码字段 | 采集方式 | 判定逻辑 |
|------|----------|----------|----------|
| Used hard level | `cs_used_hard` | 系统自动 | `hard_challenge_opened` |
| Used medium level | `cs_used_medium` | 系统自动 | `medium_challenge_opened` |
| Own idea | `cs_own_idea` | 系统自动 | upgrade中提交own idea |
| Verbal want | `cs_verbal_want` | TA checkbox | 学生说"我想加XX" |
| Kept working | `cs_kept_working` | 系统检测 | session ended后仍有event |

**TA操作：1个checkbox**
- [ ] Said "I want to add ___"

---

### 3.5 Parent Signal（家长信号）- 0% 自动

| 信号 | 代码字段 | 采集方式 | 含义 |
|------|----------|----------|------|
| Took photo | `pr_took_photo` | TA checkbox | 家长拍照/录视频 |
| Asked price | `pr_asked_price` | TA checkbox | 家长询问价格/课程 |
| Stayed long | `pr_stayed_long` | TA checkbox | 家长停留>5分钟 |
| Looked at screen | `pr_looked_screen` | TA checkbox | 家长看孩子屏幕 |

**TA操作：4个checkbox**

---

## 四、TA 总工作量

| 维度 | TA checkbox数 |
|------|---------------|
| Competence | 0 |
| Ownership | 2 |
| Persistence | 0 |
| Challenge Seed | 1 |
| Parent Signal | 4 |
| **总计** | **7 个 checkbox** |

对比旧方案：5维度 × 点击+/-调整 = **50+ 次操作** → 现在只需 **7 次勾选**

---

## 五、新 Supabase Schema

```sql
-- 新的 student_signals 表（替代 scores 表）
create table student_signals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade unique,

  -- Competence Loop (系统自动)
  cl_game_made boolean default false,
  cl_game_played boolean default false,
  cl_game_modified boolean default false,

  -- Ownership (混合)
  ow_named boolean default false,
  ow_custom_name text,
  ow_showed boolean default false,        -- TA
  ow_explained boolean default false,     -- TA

  -- Persistence (系统自动)
  ps_got_stuck boolean default false,
  ps_recovered boolean default false,
  ps_asked_help boolean default false,

  -- Challenge Seed (混合)
  cs_used_hard boolean default false,
  cs_used_medium boolean default false,
  cs_own_idea boolean default false,
  cs_verbal_want boolean default false,   -- TA
  cs_kept_working boolean default false,

  -- Parent Signal (TA手动)
  pr_took_photo boolean default false,    -- TA
  pr_asked_price boolean default false,   -- TA
  pr_stayed_long boolean default false,   -- TA
  pr_looked_screen boolean default false, -- TA

  -- 元数据
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create index idx_signals_student on student_signals(student_id);

alter table student_signals enable row level security;
create policy "anon_signals" on student_signals for all using (true) with check (true);
```

---

## 六、新 Events 列表

### 6.1 需要新增的 Events

| Event | 触发点 | 对应信号 |
|-------|--------|----------|
| `prompt_generated` | PromptGenerator 复制按钮 | cl_game_made |
| `prompt_tab_revisited` | tab从非prompt切到prompt | cl_game_played |
| `upgrade_own_idea_submitted` | Upgrade own idea 复制 | cs_own_idea |

### 6.2 已有 Events（保持不变）

| Event | 触发点 | 对应信号 |
|-------|--------|----------|
| `game_named` | GameNameBadge 保存 | ow_named |
| `help_requested` | Recovery 展开 | ps_asked_help |
| `upgrade_selected` | 任意upgrade复制 | cl_game_modified |
| `hard_challenge_opened` | 展开hard级别 | cs_used_hard |
| `medium_challenge_opened` | 展开medium级别 | cs_used_medium |

---

## 七、新 StudentCard UI

```
┌─────────────────────────────────────────────────────┐
│ Alex Chen #a3f2              Score: 0.72            │
│ "My Stars Catcher"           Step: upgrade          │
├─────────────────────────────────────────────────────┤
│ 🟢 COMPETENCE LOOP                          [3/3]   │
│   ✅ Made game   ✅ Played   ✅ Modified            │
├─────────────────────────────────────────────────────┤
│ 🟡 OWNERSHIP                                [1/3]   │
│   ✅ Named: "My Stars Catcher"                      │
│   ☐ Showed to peer          ☐ Explained to TA      │
├─────────────────────────────────────────────────────┤
│ 🟡 PERSISTENCE                              [2/3]   │
│   ✅ Got stuck (3m+)   ✅ Recovered   ☐ Asked help │
├─────────────────────────────────────────────────────┤
│ 🟡 CHALLENGE SEED                           [2/4]   │
│   ☐ Hard level   ✅ Medium   ✅ Own idea           │
│   ☐ Said "I want to add..."                         │
├─────────────────────────────────────────────────────┤
│ 🔴 PARENT SIGNAL                            [0/4]   │
│   ☐ Took photo    ☐ Asked price                    │
│   ☐ Stayed >5min  ☐ Looked at screen               │
└─────────────────────────────────────────────────────┘

Legend:
  ✅ = 系统自动检测到 (只读)
  ☐  = TA可勾选
  🟢 = 100%自动   🟡 = 部分自动   🔴 = TA手动
```

---

## 八、Conversion Score 算法

```javascript
// lib/conversionScore.js (新版)

export function calculateConversionScore(signals) {
  if (!signals) return null;

  // 维度权重（基于转化重要性）
  const weights = {
    competence: 2.0,     // 最重要：能做出东西
    ownership: 1.5,      // 重要：有归属感
    persistence: 1.0,    // 中等：能坚持
    challenge: 1.5,      // 重要：想要更多
    parent: 2.5          // 最重要：家长买单
  };

  // 计算每个维度得分 (0-1)
  const dimensionScores = {
    competence: average([
      signals.cl_game_made,
      signals.cl_game_played,
      signals.cl_game_modified
    ]),

    ownership: average([
      signals.ow_named,
      signals.ow_showed,
      signals.ow_explained
    ]),

    persistence: calculatePersistence(signals),

    challenge: average([
      signals.cs_used_hard || signals.cs_used_medium,  // 用了任一难度
      signals.cs_own_idea,
      signals.cs_verbal_want,
      signals.cs_kept_working
    ]),

    parent: average([
      signals.pr_took_photo,
      signals.pr_asked_price,
      signals.pr_stayed_long,
      signals.pr_looked_screen
    ])
  };

  // 加权平均
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const weightedSum = Object.entries(weights).reduce(
    (sum, [key, weight]) => sum + (dimensionScores[key] || 0) * weight,
    0
  );

  return (weightedSum / totalWeight).toFixed(2);
}

function average(booleans) {
  const valid = booleans.filter(b => b !== null && b !== undefined);
  if (valid.length === 0) return 0;
  return valid.filter(Boolean).length / valid.length;
}

function calculatePersistence(signals) {
  // 特殊逻辑：没卡住=满分，卡住+恢复=满分，卡住没恢复=0
  if (!signals.ps_got_stuck) return 1;
  if (signals.ps_recovered) return 1;
  // 卡住但求助了，给0.5
  if (signals.ps_asked_help) return 0.5;
  return 0;
}
```

---

## 九、CSV 导出格式

```csv
name,game_name,step,score,cl_made,cl_played,cl_modified,ow_named,ow_showed,ow_explained,ps_stuck,ps_recovered,ps_help,cs_hard,cs_medium,cs_own,cs_verbal,cs_kept,pr_photo,pr_price,pr_stay,pr_look
Alex,My Stars,upgrade,0.72,true,true,true,true,false,false,true,true,false,false,true,true,false,false,false,false,false,false
Brian,My Coin,prompt,0.45,true,false,false,true,false,false,false,false,false,false,false,false,false,false,false,false,false,false
```

---

## 十、实施步骤

### Step 1: Schema 更新
1. 在 Supabase 执行新 SQL（创建 student_signals 表）
2. 保留旧 scores 表（向后兼容）

### Step 2: Student App 改造
1. 新增 `prompt_generated` event（PromptGenerator.jsx）
2. 新增 `prompt_tab_revisited` event（App.jsx）
3. 新增 `upgrade_own_idea_submitted` event（Upgrade.jsx）
4. 修改 `game_named` event 携带 isCustomName

### Step 3: TA Dashboard 改造
1. 新建 `lib/signalScore.js`（新算法）
2. 重写 `StudentCard.jsx`（checkbox UI）
3. 更新 `Dashboard.jsx`（读取 signals + 自动检测 stuck）
4. 更新 `ExportButton.jsx`（新 CSV 格式）

### Step 4: 自动信号同步
1. Dashboard 轮询时检测 stuck/recovered
2. 根据 events 自动更新 signals 表
3. TA checkbox 变化实时写入 signals 表

---

## 十一、验证清单

### Schema
- [ ] student_signals 表创建成功
- [ ] 所有字段默认值正确

### Student App
- [ ] prompt_generated 正确触发
- [ ] prompt_tab_revisited 正确触发
- [ ] upgrade_own_idea_submitted 正确触发

### TA Dashboard
- [ ] 系统信号显示为只读 ✅
- [ ] TA checkbox 可点击并保存
- [ ] Stuck 检测逻辑正确（>3min无event）
- [ ] Recovered 检测逻辑正确
- [ ] Conversion Score 计算正确
- [ ] CSV 导出包含所有字段

### 端到端
- [ ] 学生完成流程 → signals 自动填充
- [ ] TA 勾选 checkbox → 实时保存
- [ ] 多TA同时操作不冲突
