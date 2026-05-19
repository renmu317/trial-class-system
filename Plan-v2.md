# Phase 2 修正计划 - 基于实际 Phase 1 代码

## Phase 1 代码结构分析

### LESSON 配置（必须保留）
```javascript
LESSON = {
  id: "catch-falling-v1",
  title: "Catch Falling Game",
  emoji: "🎮",
  steps: [
    { id: "catchItem", label: "What do you catch?", options: [...] },
    { id: "avoidItem", label: "What do you avoid?", options: [...] },
    { id: "background", label: "Background color?", options: [...] },
    { id: "difficulty", label: "How hard?", options: [..., meta: {speed, lives}] }
  ],
  ownIdeaMaxLength: 60,
  gameNameMaxLength: 30,
  defaultGameName: (choices, ownInputs) => {...},
  buildPrompt: (choices, ownInputs, gameName) => {...}  // 详细的 prompt 模板
}
```

### Upgrades 结构（3级难度）
```javascript
upgrades: [
  // Easy 级别 - 简单 prompt 字符串
  { id: "lives", level: "easy", title: "Lives Counter", emoji: "❤️", prompt: "..." },
  { id: "__own__", level: "easy", isOwn: true, buildPrompt: (text) => `...${text}...` },

  // Medium 级别 - 有 params 和 think 提示
  { id: "boss", level: "medium", think: "...", params: [...], buildPrompt: (p) => `...${p.score}...` },

  // Hard 级别 - prompt: null，用户自己写
  { id: "difficulty-curve", level: "hard", hint: "...", prompt: null }
]
```

### RECOVERY 帮助项（6条）
```javascript
RECOVERY = [
  { id: "no-game", icon: "👻", title: "Claude only showed text...", fix: "..." },
  { id: "broken", icon: "🐛", title: "Game showed up but doesn't work", fix: "..." },
  // ... 共 6 条
]
```

### 组件列表（必须保留）
1. `Button` - 通用按钮（variant: primary/success/secondary/ghost）
2. `OptionCard` - 选项卡片
3. `GameNameBadge` - 游戏名称编辑（displayName + isCustom 逻辑）
4. `OwnIdeaInput` - 自定义输入框（带字符计数）
5. `DesignCard` - 4步设计流程（stepIdx 状态）
6. `PromptGenerator` - prompt 生成和复制
7. `Recovery` - 帮助页面（accordion 展开）
8. `Upgrade` - 升级选项
   - `MediumCard` - Medium 级别卡片（带参数输入）
   - `UpgradeCard` - 通用升级卡片（处理 easy/hard/own）
9. `LEVEL_CONFIG` - 级别配置（easy/medium/hard 颜色和描述）
10. `TABS` - 底部导航栏

---

## Phase 2 修改计划

### 文件结构
```
student-app/src/
├── App.jsx                 # 主入口 - 添加 session/student 管理
├── lib/
│   ├── supabase.js        # Supabase client
│   ├── events.js          # Event 上报
│   ├── lesson.js          # LESSON + RECOVERY + LEVEL_CONFIG（从 Phase 1 提取）
│   └── upgrades.js        # upgrades 数组（从 Phase 1 提取）
├── components/
│   ├── Button.jsx         # 原样保留
│   ├── OptionCard.jsx     # 原样保留
│   ├── GameNameBadge.jsx  # 添加 event: game_named
│   ├── OwnIdeaInput.jsx   # 原样保留
│   ├── DesignCard.jsx     # 添加 event: own_idea_typed
│   ├── PromptGenerator.jsx # 原样保留
│   ├── Recovery.jsx       # 添加 event: help_requested
│   ├── Upgrade.jsx        # 添加 events: upgrade_selected, upgrade_retried, level_opened
│   ├── MediumCard.jsx     # 原样保留
│   ├── UpgradeCard.jsx    # 原样保留
│   └── NameInput.jsx      # 新增：学生加入页面
└── index.css              # Tailwind
```

### 需要修改的文件（最小改动原则）

#### 1. App.jsx 改动
```javascript
// 新增状态
const [sessionId, setSessionId] = useState(null);
const [sessionStatus, setSessionStatus] = useState(null);
const [studentId, setStudentId] = useState(null);
const [studentName, setStudentName] = useState('');
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);
const [upgradeCopyCounts, setUpgradeCopyCounts] = useState({});  // 追踪复制次数

// 新增 useEffect: session 初始化、event flush、状态更新

// 新增渲染逻辑:
// - loading 时显示 spinner
// - error 时显示错误页面
// - !studentId 时显示 NameInput
// - sessionStatus === 'ended' 时显示 banner
// - 其他保持原样
```

