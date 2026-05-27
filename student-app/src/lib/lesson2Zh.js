// Lesson 2: AI Maze Game - Chinese Version
import { DIMENSION_LIBRARY_ZH } from './lessonZh';

export const LESSON_2_ZH = {
  id: "maze-game-v1",
  title: "AI迷宫游戏",
  emoji: "🧩",

  agent: {
    demo_description: "一个有10条通道的迷宫，玩家从左上角走到右下角，躲避陷阱，收集奖励",
  },

  steps: [
    {
      id: "theme",
      label: "迷宫主题？",
      options: [
        { value: "ice-cave", label: "冰洞", emoji: "🧊" },
        { value: "volcano", label: "火山", emoji: "🌋" },
        { value: "space-station", label: "太空站", emoji: "🚀" },
        { value: "underwater", label: "海底", emoji: "🌊" },
        { value: "dark-castle", label: "暗黑城堡", emoji: "🏰" },
        { value: "__own__", label: "我的想法", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "obstacle",
      label: "要躲避的危险物？",
      options: [
        { value: "bombs", label: "炸弹", emoji: "💣" },
        { value: "monsters", label: "怪物", emoji: "👾" },
        { value: "fire-traps", label: "火焰陷阱", emoji: "🔥" },
        { value: "electric-walls", label: "电墙", emoji: "⚡" },
        { value: "rolling-rocks", label: "滚石", emoji: "🪨" },
        { value: "__own__", label: "我的想法", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "reward",
      label: "终点奖励？",
      options: [
        { value: "gold", label: "金币", emoji: "🪙" },
        { value: "diamond", label: "钻石", emoji: "💎" },
        { value: "magic-key", label: "魔法钥匙", emoji: "🗝️" },
        { value: "star-portal", label: "星际传送门", emoji: "⭐" },
        { value: "__own__", label: "我的想法", emoji: "✏️", isOwn: true },
      ],
    },
    {
      id: "size",
      label: "迷宫大小？",
      options: [
        { value: "small", label: "小 (10×10)", emoji: "🔲", meta: { width: 10, height: 10 } },
        { value: "medium", label: "中 (15×15)", emoji: "🔳", meta: { width: 15, height: 15 } },
        { value: "large", label: "大 (20×20)", emoji: "⬛", meta: { width: 20, height: 20 } },
      ],
    },
    {
      id: "background",
      label: "背景颜色？",
      options: [
        { value: "dark blue", label: "深蓝色", emoji: "🟦" },
        { value: "black", label: "黑色", emoji: "⬛" },
        { value: "dark green", label: "深绿色", emoji: "🟩" },
        { value: "__own__", label: "我的想法", emoji: "✏️", isOwn: true },
      ],
    },
  ],

  ruleDesign: {
    enabled: true,
    fields: [
      {
        id: "collision",
        label: "碰撞规则",
        question: "玩家碰到陷阱会怎样？",
        emoji: "💥",
        options: [
          { value: "lose-1-life", label: "失去1条命" },
          { value: "game-over", label: "立即游戏结束" },
          { value: "pushed-back", label: "被推回起点" },
        ],
        allowCustom: true,
        placeholder: "例如：冻住2秒",
      },
      {
        id: "win",
        label: "胜利规则",
        question: "玩家怎样获胜？",
        emoji: "🏆",
        options: [
          { value: "reach-exit", label: "到达出口" },
          { value: "collect-key-exit", label: "收集钥匙后到达出口" },
          { value: "defeat-boss", label: "打败终点的Boss" },
        ],
        allowCustom: true,
        placeholder: "例如：收集所有金币后到达出口",
      },
      {
        id: "lose",
        label: "失败规则",
        question: "多少次失误后游戏结束？",
        emoji: "💀",
        options: [
          { value: "1-mistake", label: "1次失误" },
          { value: "3-lives", label: "3条命" },
          { value: "5-lives", label: "5条命" },
          { value: "time-limit", label: "时间限制" },
        ],
        allowCustom: true,
        placeholder: "例如：10次失误后失败",
      },
      {
        id: "difficulty",
        label: "难度",
        question: "应该有多难？",
        emoji: "⚡",
        options: [
          { value: "slow-player", label: "玩家移动慢" },
          { value: "medium-speed", label: "中等速度" },
          { value: "fast-player", label: "玩家移动快" },
          { value: "lots-of-traps", label: "很多陷阱" },
        ],
        allowCustom: true,
        placeholder: "例如：开始简单，每关变难",
      },
    ],
  },

  debugLog: {
    enabled: true,
    breakTypes: [
      {
        id: "wall",
        label: "墙壁问题",
        emoji: "🧱",
        description: "玩家穿墙或墙壁对不齐",
        fixPrompt: "修复墙壁，让玩家无法穿过。确保所有墙壁在网格上正确对齐。",
      },
      {
        id: "path",
        label: "没有通路",
        emoji: "🚫",
        description: "无法到达出口——所有路都被堵住了",
        fixPrompt: "确保迷宫始终有从起点到出口的有效路径。如果需要，使用递归回溯迷宫生成算法。",
      },
      {
        id: "spawn",
        label: "出生点问题",
        emoji: "📍",
        description: "玩家出生在墙里或位置不对",
        fixPrompt: "修复玩家出生位置，让他们出现在迷宫入口的空地上，而不是墙里。",
      },
      {
        id: "reward",
        label: "奖励问题",
        emoji: "🎁",
        description: "奖励没出现或无法收集",
        fixPrompt: "修复奖励，让它出现在出口并在玩家到达时正确触发。",
      },
      {
        id: "collision",
        label: "碰撞问题",
        emoji: "💥",
        description: "陷阱碰撞不按预期工作",
        fixPrompt: "修复陷阱碰撞检测，让它在玩家碰到陷阱时正确触发。",
      },
      {
        id: "other",
        label: "其他问题",
        emoji: "❓",
        description: "其他问题——自己描述",
        fixPrompt: null,
      },
    ],
  },

  ownIdeaMaxLength: 60,
  gameNameMaxLength: 30,

  defaultGameName: (choices, ownInputs) => {
    const themeVal = choices.theme;
    if (!themeVal) return "我的迷宫";
    const resolved =
      themeVal === "__own__"
        ? (ownInputs.theme || "").trim()
        : LESSON_2_ZH.steps[0].options.find((o) => o.value === themeVal)?.label;
    if (!resolved) return "我的迷宫";
    return `${resolved}迷宫`;
  },

  buildPrompt: (choices, ownInputs = {}, gameName = "", rules = {}) => {
    const resolve = (id) => {
      const val = choices[id];
      if (val === "__own__") return (ownInputs[id] || "").trim();
      return val?.replace(/-/g, " ") || "";
    };

    const sizeOption = LESSON_2_ZH.steps[3].options.find((o) => o.value === choices.size);
    const width = sizeOption?.meta?.width || 15;
    const height = sizeOption?.meta?.height || 15;

    const theme = resolve("theme") || "暗黑城堡";
    const obstacle = resolve("obstacle") || "陷阱";
    const reward = resolve("reward") || "宝藏";
    const background = resolve("background") || "深蓝色";
    const title = (gameName || "").trim() || LESSON_2_ZH.defaultGameName(choices, ownInputs);

    const collisionRule = rules.collision || "失去1条命";
    const winRule = rules.win || "到达出口";
    const loseRule = rules.lose || "3条命";
    const difficultyRule = rules.difficulty || "中等速度";

    return `构建一个名为"${title}"的可玩迷宫游戏作为 Artifact。

我的迷宫设计：
- 主题：${theme}
- 大小：${width} × ${height}
- 背景颜色：${background}
- 要躲避的危险物：${obstacle}
- 终点奖励：${reward}

我的游戏规则：
- 玩家碰到${obstacle}时：${collisionRule}
- 获胜方式：${winRule}
- 生命：${loseRule}
- 速度：${difficultyRule}

确保：
- 迷宫始终有从起点到终点的清晰路径（玩家总能到达出口）
- 玩家从左上角开始，出口在右下角
- 方向键控制玩家移动
- 屏幕顶部显示生命和分数

请将其制作成 Artifact 面板中的可玩游戏。`;
  },

  upgrades: [
    // Easy upgrades
    {
      id: "timer",
      level: "easy",
      title: "时间限制",
      emoji: "⏱️",
      fillParam: {
        key: "seconds",
        label: "添加",
        suffix: "秒倒计时",
        default: 60,
        min: 10,
        max: 300,
        hint: "30秒 = 快节奏 · 120秒 = 轻松玩"
      },
      buildPrompt: (seconds) => `添加 ${seconds} 秒倒计时。如果玩家没在时间内到达出口，游戏结束。在顶部醒目显示计时器。`,
      agent_context: "限制玩家完成迷宫的倒计时器",
      language_dimensions: [DIMENSION_LIBRARY_ZH.duration, DIMENSION_LIBRARY_ZH.position, DIMENSION_LIBRARY_ZH.result],
    },
    {
      id: "lives-counter",
      level: "easy",
      title: "生命计数器",
      emoji: "❤️",
      fillParam: {
        key: "lives",
        label: "添加",
        suffix: "条命显示为心形",
        default: 3,
        min: 1,
        max: 10,
        hint: "1 = 硬核 · 5+ = 宽容"
      },
      buildPrompt: (lives) => `在顶部添加 ${lives} 条命，显示为心形。每碰到陷阱失去一颗心。所有心消失后游戏结束。`,
      agent_context: "显示剩余尝试次数的视觉生命计数器",
      language_dimensions: [DIMENSION_LIBRARY_ZH.quantity, DIMENSION_LIBRARY_ZH.position, DIMENSION_LIBRARY_ZH.appearance],
    },
    {
      id: "collectibles",
      level: "easy",
      title: "收集品",
      emoji: "⭐",
      fillParam: {
        key: "count",
        label: "在迷宫中散落",
        suffix: "个金币",
        default: 10,
        min: 3,
        max: 50,
        hint: "5 = 快速找到 · 20+ = 寻宝之旅"
      },
      buildPrompt: (count) => `在迷宫中散落 ${count} 个金币。在顶部显示分数计数器。每个金币值1分。`,
      agent_context: "散落在迷宫中用于加分的收集品",
      language_dimensions: [DIMENSION_LIBRARY_ZH.quantity, DIMENSION_LIBRARY_ZH.position, DIMENSION_LIBRARY_ZH.result],
    },
    {
      id: "__own__",
      level: "easy",
      title: "我的想法",
      emoji: "✏️",
      isOwn: true,
      buildPrompt: (text) =>
        `请在我的迷宫中添加：${text.trim()}。让它与现有玩法配合良好，保持游戏可玩性。`,
      agent_context: "学生自定义想法",
      language_dimensions: [],
    },

    // Medium upgrades
    {
      id: "moving-obstacle",
      level: "medium",
      title: "移动陷阱",
      emoji: "🏃",
      think: "移动的陷阱可能非常危险！应该容易躲还是几乎躲不开？想想玩家会有什么感觉。",
      params: [
        {
          key: "patrol_seconds",
          label: "陷阱每___秒巡逻一次",
          default: 3,
          min: 1,
          max: 10,
          hint: "1秒 = 非常快（难） · 10秒 = 非常慢（易）"
        },
      ],
      buildPrompt: (p) => `添加移动陷阱，在迷宫中来回巡逻，每 ${p.patrol_seconds} 秒移动一次。它们应该沿直线路径移动（水平或垂直）。玩家碰到移动陷阱时失去一条命。`,
      agent_context: "按固定模式来回移动的陷阱",
      language_dimensions: [
        "难度意图（想让陷阱很难躲还是容易躲）",
        "移动节奏意图（想让陷阱快速来回还是缓慢移动）",
      ],
    },
    {
      id: "chasing-enemy",
      level: "medium",
      title: "追踪敌人",
      emoji: "👾",
      think: "追你的敌人很吓人！玩家应该一直紧张，还是只需要偶尔小心？",
      params: [
        {
          key: "speed",
          label: "敌人速度",
          default: 3,
          min: 1,
          max: 10,
          hint: "1 = 慢，容易逃脱 · 5 = 需要跑 · 10 = 几乎跑不掉"
        },
      ],
      buildPrompt: (p) => `添加一个怪物敌人，以速度级别 ${p.speed}（1=非常慢，10=非常快）在迷宫中追玩家。怪物应该跟踪玩家但不能穿墙。如果怪物抓到玩家，失去一条命。`,
      agent_context: "主动追踪玩家的敌人",
      language_dimensions: [
        "难度意图（想让敌人很难甩掉还是可以轻松逃脱）",
        "威胁感意图（想让玩家感到紧张还是有掌控感）",
      ],
    },
    {
      id: "multiple-levels",
      level: "medium",
      title: "多关卡",
      emoji: "🗺️",
      think: "更多关卡意味着更多挑战！多少关卡感觉合适？每关应该怎样变难？",
      params: [
        {
          key: "levels",
          label: "总关卡数",
          default: 3,
          min: 2,
          max: 5,
          hint: "建议2-5关。超过5关可能导致AI生成不完整。"
        },
      ],
      buildPrompt: (p) => `创建 ${p.levels} 个不同的迷宫关卡。玩家到达出口后进入下一关。每关应该稍微更难（更多陷阱或更复杂的迷宫）。每关开始时显示"第1关"、"第2关"等大标题。通关所有关卡后显示"你赢了！"并庆祝。`,
      agent_context: "难度递增的多迷宫关卡",
      language_dimensions: [
        "规模意图（想要关卡多一点还是少一点）",
        "进阶方式意图（每关想要怎么变难——更多陷阱？更复杂路径？）",
      ],
    },
    {
      id: "__own_medium__",
      level: "medium",
      title: "我的想法",
      emoji: "✏️",
      isOwn: true,
      dynamicParams: true,
      params: [],
      think: "你想添加什么功能？想想什么能让你的迷宫更有趣。",
      buildPrompt: (paramValues, template) => {
        if (!template) return '';
        return template.replace(/\{(\w+)\}/g, (_, key) => paramValues[key] || `[${key}]`);
      },
      agent_context: "学生自己想的游戏功能，具体内容未知",
      language_dimensions: [],
    },

    // Hard upgrades
    {
      id: "hidden-passage",
      level: "hard",
      title: "隐藏通道",
      emoji: "🕵️",
      hint: "只有你知道的秘密捷径！它应该在哪里？看起来什么样？玩家怎么找到它？想一个聪明的设计。",
      prompt: null,
      agent_context: "穿过迷宫的秘密隐形捷径",
      language_dimensions: [DIMENSION_LIBRARY_ZH.position, DIMENSION_LIBRARY_ZH.appearance, DIMENSION_LIBRARY_ZH.condition, DIMENSION_LIBRARY_ZH.result],
    },
    {
      id: "difficulty-curve",
      level: "hard",
      title: "难度曲线",
      emoji: "⚖️",
      hint: "随着玩家前进，迷宫应该怎样变难？更多陷阱？更快的敌人？更少的时间？自己设计难度递进。",
      prompt: null,
      agent_context: "设计好的难度递增系统",
      language_dimensions: [DIMENSION_LIBRARY_ZH.speed, DIMENSION_LIBRARY_ZH.quantity, DIMENSION_LIBRARY_ZH.trigger, DIMENSION_LIBRARY_ZH.condition],
    },
    {
      id: "signature-rule",
      level: "hard",
      title: "独特规则",
      emoji: "🌟",
      hint: "让你的迷宫独一无二的规则！别的迷宫都没有的东西。什么特殊机制能定义你的游戏？",
      prompt: null,
      agent_context: "独一无二的游戏机制",
      language_dimensions: [DIMENSION_LIBRARY_ZH.trigger, DIMENSION_LIBRARY_ZH.result, DIMENSION_LIBRARY_ZH.appearance],
    },
    {
      id: "__own_hard__",
      level: "hard",
      title: "我的想法",
      emoji: "✏️",
      isOwn: true,
      prompt: null,
      hint: "你的独特想法是什么？想一个别的迷宫都没有的东西。",
      agent_context: "学生完全原创的游戏功能，没有任何方向限制",
      language_dimensions: [
        "触发条件（什么情况下发生）",
        "结果描述（发生了会怎样）",
        "外观描述（看起来怎样）",
      ],
    },
  ],
};

// Recovery items for Lesson 2 - Chinese
export const RECOVERY_2_ZH = [
  {
    id: "no-maze",
    icon: "👻",
    title: "Claude只显示文字，没有迷宫",
    fix: '在聊天中输入：「请把这个作为可玩的迷宫游戏显示在 Artifact 面板中。」',
  },
  {
    id: "no-path",
    icon: "🚫",
    title: "没有通往出口的路",
    fix: '输入：「确保迷宫始终有从起点到出口的有效路径。使用递归回溯迷宫生成算法。」',
  },
  {
    id: "stuck-in-wall",
    icon: "🧱",
    title: "玩家出生在墙里",
    fix: '输入：「修复玩家出生位置，让他们从入口的空地开始。」',
  },
  {
    id: "collision-broken",
    icon: "💥",
    title: "陷阱不会伤害玩家",
    fix: '准确告诉 Claude 哪里有问题。例如：「碰到火焰陷阱时什么都没发生。应该让我失去一条命。」',
  },
  {
    id: "controls-broken",
    icon: "🎮",
    title: "方向键不管用",
    fix: '输入：「让方向键能在迷宫中移动玩家。」',
  },
  {
    id: "where-paste",
    icon: "❓",
    title: "在哪里粘贴提示词？",
    fix: "打开 claude.ai。底部的大文本框就是粘贴的地方，然后按回车。",
  },
  {
    id: "limit",
    icon: "🛑",
    title: 'Claude说「消息限制已达上限」',
    fix: "举手。老师会给你切换到备用账号。",
  },
  {
    id: "ugly",
    icon: "🎨",
    title: "迷宫看起来不对（颜色/大小）",
    fix: '在同一个聊天中，输入你想改的内容。例如：「让墙壁看起来像冰块。」Claude会更新游戏。',
  },
];

// Level configuration - Chinese
export const LEVEL_CONFIG_2_ZH = {
  easy: {
    label: "简单",
    emoji: "🟢",
    color: "border-green-300 bg-green-50",
    accent: "text-green-700",
    desc: "快速更改 — 选一个然后复制",
  },
  medium: {
    label: "中等",
    emoji: "🔵",
    color: "border-blue-300 bg-blue-50",
    accent: "text-blue-700",
    desc: "较大更改 — 先想好，再填数字",
  },
  hard: {
    label: "困难",
    emoji: "🟣",
    color: "border-purple-300 bg-purple-50",
    accent: "text-purple-700",
    desc: "设计挑战 — 你来写提示词",
  },
};

// Tabs for Lesson 2 - Chinese
import { Sparkles, Copy, AlertCircle, Rocket, Settings, Bug } from "lucide-react";

export const TABS_2_ZH = [
  { id: "design", label: "设计", icon: Sparkles },
  { id: "rules", label: "规则", icon: Settings },
  { id: "prompt", label: "提示词", icon: Copy },
  { id: "debug", label: "调试", icon: Bug },
  { id: "help", label: "帮助", icon: AlertCircle },
  { id: "upgrade", label: "升级", icon: Rocket },
];