#### 2. GameNameBadge.jsx 改动
```javascript
// save 函数中添加
const save = () => {
  const newName = text.trim().slice(0, LESSON.gameNameMaxLength);
  onSave(newName, gameName);  // 传递 oldName 用于 event
  setEditing(false);
};

// App.jsx 中
<GameNameBadge
  ...
  onSave={(newName, oldName) => {
    setGameName(newName);
    reportEvent('game_named', 'ownership', { old: oldName, new: newName });
  }}
/>
```

#### 3. DesignCard.jsx 改动
```javascript
// submitOwnIdea 函数中添加 callback
const submitOwnIdea = (text) => {
  setOwnInputs({ ...ownInputs, [step.id]: text });
  setChoices({ ...choices, [step.id]: "__own__" });
  onOwnIdeaSubmit?.(step.id, text);  // 新增 callback
  advance();
};

// App.jsx 中
<DesignCard
  ...
  onOwnIdeaSubmit={(stepId, text) => {
    reportEvent('own_idea_typed', 'ownership', { step: stepId, text });
  }}
/>
```

#### 4. Recovery.jsx 改动
```javascript
// onClick 中添加 callback
<button
  onClick={() => {
    const newId = openId === item.id ? null : item.id;
    setOpenId(newId);
    if (newId) onHelpOpen?.(item.id);  // 展开时触发
  }}
  ...
>
```

#### 5. Upgrade.jsx 改动
```javascript
// copyText 函数修改
const copyText = async (text, id, level) => {
  // ... 原有复制逻辑 ...
  onUpgradeCopy?.(id, level);  // 新增 callback
};

// openLevels 变化时触发 event
const toggleLevel = (lvl) => {
  const wasOpen = openLevels[lvl];
  setOpenLevels({ ...openLevels, [lvl]: !wasOpen });
  if (!wasOpen && (lvl === 'medium' || lvl === 'hard')) {
    onLevelOpen?.(lvl);  // 新增 callback
  }
};
```

---

## Event 触发点（7个）

| Event | 触发位置 | 维度 | data |
|-------|---------|------|------|
| `game_named` | GameNameBadge.save() | ownership | `{old, new}` |
| `own_idea_typed` | DesignCard.submitOwnIdea() | ownership | `{step, text}` |
| `upgrade_selected` | Upgrade.copyText() | ownership | `{upgrade_id, level, count}` |
| `upgrade_retried` | Upgrade.copyText() (count>=2) | persistence | `{upgrade_id, count}` |
| `help_requested` | Recovery.onClick() | persistence | `{help_id}` |
| `medium_challenge_opened` | Upgrade.toggleLevel('medium') | curiosity | `{}` |
| `hard_challenge_opened` | Upgrade.toggleLevel('hard') | curiosity | `{}` |

---

## 实施步骤

### Step 1: 提取 Phase 1 代码到独立文件
1. `lib/lesson.js` - LESSON, RECOVERY, LEVEL_CONFIG, TABS
2. `components/*.jsx` - 所有组件原样提取

### Step 2: 添加 Phase 2 基础设施
1. `lib/supabase.js` - 已完成
2. `lib/events.js` - 已完成
3. `components/NameInput.jsx` - 需要重写（更简洁）

### Step 3: 修改组件添加 event callbacks
1. GameNameBadge - 添加 onSave(newName, oldName)
2. DesignCard - 添加 onOwnIdeaSubmit(stepId, text)
3. Recovery - 添加 onHelpOpen(helpId)
4. Upgrade - 添加 onUpgradeCopy(id, level), onLevelOpen(level)

### Step 4: 重写 App.jsx
1. 添加 session/student 状态管理
2. 添加 loading/error 渲染
3. 添加 NameInput 渲染
4. 添加 event 上报逻辑
5. 添加 session ended banner
6. 保持原有 UI 逻辑不变

---

## 验证清单

- [ ] Phase 1 功能完全保留（UI、交互、prompt 生成）
- [ ] buildPrompt 输出与 Phase 1 一字不差
- [ ] 所有 upgrade prompt 与 Phase 1 一致
- [ ] 7 个 event 正确上报
- [ ] Session 管理正常（URL 参数、localStorage）
- [ ] Session ended 时进入只读模式
